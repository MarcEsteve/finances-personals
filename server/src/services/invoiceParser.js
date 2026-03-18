const pdfParse = require('pdf-parse')

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
  const compact = text.replace(/\s+/g, ' ').trim()

  const base = firstMatchNumber(compact, [
    /base\s+imponible[^\d]{0,20}([\d.,]+)/i,
    /base[^\d]{0,20}([\d.,]+)/i,
    /subtotal[^\d]{0,20}([\d.,]+)/i,
  ])

  const ivaPct = firstMatchPercent(compact, [
    /iva\s*[:\-]?\s*(\d{1,2}(?:[.,]\d+)?)\s*%/i,
  ])

  const ivaImport = firstMatchNumber(compact, [
    /iva(?:\s*\(\s*\d{1,2}(?:[.,]\d+)?%\s*\))?[^\d]{0,20}([\d.,]+)/i,
  ])

  const irpfPct = firstMatchPercent(compact, [
    /irpf\s*[:\-]?\s*(\d{1,2}(?:[.,]\d+)?)\s*%/i,
    /retenci[oó]n?\s*irpf\s*[:\-]?\s*(\d{1,2}(?:[.,]\d+)?)\s*%/i,
  ])

  const irpfImport = firstMatchNumber(compact, [
    /irpf(?:\s*\(\s*\d{1,2}(?:[.,]\d+)?%\s*\))?[^\d]{0,20}([\d.,]+)/i,
    /retenci[oó]n?\s*irpf[^\d]{0,20}([\d.,]+)/i,
  ])

  const totalFactura = firstMatchNumber(compact, [
    /total\s+factura[^\d]{0,20}([\d.,]+)/i,
    /importe\s+total[^\d]{0,20}([\d.,]+)/i,
    /total[^\d]{0,20}([\d.,]+)/i,
  ])

  return {
    base,
    ivaPct,
    ivaImport,
    irpfPct,
    irpfImport,
    totalFactura,
  }
}

async function parseInvoicePdfBuffer(buffer) {
  const result = await pdfParse(buffer)
  const text = result?.text || ''
  const parsed = parseInvoiceText(text)

  return {
    parsed,
    textSnippet: text.replace(/\s+/g, ' ').trim().slice(0, 500),
  }
}

module.exports = {
  parseInvoicePdfBuffer,
}
