import { useEffect, useMemo, useState } from 'react'

interface Transaccio {
  _id: string
  categoria: string
  descripcio: string
  import: number
  data: string
}

const CATEGORIES = ['Nòmina', 'Freelance', 'Rendiments', 'Bonus', 'Altres']

function fmt(n: number) {
  return n.toLocaleString('ca-ES', { minimumFractionDigits: 2 }) + ' €'
}

const avui = () => new Date().toISOString().slice(0, 10)

export default function Ingressos() {
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

  const total = filteredTransaccions.reduce((s, t) => s + t.import, 0)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, filteredTransaccions.length)
  const visibleTransaccions = filteredTransaccions.slice(startIndex, endIndex)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('http://localhost:3001/api/transaccions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipus: 'ingres',
          categoria: form.categoria,
          descripcio: form.descripcio,
          import: parseFloat(form.import),
          data: form.data,
        }),
      })
      if (!res.ok) throw new Error('Error afegint ingrés')
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
      if (!res.ok) throw new Error('Error eliminant ingrés')
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
      <p className="page-description">Registre de totes les entrades de diners: nòmina, freelance, rendiments i altres fonts.</p>

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
          <button type="submit" className="btn btn--income" disabled={submitting}>
            + Afegir ingrés
          </button>
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
            <p style={{ color: '#64748b', marginTop: '1rem' }}>Cap ingrés amb la categoria seleccionada.</p>
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
                        <td>{t.categoria}</td>
                        <td>{t.descripcio || '—'}</td>
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
