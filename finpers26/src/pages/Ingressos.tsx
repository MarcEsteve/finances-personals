import { useEffect, useMemo, useState } from 'react'

type DetallTipus = 'general' | 'factura' | 'nomina'
type NominaMode = 'net' | 'brut' | 'base'

interface Client {
  _id: string
  nom: string
  razonSocial: string
  actiu: boolean
}

interface FacturaDetail {
  base?: number
  ivaPct?: number
  ivaImport?: number
  irpfPct?: number
  irpfImport?: number
  totalFactura?: number
}

interface NominaDetail {
  mode?: NominaMode
  baseSou?: number
  complements?: number
  brut?: number
  irpfImport?: number
  ssImport?: number
  altresDeduccions?: number
  net?: number
}

interface DetallIngres {
  tipus?: DetallTipus
  factura?: FacturaDetail
  nomina?: NominaDetail
}

interface Transaccio {
  _id: string
  categoria: string
  descripcio: string
  import: number
  data: string
  clientId?: string
  adjunts?: Array<{ fileName: string; originalName?: string }>
  detallIngres?: DetallIngres
}

const TIPUS_FISCALS_SELECTABLES: DetallTipus[] = ['factura', 'nomina']

function fmt(n: number) {
  return n.toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function parseAmount(value: string) {
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function labelTipusFiscal(tipus: DetallTipus) {
  if (tipus === 'factura') return 'Factura freelance'
  if (tipus === 'nomina') return 'Nòmina'
  return 'General'
}

function categoriaFromTipusFiscal(tipus: DetallTipus) {
  if (tipus === 'factura') return 'Factura'
  if (tipus === 'nomina') return 'Nòmina'
  return 'General'
}

function tipusFiscalFromTransaccio(transaccio: Transaccio): DetallTipus {
  const detall = transaccio.detallIngres?.tipus
  if (detall === 'factura' || detall === 'nomina' || detall === 'general') return detall

  const categoria = (transaccio.categoria || '').toLowerCase()
  if (categoria.includes('factura') || categoria.includes('freelance')) return 'factura'
  if (categoria.includes('nòmina') || categoria.includes('nomina')) return 'nomina'
  return 'general'
}

function clientLabel(client: Client) {
  if (client.nom && client.nom.trim()) return `${client.nom.trim()} (${client.razonSocial})`
  return client.razonSocial
}

const avui = () => new Date().toISOString().slice(0, 10)

function createEmptyForm(clientId = '') {
  return {
    detallTipus: 'factura' as DetallTipus,
    clientId,
    descripcio: '',
    import: '',
    data: avui(),
    facturaBase: '',
    facturaIvaPct: '21',
    facturaIrpfPct: '15',
    nominaMode: 'net' as NominaMode,
    nominaBaseSou: '',
    nominaComplements: '',
    nominaBrut: '',
    nominaIrpfImport: '',
    nominaSsImport: '',
    nominaAltresDeduccions: '',
    nominaNet: '',
  }
}

function computeFactura(form: ReturnType<typeof createEmptyForm>) {
  const base = parseAmount(form.facturaBase)
  const ivaPct = parseAmount(form.facturaIvaPct)
  const irpfPct = parseAmount(form.facturaIrpfPct)
  const ivaImport = base * (ivaPct / 100)
  const irpfImport = base * (irpfPct / 100)
  const totalFactura = base + ivaImport - irpfImport

  return { base, ivaPct, irpfPct, ivaImport, irpfImport, totalFactura }
}

function computeNomina(form: ReturnType<typeof createEmptyForm>) {
  const baseSou = parseAmount(form.nominaBaseSou)
  const complements = parseAmount(form.nominaComplements)
  const brutInput = parseAmount(form.nominaBrut)
  const irpfImport = parseAmount(form.nominaIrpfImport)
  const ssImport = parseAmount(form.nominaSsImport)
  const altresDeduccions = parseAmount(form.nominaAltresDeduccions)
  const deductions = irpfImport + ssImport + altresDeduccions

  let brut = brutInput
  let net = parseAmount(form.nominaNet)

  if (form.nominaMode === 'base') {
    brut = baseSou + complements
    net = Math.max(0, brut - deductions)
  } else if (form.nominaMode === 'brut') {
    net = Math.max(0, brut - deductions)
  } else {
    brut = net + deductions
  }

  return {
    mode: form.nominaMode,
    baseSou,
    complements,
    brut,
    irpfImport,
    ssImport,
    altresDeduccions,
    net,
  }
}

function buildPayload(form: ReturnType<typeof createEmptyForm>) {
  const descripcio = form.descripcio.trim()
  if (!descripcio) throw new Error('La descripció és obligatòria')
  if (!form.clientId) throw new Error('Has de seleccionar un client')

  if (form.detallTipus === 'factura') {
    const factura = computeFactura(form)
    if (factura.base <= 0) throw new Error('La base de la factura ha de ser major que 0')

    return {
      tipus: 'ingres',
      categoria: categoriaFromTipusFiscal(form.detallTipus),
      clientId: form.clientId,
      descripcio,
      import: factura.totalFactura,
      data: form.data,
      detallIngres: {
        tipus: 'factura' as DetallTipus,
        factura,
      },
    }
  }

  if (form.detallTipus === 'nomina') {
    const nomina = computeNomina(form)
    if (nomina.net <= 0) throw new Error('L\'import net de la nòmina ha de ser major que 0')

    return {
      tipus: 'ingres',
      categoria: categoriaFromTipusFiscal(form.detallTipus),
      clientId: form.clientId,
      descripcio,
      import: nomina.net,
      data: form.data,
      detallIngres: {
        tipus: 'nomina' as DetallTipus,
        nomina,
      },
    }
  }

  throw new Error('Has de seleccionar un tipus fiscal vàlid: factura o nòmina')
}

function formatDetallFiscal(transaccio: Transaccio) {
  if (transaccio.detallIngres?.tipus === 'factura' && transaccio.detallIngres.factura) {
    const factura = transaccio.detallIngres.factura
    return (
      <div style={{ fontSize: '0.9em', lineHeight: '1.5' }}>
        <div style={{ fontWeight: 600, color: '#0ea5e9' }}>📄 Factura</div>
        <div>Base: <strong>{fmt(factura.base || 0)}</strong></div>
        <div>IVA ({factura.ivaPct}%): <strong style={{ color: '#10b981' }}>+{fmt(factura.ivaImport || 0)}</strong></div>
        <div>IRPF ({factura.irpfPct}%): <strong style={{ color: '#ef4444' }}>-{fmt(factura.irpfImport || 0)}</strong></div>
        <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '0.5rem', marginTop: '0.5rem', fontWeight: 600 }}>
          Total: <strong>{fmt(factura.totalFactura || 0)}</strong>
        </div>
      </div>
    )
  }

  if (transaccio.detallIngres?.tipus === 'nomina' && transaccio.detallIngres.nomina) {
    const nomina = transaccio.detallIngres.nomina
    return (
      <div style={{ fontSize: '0.9em', lineHeight: '1.5' }}>
        <div style={{ fontWeight: 600, color: '#7c3aed' }}>💼 Nòmina</div>
        <div>Base: <strong>{fmt(nomina.baseSou || 0)}</strong></div>
        {nomina.complements ? <div>Complements: <strong>{fmt(nomina.complements)}</strong></div> : null}
        <div>Brut: <strong>{fmt(nomina.brut || 0)}</strong></div>
        <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
          <div>IRPF: <strong style={{ color: '#ef4444' }}>-{fmt(nomina.irpfImport || 0)}</strong></div>
          <div>SS: <strong style={{ color: '#ef4444' }}>-{fmt(nomina.ssImport || 0)}</strong></div>
          {nomina.altresDeduccions ? <div>Altres: <strong style={{ color: '#ef4444' }}>-{fmt(nomina.altresDeduccions)}</strong></div> : null}
        </div>
        <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '0.5rem', marginTop: '0.5rem', fontWeight: 600 }}>
          Net cobrat: <strong style={{ color: '#10b981' }}>{fmt(nomina.net || 0)}</strong>
        </div>
      </div>
    )
  }

  return <span style={{ color: '#64748b' }}>Sense detall fiscal</span>
}

export default function Ingressos() {
  const [transaccions, setTransaccions] = useState<Transaccio[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(createEmptyForm())
  const [fitxerAdjunt, setFitxerAdjunt] = useState<File | null>(null)
  const [fileInputKey, setFileInputKey] = useState(0)
  const [parsingPdf, setParsingPdf] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ categoria: 'General', clientId: '', descripcio: '', import: '', data: avui() })
  const [savingEdit, setSavingEdit] = useState(false)
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedTipusFiscal, setSelectedTipusFiscal] = useState<'all' | DetallTipus>('all')

  const load = async () => {
    try {
      const [transRes, clientsRes] = await Promise.all([
        fetch('http://localhost:3001/api/transaccions'),
        fetch('http://localhost:3001/api/clients/actius'),
      ])

      if (!transRes.ok) throw new Error('Error carregant transaccions')
      if (!clientsRes.ok) throw new Error('Error carregant clients')

      const all: (Transaccio & { tipus: string })[] = await transRes.json()
      const clientsData: Client[] = await clientsRes.json()

      setTransaccions(all.filter(t => t.tipus === 'ingres'))
      setClients(clientsData)
      setForm(prev => (prev.clientId ? prev : { ...prev, clientId: clientsData[0]?._id || '' }))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    }
  }

  useEffect(() => { void load() }, [])

  const clientsById = useMemo(() => {
    const map = new Map<string, Client>()
    for (const client of clients) map.set(client._id, client)
    return map
  }, [clients])

  const availableTipusFiscals = useMemo(() => {
    const tipus = new Set<DetallTipus>()
    for (const t of transaccions) tipus.add(tipusFiscalFromTransaccio(t))
    return TIPUS_FISCALS_SELECTABLES.filter(t => tipus.has(t))
  }, [transaccions])

  const filteredTransaccions = useMemo(() => {
    if (selectedTipusFiscal === 'all') return transaccions
    return transaccions.filter(t => tipusFiscalFromTransaccio(t) === selectedTipusFiscal)
  }, [selectedTipusFiscal, transaccions])

  const totalPages = Math.max(1, Math.ceil(filteredTransaccions.length / pageSize))

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const total = filteredTransaccions.reduce((sum, transaccio) => sum + transaccio.import, 0)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, filteredTransaccions.length)
  const visibleTransaccions = filteredTransaccions.slice(startIndex, endIndex)

  const facturaPreview = useMemo(() => computeFactura(form), [form])
  const nominaPreview = useMemo(() => computeNomina(form), [form])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const payload = buildPayload(form)
      const res = await fetch('http://localhost:3001/api/transaccions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.missatge || 'Error afegint ingrés')
      }

      const created: Transaccio = await res.json()

      if (fitxerAdjunt && created._id) {
        const formData = new FormData()
        formData.append('fitxer', fitxerAdjunt)

        const uploadRes = await fetch(`http://localhost:3001/api/transaccions/${created._id}/upload`, {
          method: 'POST',
          body: formData,
        })

        if (!uploadRes.ok) {
          const uploadBody = await uploadRes.json().catch(() => null)
          throw new Error(uploadBody?.missatge || 'Ingrés creat, però no s\'ha pogut pujar l\'adjunt')
        }
      }

      setFitxerAdjunt(null)
      setFileInputKey(prev => prev + 1)
      setForm(createEmptyForm(clients[0]?._id || ''))
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:3001/api/transaccions/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error eliminant ingrés')
      setTransaccions(prev => prev.filter(t => t._id !== id))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    }
  }

  const startEdit = (transaccio: Transaccio) => {
    setEditingId(transaccio._id)
    setEditForm({
      categoria: transaccio.categoria,
      clientId: transaccio.clientId || '',
      descripcio: transaccio.descripcio,
      import: String(transaccio.import),
      data: transaccio.data.slice(0, 10),
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const saveEdit = async (id: string) => {
    setSavingEdit(true)
    setError(null)
    try {
      const parsedImport = parseAmount(editForm.import)
      if (!editForm.descripcio.trim()) throw new Error('La descripció és obligatòria')
      if (!editForm.clientId) throw new Error('Has de seleccionar un client')
      if (parsedImport <= 0) {
        throw new Error('L\'import ha de ser major que 0')
      }

      const res = await fetch(`http://localhost:3001/api/transaccions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipus: 'ingres',
          categoria: editForm.categoria,
          clientId: editForm.clientId,
          descripcio: editForm.descripcio.trim(),
          import: parsedImport,
          data: editForm.data,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.missatge || 'Error actualitzant ingrés')
      }
      const updated: Transaccio = await res.json()

      setTransaccions(prev => prev.map(t => (t._id === id ? { ...t, ...updated } : t)))
      setEditingId(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    } finally {
      setSavingEdit(false)
    }
  }

  const analitzaPdfFactura = async () => {
    if (!fitxerAdjunt) {
      setError('Primer has de seleccionar un PDF')
      return
    }
    if (form.detallTipus !== 'factura') {
      setError('L\'autocompleció de Base/IVA/IRPF només està disponible per factures')
      return
    }

    setParsingPdf(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('fitxer', fitxerAdjunt)

      const res = await fetch('http://localhost:3001/api/transaccions/parse-factura-pdf', {
        method: 'POST',
        body: formData,
      })

      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.missatge || 'No s\'ha pogut analitzar el PDF')

      const parsed = body?.parsed || {}

      setForm(prev => ({
        ...prev,
        facturaBase: parsed.base != null ? String(parsed.base) : prev.facturaBase,
        facturaIvaPct: parsed.ivaPct != null ? String(parsed.ivaPct) : prev.facturaIvaPct,
        facturaIrpfPct: parsed.irpfPct != null ? String(parsed.irpfPct) : prev.facturaIrpfPct,
      }))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    } finally {
      setParsingPdf(false)
    }
  }

  return (
    <section>
      <h2>Ingressos</h2>
      <p className="page-description">Registre de totes les entrades de diners amb client obligatori i tipus fiscal seleccionable per l'usuari.</p>

      {error && <p style={{ color: '#ef4444' }}>⚠ {error}</p>}

      <form className="form-transaccio" onSubmit={handleSubmit}>
        <div className="form-row">
          <label>
            Tipus fiscal
            <div className="tipus-radio-group" role="radiogroup" aria-label="Tipus fiscal">
              {TIPUS_FISCALS_SELECTABLES.map(t => (
                <label key={t} className={`tipus-radio ${form.detallTipus === t ? 'tipus-radio--active' : ''}`}>
                  <input
                    className="tipus-radio__input"
                    type="radio"
                    name="tipusFiscal"
                    value={t}
                    checked={form.detallTipus === t}
                    onChange={() => setForm(prev => ({ ...prev, detallTipus: t }))}
                  />
                  <span className="tipus-radio__label">{labelTipusFiscal(t)}</span>
                </label>
              ))}
            </div>
          </label>

          <label>
            Client *
            <select
              required
              value={form.clientId}
              onChange={e => setForm(prev => ({ ...prev, clientId: e.target.value }))}
            >
              <option value="">Selecciona client</option>
              {clients.map(c => (
                <option key={c._id} value={c._id}>{clientLabel(c)}</option>
              ))}
            </select>
          </label>

          <label>
            Descripció *
            <input
              type="text"
              required
              value={form.descripcio}
              onChange={e => setForm(prev => ({ ...prev, descripcio: e.target.value }))}
              placeholder="Concepte de l'ingrés"
            />
          </label>

          <label>
            Data
            <input
              type="date"
              required
              value={form.data}
              onChange={e => setForm(prev => ({ ...prev, data: e.target.value }))}
            />
          </label>
        </div>

        {form.detallTipus === 'factura' && (
          <div className="fiscal-box">
            <div className="form-row">
              <label>
                Base factura (€)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={form.facturaBase}
                  onChange={e => setForm(prev => ({ ...prev, facturaBase: e.target.value }))}
                />
              </label>

              <label>
                IVA (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={form.facturaIvaPct}
                  onChange={e => setForm(prev => ({ ...prev, facturaIvaPct: e.target.value }))}
                />
              </label>

              <label>
                IRPF (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={form.facturaIrpfPct}
                  onChange={e => setForm(prev => ({ ...prev, facturaIrpfPct: e.target.value }))}
                />
              </label>

              <label>
                Import cobrat (€)
                <input type="number" value={facturaPreview.totalFactura.toFixed(2)} readOnly />
              </label>
            </div>

            <div className="fiscal-summary">
              <span className="fiscal-chip">IVA repercutit: {fmt(facturaPreview.ivaImport)}</span>
              <span className="fiscal-chip">IRPF retingut: {fmt(facturaPreview.irpfImport)}</span>
              <span className="fiscal-chip">Total factura: {fmt(facturaPreview.totalFactura)}</span>
            </div>
          </div>
        )}

        {form.detallTipus === 'nomina' && (
          <div className="fiscal-box">
            <div className="form-row">
              <label>
                Mode nòmina
                <select
                  value={form.nominaMode}
                  onChange={e => setForm(prev => ({ ...prev, nominaMode: e.target.value as NominaMode }))}
                >
                  <option value="net">Només net</option>
                  <option value="brut">Sou brut</option>
                  <option value="base">Sou base + complements</option>
                </select>
              </label>

              {form.nominaMode === 'base' && (
                <>
                  <label>
                    Sou base (€)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.nominaBaseSou}
                      onChange={e => setForm(prev => ({ ...prev, nominaBaseSou: e.target.value }))}
                    />
                  </label>

                  <label>
                    Complements (€)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.nominaComplements}
                      onChange={e => setForm(prev => ({ ...prev, nominaComplements: e.target.value }))}
                    />
                  </label>
                </>
              )}

              {form.nominaMode === 'brut' && (
                <label>
                  Sou brut (€)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.nominaBrut}
                    onChange={e => setForm(prev => ({ ...prev, nominaBrut: e.target.value }))}
                  />
                </label>
              )}

              {form.nominaMode === 'net' && (
                <label>
                  Sou net cobrat (€)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.nominaNet}
                    onChange={e => setForm(prev => ({ ...prev, nominaNet: e.target.value }))}
                  />
                </label>
              )}

              <label>
                IRPF nòmina (€)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.nominaIrpfImport}
                  onChange={e => setForm(prev => ({ ...prev, nominaIrpfImport: e.target.value }))}
                />
              </label>

              <label>
                SS treballador (€)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.nominaSsImport}
                  onChange={e => setForm(prev => ({ ...prev, nominaSsImport: e.target.value }))}
                />
              </label>

              <label>
                Altres deduccions (€)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.nominaAltresDeduccions}
                  onChange={e => setForm(prev => ({ ...prev, nominaAltresDeduccions: e.target.value }))}
                />
              </label>
            </div>

            <div className="fiscal-summary">
              <span className="fiscal-chip">Brut: {fmt(nominaPreview.brut)}</span>
              <span className="fiscal-chip">Net cobrat: {fmt(nominaPreview.net)}</span>
              <span className="fiscal-chip">Deduccions: {fmt(nominaPreview.irpfImport + nominaPreview.ssImport + nominaPreview.altresDeduccions)}</span>
            </div>
          </div>
        )}

        <div className="form-row fiscal-box" style={{ marginTop: '0.75rem' }}>
          <label>
            Adjunt (PDF, imatge, Excel...)
            <input
              key={fileInputKey}
              type="file"
              onChange={e => setFitxerAdjunt(e.target.files?.[0] || null)}
            />
          </label>
          <button
            type="button"
            className="btn-page"
            disabled={!fitxerAdjunt || form.detallTipus !== 'factura' || parsingPdf}
            onClick={() => {
              void analitzaPdfFactura()
            }}
          >
            {parsingPdf ? 'Analitzant PDF...' : 'Llegir PDF i autoemplenar'}
          </button>
          <span className="fiscal-note">
            Opcional. Es guardarà vinculat a aquesta factura o nòmina. Si és una factura en PDF, pots autoemplenar Base/IVA/IRPF.
          </span>
        </div>

        <div className="fiscal-actions">
          <button type="submit" className="btn btn--income" disabled={submitting || clients.length === 0}>
            + Afegir ingrés
          </button>
          <span className="fiscal-note">Tipus fiscal seleccionable manualment. Client i descripció són obligatoris.</span>
        </div>

        {clients.length === 0 && (
          <p style={{ color: '#ef4444', marginTop: '0.75rem' }}>
            No hi ha clients actius. Crea primer un client per poder registrar ingressos.
          </p>
        )}
      </form>

      {transaccions.length === 0 ? (
        <p style={{ color: '#64748b', marginTop: '1.5rem' }}>Cap ingrés registrat encara.</p>
      ) : (
        <>
          <div className="list-controls" style={{ marginTop: '1.5rem' }}>
            <label className="list-controls__label">
              Tipus fiscal
              <select
                value={selectedTipusFiscal}
                onChange={e => {
                  setSelectedTipusFiscal(e.target.value as 'all' | DetallTipus)
                  setCurrentPage(1)
                }}
              >
                <option value="all">Totes</option>
                {availableTipusFiscals.map(t => <option key={t} value={t}>{labelTipusFiscal(t)}</option>)}
              </select>
            </label>

            <label className="list-controls__label">
              Mostrar
              <select
                value={pageSize}
                onChange={e => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
              >
                <option value={10}>10</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              registres
            </label>

            <div className="pagination">
              <button
                type="button"
                className="btn-page"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
              >
                Anterior
              </button>
              <span className="pagination__info">
                {filteredTransaccions.length === 0
                  ? '0 resultats amb aquest filtre'
                  : `Pàgina ${currentPage} de ${totalPages} · ${startIndex + 1}-${endIndex} de ${filteredTransaccions.length}`}
              </span>
              <button
                type="button"
                className="btn-page"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
              >
                Següent
              </button>
            </div>
          </div>

          {filteredTransaccions.length === 0 ? (
            <p style={{ color: '#64748b', marginTop: '1rem' }}>Cap ingrés amb el tipus fiscal seleccionat.</p>
          ) : (
            <table className="taula" style={{ marginTop: '1rem' }}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipus fiscal</th>
                  <th>Client</th>
                  <th>Descripció</th>
                  <th>Adjunt</th>
                  <th>Import</th>
                  <th>Detall fiscal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibleTransaccions.map(transaccio => (
                  <tr key={transaccio._id}>
                    {editingId === transaccio._id ? (
                      <>
                        <td>
                          <input
                            className="row-edit-input"
                            type="date"
                            value={editForm.data}
                            onChange={e => setEditForm(prev => ({ ...prev, data: e.target.value }))}
                          />
                        </td>
                        <td>
                          <input className="row-edit-input" type="text" value={labelTipusFiscal(tipusFiscalFromTransaccio(transaccio))} readOnly />
                        </td>
                        <td>
                          <select
                            className="row-edit-input"
                            value={editForm.clientId}
                            onChange={e => setEditForm(prev => ({ ...prev, clientId: e.target.value }))}
                          >
                            <option value="">Selecciona client</option>
                            {clients.map(c => <option key={c._id} value={c._id}>{clientLabel(c)}</option>)}
                          </select>
                        </td>
                        <td>
                          <input
                            className="row-edit-input"
                            type="text"
                            value={editForm.descripcio}
                            onChange={e => setEditForm(prev => ({ ...prev, descripcio: e.target.value }))}
                            placeholder="Obligatori"
                          />
                        </td>
                        <td className="fiscal-detail">No editable</td>
                        <td>
                          <input
                            className="row-edit-input"
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={editForm.import}
                            onChange={e => setEditForm(prev => ({ ...prev, import: e.target.value }))}
                          />
                        </td>
                        <td className="fiscal-detail">El detall fiscal actual es conserva. Aquesta versió edita els camps principals.</td>
                        <td className="row-actions">
                          <button
                            type="button"
                            className="btn-page"
                            disabled={savingEdit}
                            onClick={() => saveEdit(transaccio._id)}
                          >
                            Guardar
                          </button>
                          <button type="button" className="btn-page" disabled={savingEdit} onClick={cancelEdit}>
                            Cancel·lar
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{new Date(transaccio.data).toLocaleDateString('ca-ES')}</td>
                        <td>{labelTipusFiscal(tipusFiscalFromTransaccio(transaccio))}</td>
                        <td>{transaccio.clientId && clientsById.has(transaccio.clientId) ? clientLabel(clientsById.get(transaccio.clientId) as Client) : '—'}</td>
                        <td>{transaccio.descripcio || '—'}</td>
                        <td>{transaccio.adjunts?.length ? `📎 ${transaccio.adjunts.length}` : '—'}</td>
                        <td className="positiu">+{fmt(transaccio.import)}</td>
                        <td className="fiscal-detail">{formatDetallFiscal(transaccio)}</td>
                        <td className="row-actions">
                          <button type="button" className="btn-page" onClick={() => startEdit(transaccio)}>Editar</button>
                          <button type="button" className="btn-delete" onClick={() => handleDelete(transaccio._id)} title="Eliminar">✕</button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} style={{ color: '#64748b', fontWeight: 600, paddingTop: '0.75rem' }}>Total cobrat</td>
                  <td className="positiu" style={{ paddingTop: '0.75rem' }}>+{fmt(total)}</td>
                  <td></td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}
        </>
      )}
    </section>
  )
}
