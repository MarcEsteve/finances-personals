const pdfParseModule = require('pdf-parse')

async function extractPdfText(buffer) {
  // pdf-parse v1 exports a function
  if (typeof pdfParseModule === 'function') {
    const result = await pdfParseModule(buffer)
    return result?.text || ''
  }

  // pdf-parse v2 exports a PDFParse class
  if (pdfParseModule && typeof pdfParseModule.PDFParse === 'function') {
    const parser = new pdfParseModule.PDFParse({ data: buffer })
    try {
      const result = await parser.getText()
      return result?.text || ''
    } finally {
      if (typeof parser.destroy === 'function') {
        await parser.destroy().catch(() => {})
      }
    }
  }

  throw new Error('No s\'ha pogut inicialitzar el parser de PDF')
}

function parseEuroNumber(raw) {
  if (!raw) return null
  let value = String(raw).trim()
  value = value.replace(/\s+/g, '')
  value = value.replace(/€/g, '')

  // Handle common ES formats: 1.234,56 or 1234,56
  if (value.includes(',') && value.includes('.')) {
    value = value.replace(/\./g, '').replace(',', '.')
  } else if (value.includes(',')) {
    value = value.replace(',', '.')
  }

  const n = Number.parseFloat(value)
  return Number.isFinite(n) ? n : null
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function round2(n) {
  return Math.round(n * 100) / 100
}

function extractLineNumbers(line) {
  const matches = line.match(/-?\d{1,3}(?:[.\s]\d{3})*(?:,\d+)?|-?\d+(?:[.,]\d+)?/g) || []
  const parsed = matches.map(parseEuroNumber).filter(v => v !== null)
  return parsed
}

function extractLinePercents(line) {
  const matches = [...line.matchAll(/(\d{1,2}(?:[.,]\d+)?)\s*%/g)]
  return matches
    .map(m => parseEuroNumber(m[1]))
    .filter(v => v !== null)
}

function extractMoneyAmounts(text) {
  // Prioritize decimal monetary-looking values to avoid IDs/phones/IBAN.
  const matches = text.match(/-?\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})|-?\d+(?:[.,]\d{2})/g) || []
  return matches
    .map(parseEuroNumber)
    .filter(v => v !== null)
}

function approxEquals(a, b, tolerance = 0.02) {
  return Math.abs(a - b) <= tolerance
}

function amountExists(amounts, target, tolerance = 0.02) {
  return amounts.some(v => approxEquals(v, target, tolerance))
}

function pickBestBaseFromAmounts(amounts, ivaPct, irpfPct, explicitTotal, explicitBase) {
  if (ivaPct === null || irpfPct === null) return null

  const factor = 1 + ivaPct / 100 - irpfPct / 100
  if (factor <= 0.0001) return null

  const positives = Array.from(new Set(amounts.filter(v => v > 0).map(v => round2(v)))).sort((a, b) => b - a)
  if (positives.length === 0) return null

  let best = null

  for (const totalCandidate of positives) {
    const baseCandidate = round2(totalCandidate / factor)
    const ivaCandidate = round2(baseCandidate * (ivaPct / 100))
    const irpfCandidate = round2(baseCandidate * (irpfPct / 100))

    let score = 0

    if (amountExists(amounts, baseCandidate, 0.05)) score += 5
    if (amountExists(amounts, ivaCandidate, 0.05)) score += 4
    if (amountExists(amounts, irpfCandidate, 0.05)) score += 4

    if (explicitTotal !== null && approxEquals(totalCandidate, explicitTotal, 0.05)) score += 2
    if (explicitBase !== null && approxEquals(baseCandidate, explicitBase, 0.05)) score += 2

    // Penalize impossible totals that are lower than at least one tax amount match.
    if (totalCandidate < ivaCandidate || totalCandidate < irpfCandidate) score -= 3

    if (!best || score > best.score) {
      best = {
        score,
        total: totalCandidate,
        base: baseCandidate,
        ivaImport: ivaCandidate,
        irpfImport: irpfCandidate,
      }
    }
  }

  if (!best || best.score < 4) return null
  return best
}

function extractInvoiceDate(text) {
  const match = text.match(/(?:\bdata\b|\bfecha\b)\s*[:\-]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i)
  if (!match || !match[1]) return null

  const parts = match[1].split(/[\/\-.]/).map(v => Number.parseInt(v, 10))
  if (parts.length !== 3) return null

  let [day, month, year] = parts
  if (year < 100) year += 2000
  if (!day || !month || !year) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
}

function isLikelyCompanyName(line) {
  const raw = String(line || '').trim()
  if (!raw) return false
  if (raw.length < 4) return false

  const normalized = normalizeText(raw)
  if (!normalized) return false

  const blocked = [
    'cif nif vat',
    'nom',
    'nombre',
    'direccio',
    'direccion',
    'ciutat',
    'ciudad',
    'provincia',
    'web',
    'factura',
    'project',
    'iban',
  ]

  if (blocked.some(token => normalized === token || normalized.startsWith(`${token} `))) return false
  if (/^es\d{2}/i.test(normalized)) return false
  if (/^\d+$/.test(normalized)) return false

  const legalSuffix = /(\bs\.\s*l\.?\b|\bs\s*l\b|\bs\.\s*a\.?\b|\bs\s*a\b|\bs\.\s*l\.\s*u\.?\b|\bs\s*l\s*u\b|\bllc\b|\binc\b)/i
  if (legalSuffix.test(raw)) return true

  const words = raw.split(/\s+/).filter(Boolean)
  if (words.length >= 2 && words.some(w => /[A-Za-z]/.test(w))) return true

  return false
}

function extractClientName(lines) {
  for (const rawLine of lines) {
    const match = rawLine.match(/(?:\bnom\b|\bnombre\b)\s*:\s*(.+)$/i)
    if (match && match[1] && isLikelyCompanyName(match[1])) {
      return match[1].trim()
    }
  }

  // Heuristic for PDFs where labels and values are broken into separate lines.
  const anchors = ['cif/nif/vat', 'cif', 'nif', 'vat', 'nom:', 'nombre:']
  let anchorIndex = -1
  for (let i = 0; i < lines.length; i += 1) {
    const n = normalizeText(lines[i])
    if (anchors.some(a => n.includes(normalizeText(a)))) {
      anchorIndex = i
      break
    }
  }

  if (anchorIndex !== -1) {
    const start = Math.max(0, anchorIndex - 2)
    const end = Math.min(lines.length - 1, anchorIndex + 20)
    let fallback = null

    for (let i = start; i <= end; i += 1) {
      const line = lines[i].trim()
      if (!line) continue
      if (!isLikelyCompanyName(line)) continue

      const legalSuffix = /(\bs\.\s*l\.?\b|\bs\s*l\b|\bs\.\s*a\.?\b|\bs\s*a\b|\bs\.\s*l\.\s*u\.?\b|\bs\s*l\s*u\b|\bllc\b|\binc\b)/i
      if (legalSuffix.test(line)) return line

      if (!fallback) fallback = line
    }

    if (fallback) return fallback
  }

  return null
}

function inferBaseFromTotals(base, ivaPct, irpfPct, ivaImport, irpfImport, totalFactura) {
  let candidate = null

  // Most reliable: monetary identity Total = Base + IVA - IRPF
  if (totalFactura !== null && ivaImport !== null && irpfImport !== null) {
    candidate = round2(totalFactura - Math.abs(ivaImport) + Math.abs(irpfImport))
  }

  // Fallback: percentages with total
  if (candidate === null && totalFactura !== null && ivaPct !== null && irpfPct !== null) {
    const factor = 1 + ivaPct / 100 - irpfPct / 100
    if (factor > 0.0001) {
      candidate = round2(totalFactura / factor)
    }
  }

  // Fallback: derive from one tax amount and its percentage
  if (candidate === null && ivaImport !== null && ivaPct !== null && ivaPct > 0.0001) {
    candidate = round2(Math.abs(ivaImport) / (ivaPct / 100))
  }

  if (candidate === null && irpfImport !== null && irpfPct !== null && irpfPct > 0.0001) {
    candidate = round2(Math.abs(irpfImport) / (irpfPct / 100))
  }

  if (base === null) return candidate
  if (candidate === null) return base

  // If explicit base is clearly inconsistent, trust the monetary identity.
  const tolerance = Math.max(5, Math.abs(base) * 0.1)
  if (Math.abs(base - candidate) > tolerance) return candidate

  return base
}

function firstMatchNumber(text, regexList) {
  for (const regex of regexList) {
    const match = text.match(regex)
    if (match && match[1]) {
      const parsed = parseEuroNumber(match[1])
      if (parsed !== null) return parsed
    }
  }
  return null
}

function firstMatchPercent(text, regexList) {
  for (const regex of regexList) {
    const match = text.match(regex)
    if (match && match[1]) {
      const parsed = parseEuroNumber(match[1])
      if (parsed !== null) return parsed
    }
  }
  return null
}

function parseInvoiceText(text) {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)

  let base = null
  let ivaPct = null
  let ivaImport = null
  let irpfPct = null
  let irpfImport = null
  let totalFactura = null
  const moneyAmounts = extractMoneyAmounts(text)
  const invoiceDate = extractInvoiceDate(text)
  const clientName = extractClientName(lines)

  for (const rawLine of lines) {
    const line = rawLine.toLowerCase()
    const numbers = extractLineNumbers(rawLine)
    const percents = extractLinePercents(rawLine)

    if (
      base === null &&
      /(base\s+imponible|base\s+imposable|total\s+abans\s+d['’]?impostos|total\s+antes\s+de\s+impuestos|\bsubtotal\b)/i.test(line) &&
      numbers.length > 0
    ) {
      base = numbers[numbers.length - 1]
    }

    if (/\biva\b/i.test(line)) {
      if (ivaPct === null && percents.length > 0) ivaPct = percents[0]
      if (ivaImport === null && numbers.length > 0) {
        const amountCandidates = numbers.filter(n => !percents.some(p => Math.abs(n - p) < 0.0001))
        if (amountCandidates.length > 0) {
          ivaImport = Math.abs(amountCandidates[amountCandidates.length - 1])
        }
      }
    }

    if (/(\birpf\b|retenci[oó]n?)/i.test(line)) {
      if (irpfPct === null && percents.length > 0) irpfPct = percents[0]
      if (irpfImport === null && numbers.length > 0) {
        const amountCandidates = numbers.filter(n => !percents.some(p => Math.abs(n - p) < 0.0001))
        if (amountCandidates.length > 0) {
          irpfImport = Math.abs(amountCandidates[amountCandidates.length - 1])
        }
      }
    }

    if (
      totalFactura === null &&
      /\btotal\b/i.test(line) &&
      !/\bsubtotal\b/i.test(line) &&
      !/\bbase\b/i.test(line) &&
      numbers.length > 0
    ) {
      totalFactura = numbers[numbers.length - 1]
    }
  }

  // Compact-text fallbacks for PDFs without clear line breaks
  const compact = text.replace(/\s+/g, ' ').trim()

  if (base === null) {
    base = firstMatchNumber(compact, [
      /base\s+imposable[^\d]{0,30}([\d.,]+)/i,
      /base\s+imponible[^\d]{0,30}([\d.,]+)/i,
      /total\s+abans\s+d['’]?impostos[^\d]{0,30}([\d.,]+)/i,
      /total\s+antes\s+de\s+impuestos[^\d]{0,30}([\d.,]+)/i,
      /subtotal[^\d]{0,30}([\d.,]+)/i,
    ])
  }

  if (ivaPct === null) {
    ivaPct = firstMatchPercent(compact, [/iva\s*[:\-]?\s*(\d{1,2}(?:[.,]\d+)?)\s*%/i])
  }

  if (irpfPct === null) {
    irpfPct = firstMatchPercent(compact, [
      /irpf\s*[:\-]?\s*(\d{1,2}(?:[.,]\d+)?)\s*%/i,
      /retenci[oó]n?\s*irpf\s*[:\-]?\s*(\d{1,2}(?:[.,]\d+)?)\s*%/i,
    ])
  }

  if (totalFactura === null) {
    totalFactura = firstMatchNumber(compact, [
      /total\s+factura[^\d]{0,30}([\d.,]+)/i,
      /importe\s+total[^\d]{0,30}([\d.,]+)/i,
      /\btotal\b[^\d]{0,30}([\d.,]+)/i,
    ])
  }

  // Choose the most consistent total/base pair from detected amounts.
  const bestFromAmounts = pickBestBaseFromAmounts(
    moneyAmounts,
    ivaPct,
    irpfPct,
    totalFactura,
    base
  )

  if (bestFromAmounts) {
    totalFactura = bestFromAmounts.total
    base = bestFromAmounts.base
    if (ivaImport === null || !amountExists(moneyAmounts, ivaImport, 0.05)) {
      ivaImport = bestFromAmounts.ivaImport
    }
    if (irpfImport === null || !amountExists(moneyAmounts, irpfImport, 0.05)) {
      irpfImport = bestFromAmounts.irpfImport
    }
  }

  // Compute missing values from available ones
  if (base !== null && ivaImport === null && ivaPct !== null) {
    ivaImport = round2(base * (ivaPct / 100))
  }
  if (base !== null && ivaPct === null && ivaImport !== null && base > 0) {
    ivaPct = round2((ivaImport / base) * 100)
  }

  if (base !== null && irpfImport === null && irpfPct !== null) {
    irpfImport = round2(base * (irpfPct / 100))
  }
  if (base !== null && irpfPct === null && irpfImport !== null && base > 0) {
    irpfPct = round2((irpfImport / base) * 100)
  }

  if (totalFactura === null && base !== null) {
    totalFactura = round2(base + (ivaImport || 0) - (irpfImport || 0))
  }

  base = inferBaseFromTotals(base, ivaPct, irpfPct, ivaImport, irpfImport, totalFactura)

  // Last fallback: infer taxes from base and percentages when amounts are missing/ambiguous.
  if (base !== null && ivaPct !== null && (ivaImport === null || ivaImport <= 0)) {
    ivaImport = round2(base * (ivaPct / 100))
  }
  if (base !== null && irpfPct !== null && (irpfImport === null || irpfImport <= 0)) {
    irpfImport = round2(base * (irpfPct / 100))
  }

  if (totalFactura === null && base !== null) {
    totalFactura = round2(base + (ivaImport || 0) - (irpfImport || 0))
  }

  return { base, ivaPct, ivaImport, irpfPct, irpfImport, totalFactura, invoiceDate, clientName }
}

async function parseInvoicePdfBuffer(buffer) {
  const text = await extractPdfText(buffer)
  const parsed = parseInvoiceText(text)

  return {
    parsed,
    textSnippet: text.replace(/\s+/g, ' ').trim().slice(0, 500),
  }
}

module.exports = {
  parseInvoicePdfBuffer,
}
