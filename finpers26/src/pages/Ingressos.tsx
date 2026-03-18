import { useEffect, useMemo, useState } from 'react'

type DetallTipus = 'general' | 'factura' | 'nomina'
type NominaMode = 'net' | 'brut' | 'base'

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
  detallIngres?: DetallIngres
}

const CATEGORIES = ['Nòmina', 'Freelance', 'Rendiments', 'Bonus', 'Altres']

function fmt(n: number) {
  return n.toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function parseAmount(value: string) {
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function defaultDetailTypeByCategory(categoria: string): DetallTipus {
  if (categoria === 'Freelance') return 'factura'
  if (categoria === 'Nòmina') return 'nomina'
  return 'general'
}

const avui = () => new Date().toISOString().slice(0, 10)

function createEmptyForm(categoria = CATEGORIES[0]) {
  return {
    categoria,
    detallTipus: defaultDetailTypeByCategory(categoria),
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
  if (form.detallTipus === 'factura') {
    const factura = computeFactura(form)
    if (factura.base <= 0) throw new Error('La base de la factura ha de ser major que 0')

    return {
      tipus: 'ingres',
      categoria: form.categoria,
      descripcio: form.descripcio,
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
      categoria: form.categoria,
      descripcio: form.descripcio,
      import: nomina.net,
      data: form.data,
      detallIngres: {
        tipus: 'nomina' as DetallTipus,
        nomina,
      },
    }
  }

  const parsedImport = parseAmount(form.import)
  if (parsedImport <= 0) throw new Error('L\'import ha de ser major que 0')

  return {
    tipus: 'ingres',
    categoria: form.categoria,
    descripcio: form.descripcio,
    import: parsedImport,
    data: form.data,
    detallIngres: {
      tipus: 'general' as DetallTipus,
    },
  }
}

function formatDetallFiscal(transaccio: Transaccio) {
  if (transaccio.detallIngres?.tipus === 'factura' && transaccio.detallIngres.factura) {
    const factura = transaccio.detallIngres.factura
    return `Factura · Base ${fmt(factura.base || 0)} · IVA ${fmt(factura.ivaImport || 0)} · IRPF ${fmt(factura.irpfImport || 0)}`
  }

  if (transaccio.detallIngres?.tipus === 'nomina' && transaccio.detallIngres.nomina) {
    const nomina = transaccio.detallIngres.nomina
    return `Nòmina ${nomina.mode || 'net'} · Brut ${fmt(nomina.brut || 0)} · IRPF ${fmt(nomina.irpfImport || 0)} · SS ${fmt(nomina.ssImport || 0)}`
  }

  return 'Sense detall fiscal'
}

export default function Ingressos() {
  const [transaccions, setTransaccions] = useState<Transaccio[]>([])
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(createEmptyForm())
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ categoria: CATEGORIES[0], descripcio: '', import: '', data: avui() })
  const [savingEdit, setSavingEdit] = useState(false)
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedCategory, setSelectedCategory] = useState('all')

  const load = () => {
    fetch('http://localhost:3001/api/transaccions')
      .then(res => {
        if (!res.ok) throw new Error('Error carregant dades')
        return res.json()
      })
      .then((all: (Transaccio & { tipus: string })[]) =>
        setTransaccions(all.filter(t => t.tipus === 'ingres'))
      )
      .catch(err => setError(err.message))
  }

  useEffect(() => { load() }, [])

  const availableCategories = useMemo(() => {
    const categories = new Set<string>(CATEGORIES)
    for (const t of transaccions) categories.add(t.categoria)
    return Array.from(categories)
  }, [transaccions])

  const filteredTransaccions = useMemo(() => {
    if (selectedCategory === 'all') return transaccions
    return transaccions.filter(t => t.categoria === selectedCategory)
  }, [selectedCategory, transaccions])

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
      if (!res.ok) throw new Error('Error afegint ingrés')
      setForm(createEmptyForm())
      load()
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
      if (parsedImport <= 0) {
        throw new Error('L\'import ha de ser major que 0')
      }

      const res = await fetch(`http://localhost:3001/api/transaccions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipus: 'ingres',
          categoria: editForm.categoria,
          descripcio: editForm.descripcio,
          import: parsedImport,
          data: editForm.data,
        }),
      })

      if (!res.ok) throw new Error('Error actualitzant ingrés')
      const updated: Transaccio = await res.json()

      setTransaccions(prev => prev.map(t => (t._id === id ? { ...t, ...updated } : t)))
      setEditingId(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    } finally {
      setSavingEdit(false)
    }
  }

  return (
    <section>
      <h2>Ingressos</h2>
      <p className="page-description">Registre de totes les entrades de diners amb detall fiscal per factures freelance i nòmines.</p>

      {error && <p style={{ color: '#ef4444' }}>⚠ {error}</p>}

      <form className="form-transaccio" onSubmit={handleSubmit}>
        <div className="form-row">
          <label>
            Categoria
            <select
              value={form.categoria}
              onChange={e => {
                const categoria = e.target.value
                setForm(prev => ({ ...prev, categoria, detallTipus: defaultDetailTypeByCategory(categoria) }))
              }}
            >
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </label>

          <label>
            Tipus fiscal
            <select value={form.detallTipus} onChange={e => setForm(prev => ({ ...prev, detallTipus: e.target.value as DetallTipus }))}>
              <option value="general">General</option>
              <option value="factura">Factura freelance</option>
              <option value="nomina">Nòmina</option>
            </select>
          </label>

          <label>
            Descripció
            <input
              type="text"
              value={form.descripcio}
              onChange={e => setForm(prev => ({ ...prev, descripcio: e.target.value }))}
              placeholder="Client, empresa o concepte"
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

        {form.detallTipus === 'general' && (
          <div className="form-row fiscal-box">
            <label>
              Import cobrat (€)
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={form.import}
                onChange={e => setForm(prev => ({ ...prev, import: e.target.value }))}
                placeholder="0,00"
              />
            </label>
          </div>
        )}

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

        <div className="fiscal-actions">
          <button type="submit" className="btn btn--income" disabled={submitting}>
            + Afegir ingrés
          </button>
          <span className="fiscal-note">L'import guardat és sempre el diner real cobrat. El detall fiscal s'usa per a impostos i anàlisi.</span>
        </div>
      </form>

      {transaccions.length === 0 ? (
        <p style={{ color: '#64748b', marginTop: '1.5rem' }}>Cap ingrés registrat encara.</p>
      ) : (
        <>
          <div className="list-controls" style={{ marginTop: '1.5rem' }}>
            <label className="list-controls__label">
              Categoria
              <select
                value={selectedCategory}
                onChange={e => {
                  setSelectedCategory(e.target.value)
                  setCurrentPage(1)
                }}
              >
                <option value="all">Totes</option>
                {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
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
            <p style={{ color: '#64748b', marginTop: '1rem' }}>Cap ingrés amb la categoria seleccionada.</p>
          ) : (
            <table className="taula" style={{ marginTop: '1rem' }}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Categoria</th>
                  <th>Descripció</th>
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
                          <select
                            className="row-edit-input"
                            value={editForm.categoria}
                            onChange={e => setEditForm(prev => ({ ...prev, categoria: e.target.value }))}
                          >
                            {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                        <td>
                          <input
                            className="row-edit-input"
                            type="text"
                            value={editForm.descripcio}
                            onChange={e => setEditForm(prev => ({ ...prev, descripcio: e.target.value }))}
                            placeholder="Opcional"
                          />
                        </td>
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
                        <td className="fiscal-detail">El detall fiscal actual es conserva. Aquesta primera versió només edita camps bàsics.</td>
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
                        <td>{transaccio.categoria}</td>
                        <td>{transaccio.descripcio || '—'}</td>
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
                  <td colSpan={3} style={{ color: '#64748b', fontWeight: 600, paddingTop: '0.75rem' }}>Total cobrat</td>
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
