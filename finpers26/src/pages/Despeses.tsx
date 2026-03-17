import { useEffect, useState } from 'react'

interface Transaccio {
  _id: string
  categoria: string
  descripcio: string
  import: number
  data: string
}

const CATEGORIES = ['Habitatge', 'Alimentació', 'Transport', 'Lleure', 'Salut', 'Subscripcions', 'Altres']

function fmt(n: number) {
  return n.toLocaleString('ca-ES', { minimumFractionDigits: 2 }) + ' €'
}

const avui = () => new Date().toISOString().slice(0, 10)

export default function Despeses() {
  const [transaccions, setTransaccions] = useState<Transaccio[]>([])
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ categoria: CATEGORIES[0], descripcio: '', import: '', data: avui() })
  const [submitting, setSubmitting] = useState(false)

  const load = () => {
    fetch('http://localhost:3001/api/transaccions')
      .then(res => {
        if (!res.ok) throw new Error('Error carregant dades')
        return res.json()
      })
      .then((all: (Transaccio & { tipus: string })[]) =>
        setTransaccions(all.filter(t => t.tipus === 'despesa'))
      )
      .catch(err => setError(err.message))
  }

  useEffect(() => { load() }, [])

  const total = transaccions.reduce((s, t) => s + t.import, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('http://localhost:3001/api/transaccions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipus: 'despesa',
          categoria: form.categoria,
          descripcio: form.descripcio,
          import: parseFloat(form.import),
          data: form.data,
        }),
      })
      if (!res.ok) throw new Error('Error afegint despesa')
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
      if (!res.ok) throw new Error('Error eliminant despesa')
      setTransaccions(prev => prev.filter(t => t._id !== id))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    }
  }

  return (
    <section>
      <h2>Despeses</h2>
      <p className="page-description">Registre de despeses per categories: habitatge, alimentació, transport, lleure, salut, subscripcions i altres.</p>

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
          <button type="submit" className="btn btn--expense" disabled={submitting}>
            + Afegir despesa
          </button>
        </div>
      </form>

      {transaccions.length === 0 ? (
        <p style={{ color: '#64748b', marginTop: '1.5rem' }}>Cap despesa registrada encara.</p>
      ) : (
        <table className="taula" style={{ marginTop: '1.5rem' }}>
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
            {transaccions.map(t => (
              <tr key={t._id}>
                <td>{new Date(t.data).toLocaleDateString('ca-ES')}</td>
                <td>{t.categoria}</td>
                <td>{t.descripcio || '—'}</td>
                <td className="negatiu">-{fmt(t.import)}</td>
                <td>
                  <button className="btn-delete" onClick={() => handleDelete(t._id)} title="Eliminar">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} style={{ color: '#64748b', fontWeight: 600, paddingTop: '0.75rem' }}>Total</td>
              <td className="negatiu" style={{ paddingTop: '0.75rem' }}>-{fmt(total)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      )}
    </section>
  )
}
