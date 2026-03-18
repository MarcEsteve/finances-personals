import { useEffect, useState } from 'react'

interface Transaccio {
  _id: string
  categoria: string
  descripcio: string
  import: number
  data: string
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

function fmt(n: number) {
  return n.toLocaleString('ca-ES', { minimumFractionDigits: 2 }) + ' €'
}

const avui = () => new Date().toISOString().slice(0, 10)

export default function Estalvis() {
  const [transaccions, setTransaccions] = useState<Transaccio[]>([])
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ categoria: CATEGORIES[0], descripcio: '', import: '', data: avui() })
  const [submitting, setSubmitting] = useState(false)
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)

  const load = () => {
    fetch('http://localhost:3001/api/transaccions')
      .then(res => {
        if (!res.ok) throw new Error('Error carregant dades')
        return res.json()
      })
      .then((all: (Transaccio & { tipus: string })[]) =>
        setTransaccions(all.filter(t => t.tipus === 'estalvi'))
      )
      .catch(err => setError(err.message))
  }

  useEffect(() => { load() }, [])

  const totalPages = Math.max(1, Math.ceil(transaccions.length / pageSize))

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const total = transaccions.reduce((s, t) => s + t.import, 0)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, transaccions.length)
  const visibleTransaccions = transaccions.slice(startIndex, endIndex)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:3001/api/transaccions/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error eliminant moviment d\'estalvi')
      setTransaccions(prev => prev.filter(t => t._id !== id))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    }
  }

  return (
    <section>
      <h2>Estalvis</h2>
      <p className="page-description">Moviments d'estalvi o inversió que surten de caixa però no són despesa de consum.</p>

      {error && <p style={{ color: '#ef4444' }}>⚠ {error}</p>}

      <form className="form-transaccio" onSubmit={handleSubmit}>
        <div className="form-row">
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
        </div>
      </form>

      {transaccions.length === 0 ? (
        <p style={{ color: '#64748b', marginTop: '1.5rem' }}>Cap moviment d'estalvi registrat encara.</p>
      ) : (
        <>
          <div className="list-controls" style={{ marginTop: '1.5rem' }}>
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
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              >
                Anterior
              </button>
              <span className="pagination__info">
                Pàgina {currentPage} de {totalPages} · {startIndex + 1}-{endIndex} de {transaccions.length}
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
                  <td>{new Date(t.data).toLocaleDateString('ca-ES')}</td>
                  <td>{t.categoria}</td>
                  <td>{t.descripcio || '—'}</td>
                  <td className="negatiu">-{fmt(t.import)}</td>
                  <td>
                    <button type="button" className="btn-delete" onClick={() => handleDelete(t._id)} title="Eliminar">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} style={{ color: '#64748b', fontWeight: 600, paddingTop: '0.75rem' }}>Total estalvi/inversió</td>
                <td className="negatiu" style={{ paddingTop: '0.75rem' }}>-{fmt(total)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </>
      )}
    </section>
  )
}
