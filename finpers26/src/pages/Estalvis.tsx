import { useEffect, useMemo, useState } from 'react'

interface DetallCripto {
  moneda: string
  quantitat: number
  preuUnitariEuro: number
  totalEuro: number
  dataActualitzacio: string
}

interface Transaccio {
  _id: string
  categoria: string
  descripcio: string
  import: number
  data: string
  detallCripto?: DetallCripto
}

const CATEGORIES = [
  'Fons emergència',
  'Béns immobles',
  'Immobles tokenitzats (Equito)',
  'Inversió indexada',
  'ETFs',
  'Accions',
  'Renda fixa / Bons',
  'Pla pensions',
  'Crowdlending / P2P',
  'Cripto',
  'Altres',
]

const MONEDES_CRIPTO = ['Bitcoin', 'Ethereum', 'Altres']

const BITCOIN_UNITS = {
  BTC: 1,
  mBTC: 0.001,
  Satoshi: 0.00000001,
}

type BitcoinUnit = keyof typeof BITCOIN_UNITS

// Conversions entre unitats de Bitcoin
function convertBitcoin(valor: number, desdeCripto: BitcoinUnit, aUnitatExibicio: BitcoinUnit): number {
  const enBTC = valor * BITCOIN_UNITS[desdeCripto]
  return enBTC / BITCOIN_UNITS[aUnitatExibicio]
}

// Formateja quantitats de Bitcoin
function fmtBTC(valor: number, unitat: BitcoinUnit = 'BTC'): string {
  return valor.toLocaleString('ca-ES', { minimumFractionDigits: 8, maximumFractionDigits: 8 }) + ` ${unitat}`
}

function fmt(n: number) {
  return n.toLocaleString('ca-ES', { minimumFractionDigits: 2 }) + ' €'
}

const avui = () => new Date().toISOString().slice(0, 10)

export default function Estalvis() {
  const [transaccions, setTransaccions] = useState<Transaccio[]>([])
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ categoria: CATEGORIES[0], descripcio: '', import: '', data: avui() })
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ categoria: CATEGORIES[0], descripcio: '', import: '', data: avui() })
  const [savingEdit, setSavingEdit] = useState(false)
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedCategory, setSelectedCategory] = useState('all')

  // Cripto
  const [usarCripto, setUsarCripto] = useState(false)
  const [criptoForm, setCriptoForm] = useState({ moneda: 'Bitcoin', quantitat: '', descripcio: '', data: avui() })
  const [unitatCripto, setUnitatCripto] = useState<BitcoinUnit>('BTC')
  const [preciosCripto, setPreciosCripto] = useState<{ [key: string]: number }>({})
  const [actualizandoCriptos, setActualizandoCriptos] = useState(false)

  const load = () => {
    fetch('http://localhost:3001/api/transaccions')
      .then(res => {
        if (!res.ok) throw new Error('Error carregant dades')
        return res.json()
      })
      .then((all: (Transaccio & { tipus: string })[]) => {
        setTransaccions(all.filter(t => t.tipus === 'estalvi'))
        carregaPreciosCripto()
      })
      .catch(err => setError(err.message))
  }

  const carregaPreciosCripto = async () => {
    try {
      for (const moneda of ['Bitcoin', 'Ethereum']) {
        const res = await fetch(`http://localhost:3001/api/cotitzacions/${moneda}`)
        if (res.ok) {
          const data = await res.json()
          setPreciosCripto(prev => ({ ...prev, [moneda]: data.preuEuro }))
        }
      }
    } catch (err) {
      console.error('Error carregant preus:', err)
    }
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

  const total = filteredTransaccions.reduce((s, t) => s + t.import, 0)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, filteredTransaccions.length)
  const visibleTransaccions = filteredTransaccions.slice(startIndex, endIndex)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (usarCripto) {
      return handleSubmitCripto(e)
    }

    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('http://localhost:3001/api/transaccions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipus: 'estalvi',
          categoria: form.categoria,
          descripcio: form.descripcio,
          import: parseFloat(form.import),
          data: form.data,
        }),
      })
      if (!res.ok) throw new Error('Error afegint moviment d\'estalvi')
      setForm({ categoria: CATEGORIES[0], descripcio: '', import: '', data: avui() })
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitCripto = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      if (!criptoForm.quantitat || parseFloat(criptoForm.quantitat) <= 0) {
        throw new Error('La quantitat ha de ser major que 0')
      }

      // Convertim a BTC per emmagatzemar a BD
      const quantitatEnBTC = convertBitcoin(parseFloat(criptoForm.quantitat), unitatCripto, 'BTC')

      const res = await fetch('http://localhost:3001/api/transaccions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipus: 'estalvi',
          categoria: 'Cripto',
          descripcio: criptoForm.descripcio,
          import: 0,
          data: criptoForm.data,
          detallCripto: {
            moneda: criptoForm.moneda,
            quantitat: quantitatEnBTC,
          },
        }),
      })
      if (!res.ok) throw new Error('Error afegint criptomoneda')
      setCriptoForm({ moneda: 'Bitcoin', quantitat: '', descripcio: '', data: avui() })
      setUnitatCripto('BTC')
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    } finally {
      setSubmitting(false)
    }
  }

  const actualitzaCriptos = async () => {
    setActualizandoCriptos(true)
    setError(null)
    try {
      const res = await fetch('http://localhost:3001/api/actualitza-criptos', {
        method: 'PUT',
      })
      if (!res.ok) throw new Error('Error actualitzant cotitzacions')
      const data = await res.json()
      setError(null)
      load()
      alert(`✓ ${data.missatge}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    } finally {
      setActualizandoCriptos(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:3001/api/transaccions/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error eliminant moviment d\'estalvi')
      setTransaccions(prev => prev.filter(t => t._id !== id))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    }
  }

  const startEdit = (t: Transaccio) => {
    setEditingId(t._id)
    setEditForm({
      categoria: t.categoria,
      descripcio: t.descripcio,
      import: String(t.import),
      data: t.data.slice(0, 10),
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const saveEdit = async (id: string) => {
    setSavingEdit(true)
    setError(null)
    try {
      const parsedImport = parseFloat(editForm.import)
      if (Number.isNaN(parsedImport) || parsedImport <= 0) {
        throw new Error('L\'import ha de ser major que 0')
      }

      const res = await fetch(`http://localhost:3001/api/transaccions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipus: 'estalvi',
          categoria: editForm.categoria,
          descripcio: editForm.descripcio,
          import: parsedImport,
          data: editForm.data,
        }),
      })

      if (!res.ok) throw new Error('Error actualitzant moviment d\'estalvi')
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
      <h2>Estalvis</h2>
      <p className="page-description">Moviments d'estalvi o inversió que surten de caixa però no són despesa de consum.</p>

      {error && <p style={{ color: '#ef4444' }}>⚠ {error}</p>}

      <form className="form-transaccio" onSubmit={handleSubmit}>
        <div className="form-row">
          {!usarCripto ? (
            <>
              <label>
                Categoria
                <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label>
                Descripció
                <input
                  type="text"
                  value={form.descripcio}
                  onChange={e => setForm(f => ({ ...f, descripcio: e.target.value }))}
                  placeholder="Opcional"
                />
              </label>
              <label>
                Import (€)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={form.import}
                  onChange={e => setForm(f => ({ ...f, import: e.target.value }))}
                  placeholder="0,00"
                />
              </label>
              <label>
                Data
                <input
                  type="date"
                  required
                  value={form.data}
                  onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                />
              </label>
              <button type="submit" className="btn btn--savings" disabled={submitting}>
                + Afegir moviment
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setUsarCripto(true)}
                style={{ backgroundColor: '#f59e0b' }}
              >
                ₿ Afegir cripto
              </button>
            </>
          ) : (
            <>
              <label>
                Moneda
                <select value={criptoForm.moneda} onChange={e => setCriptoForm(f => ({ ...f, moneda: e.target.value }))}>
                  {MONEDES_CRIPTO.map(m => <option key={m}>{m}</option>)}
                </select>
              </label>
              <label>
                Unitat
                <select value={unitatCripto} onChange={e => setUnitatCripto(e.target.value as BitcoinUnit)}>
                  <option value="BTC">BTC</option>
                  <option value="mBTC">mBTC (millibitcoin)</option>
                  <option value="Satoshi">Satoshi</option>
                </select>
              </label>
              <label>
                Quantitat ({unitatCripto})
                <input
                  type="number"
                  min={unitatCripto === 'Satoshi' ? '1' : '0.00000001'}
                  step={unitatCripto === 'Satoshi' ? '1' : '0.00000001'}
                  required
                  value={criptoForm.quantitat}
                  onChange={e => setCriptoForm(f => ({ ...f, quantitat: e.target.value }))}
                  placeholder={unitatCripto === 'Satoshi' ? '100000000' : '0.5'}
                />
              </label>

              {criptoForm.quantitat && parseFloat(criptoForm.quantitat) > 0 && (
                <label style={{ color: '#10b981', fontWeight: 600, fontSize: '0.95em', lineHeight: '1.4' }}>
                  ✓ {parseFloat(criptoForm.quantitat).toFixed(8)} {unitatCripto}
                  <br />
                  = {convertBitcoin(parseFloat(criptoForm.quantitat), unitatCripto, 'BTC').toFixed(8)} BTC
                  <br />
                  = {convertBitcoin(parseFloat(criptoForm.quantitat), unitatCripto, 'mBTC').toFixed(3)} mBTC
                  {unitatCripto !== 'Satoshi' && (
                    <>
                      <br />= {convertBitcoin(parseFloat(criptoForm.quantitat), unitatCripto, 'Satoshi').toFixed(0)} Satoshi
                    </>
                  )}
                </label>
              )}

              {criptoForm.moneda !== 'Altres' && preciosCripto[criptoForm.moneda] && (
                <label style={{ color: '#0ea5e9', fontWeight: 600 }}>
                  Preu actual: {fmt(preciosCripto[criptoForm.moneda])} / BTC
                </label>
              )}
              <label>
                Descripció
                <input
                  type="text"
                  value={criptoForm.descripcio}
                  onChange={e => setCriptoForm(f => ({ ...f, descripcio: e.target.value }))}
                  placeholder="Opcional"
                />
              </label>
              <label>
                Data
                <input
                  type="date"
                  required
                  value={criptoForm.data}
                  onChange={e => setCriptoForm(f => ({ ...f, data: e.target.value }))}
                />
              </label>
              <button type="submit" className="btn btn--savings" disabled={submitting}>
                + Afegir {criptoForm.moneda}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setUsarCripto(false)}
                style={{ backgroundColor: '#6366f1' }}
              >
                ← Tornar
              </button>
            </>
          )}
        </div>
      </form>

      {transaccions.length === 0 ? (
        <p style={{ color: '#64748b', marginTop: '1.5rem' }}>Cap moviment d'estalvi registrat encara.</p>
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

            {transaccions.some(t => t.detallCripto) && (
              <button
                type="button"
                className="btn"
                onClick={actualitzaCriptos}
                disabled={actualizandoCriptos}
                style={{ backgroundColor: '#f59e0b', marginLeft: '1rem' }}
              >
                {actualizandoCriptos ? '⟳ Actualitzant...' : '⟳ Actualitzar preus cripto'}
              </button>
            )}

            <div className="pagination">
              <button
                type="button"
                className="btn-page"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
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
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              >
                Següent
              </button>
            </div>
          </div>

          {filteredTransaccions.length === 0 ? (
            <p style={{ color: '#64748b', marginTop: '1rem' }}>Cap moviment amb la categoria seleccionada.</p>
          ) : (
            <table className="taula" style={{ marginTop: '1rem' }}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Categoria</th>
                  <th>Descripció</th>
                  <th>Import</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
              {visibleTransaccions.map(t => (
                <tr key={t._id}>
                  {editingId === t._id ? (
                    <>
                      <td>
                        <input
                          className="row-edit-input"
                          type="date"
                          value={editForm.data}
                          onChange={e => setEditForm(f => ({ ...f, data: e.target.value }))}
                        />
                      </td>
                      <td>
                        <select
                          className="row-edit-input"
                          value={editForm.categoria}
                          onChange={e => setEditForm(f => ({ ...f, categoria: e.target.value }))}
                        >
                          {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td>
                        <input
                          className="row-edit-input"
                          type="text"
                          value={editForm.descripcio}
                          onChange={e => setEditForm(f => ({ ...f, descripcio: e.target.value }))}
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
                          onChange={e => setEditForm(f => ({ ...f, import: e.target.value }))}
                        />
                      </td>
                      <td className="row-actions">
                        <button
                          type="button"
                          className="btn-page"
                          disabled={savingEdit}
                          onClick={() => saveEdit(t._id)}
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
                      <td>{new Date(t.data).toLocaleDateString('ca-ES')}</td>
                      <td>
                        {t.detallCripto ? (
                          <span style={{ fontWeight: 600, color: '#0ea5e9' }}>₿ {t.detallCripto.moneda}</span>
                        ) : (
                          t.categoria
                        )}
                      </td>
                      <td>
                        {t.detallCripto ? (
                          <span>
                            {fmtBTC(convertBitcoin(t.detallCripto.quantitat, 'BTC', 'mBTC'), 'mBTC')}
                            <br />
                            <small style={{ color: '#64748b', fontSize: '0.85em' }}>
                              ({fmtBTC(t.detallCripto.quantitat, 'BTC')})
                            </small>
                            {t.descripcio && (
                              <>
                                <br />
                                <small style={{ color: '#64748b' }}>{t.descripcio}</small>
                              </>
                            )}
                            <br />
                            <small style={{ color: '#64748b', fontSize: '0.85em' }}>
                              {fmt(t.detallCripto.preuUnitariEuro)} / BTC · Actualitzat{' '}
                              {new Date(t.detallCripto.dataActualitzacio).toLocaleDateString('ca-ES')}
                            </small>
                          </span>
                        ) : (
                          t.descripcio || '—'
                        )}
                      </td>
                      <td className="positiu">+{fmt(t.import)}</td>
                      <td className="row-actions">
                        <button type="button" className="btn-page" onClick={() => startEdit(t)}>Editar</button>
                        <button type="button" className="btn-delete" onClick={() => handleDelete(t._id)} title="Eliminar">✕</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} style={{ color: '#64748b', fontWeight: 600, paddingTop: '0.75rem' }}>Total</td>
                <td className="positiu" style={{ paddingTop: '0.75rem' }}>+{fmt(total)}</td>
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
