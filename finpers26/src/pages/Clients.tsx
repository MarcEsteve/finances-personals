import { useEffect, useMemo, useState } from 'react'

interface Client {
  _id: string
  nom: string
  email: string
  telefon: string
  website: string
  nif: string
  razonSocial: string
  direccio: string
  codiPostal: string
  ciutat: string
  pais: string
  metodePagament: string
  diasPagament: number
  personaContacte: string
  actiu: boolean
  notes: string
}

const emptyClient = (): Omit<Client, '_id'> => ({
  nom: '',
  email: '',
  telefon: '',
  website: '',
  nif: '',
  razonSocial: '',
  direccio: '',
  codiPostal: '',
  ciutat: '',
  pais: 'Espanya',
  metodePagament: 'Transferència',
  diasPagament: 30,
  personaContacte: '',
  actiu: true,
  notes: '',
})

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([])
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(emptyClient())
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(emptyClient())
  const [savingEdit, setSavingEdit] = useState(false)
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [filtreActius, setFiltreActius] = useState(true)

  const load = () => {
    fetch('http://localhost:3001/api/clients')
      .then(res => {
        if (!res.ok) throw new Error('Error carregant clients')
        return res.json()
      })
      .then((data: Client[]) => setClients(data))
      .catch(err => setError(err.message))
  }

  useEffect(() => { load() }, [])

  const filteredClients = useMemo(() => {
    if (filtreActius) return clients.filter(c => c.actiu)
    return clients
  }, [filtreActius, clients])

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / pageSize))

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const startIndex = (currentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, filteredClients.length)
  const visibleClients = filteredClients.slice(startIndex, endIndex)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      if (!form.nif || !form.razonSocial || !form.direccio) {
        throw new Error('NIF, Raó Social i Adreça són obligatoris (requerits per Verifactu)')
      }

      const res = await fetch('http://localhost:3001/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error((await res.json()).missatge || 'Error afegint client')
      setForm(emptyClient())
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    } finally {
      setSubmitting(false)
    }
  }

  const startEdit = (client: Client) => {
    setEditingId(client._id)
    setEditForm(client)
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const saveEdit = async (id: string) => {
    setSavingEdit(true)
    setError(null)
    try {
      if (!editForm.nif || !editForm.razonSocial || !editForm.direccio) {
        throw new Error('NIF, Raó Social i Adreça són obligatoris (requerits per Verifactu)')
      }

      const res = await fetch(`http://localhost:3001/api/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })

      if (!res.ok) throw new Error((await res.json()).missatge || 'Error actualitzant client')
      load()
      setEditingId(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Segur que vols desactivar aquest client?')) return

    try {
      const res = await fetch(`http://localhost:3001/api/clients/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Error desactivant client')
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    }
  }

  const handleReactivate = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:3001/api/clients/${id}/reactivar`, {
        method: 'PUT',
      })
      if (!res.ok) throw new Error('Error reactivant client')
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    }
  }

  return (
    <section>
      <h2>Clients i Proveïdors</h2>
      <p className="page-description">Gestiona la informació de clients i proveïdors per a factures i despeses recurrents. Els camps fiscals són obligatoris per a integrar-se amb Verifactu.</p>

      {error && <p style={{ color: '#ef4444' }}>⚠ {error}</p>}

      <form className="form-transaccio" onSubmit={handleSubmit}>
        <fieldset style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '1rem', marginBottom: '1rem' }}>
          <legend style={{ fontWeight: 600, color: '#1e293b', paddingInline: '0.5rem' }}>📋 Dades Fiscals (obligatoris per a Verifactu)</legend>
          <div className="form-row">
            <label>
              NIF/CIF *
              <input
                type="text"
                value={form.nif}
                onChange={e => setForm(f => ({ ...f, nif: e.target.value }))}
                placeholder="ES12345678A"
                required
              />
            </label>
            <label>
              Raó Social (Nom legal) *
              <input
                type="text"
                value={form.razonSocial}
                onChange={e => setForm(f => ({ ...f, razonSocial: e.target.value }))}
                placeholder="Nom exacte de l'empresa per a factures"
                required
              />
            </label>
            <label>
              Adreça *
              <input
                type="text"
                value={form.direccio}
                onChange={e => setForm(f => ({ ...f, direccio: e.target.value }))}
                placeholder="Carrer, número, pis"
                required
              />
            </label>
          </div>
        </fieldset>

        <div className="form-row">
          <label>
            Alias / Apodo (opcional)
            <input
              type="text"
              value={form.nom}
              onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
              placeholder="Pepito, Acme Corp, etc. (per a identificació ràpida)"
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="email@exemple.com"
            />
          </label>
          <label>
            Teléfon
            <input
              type="tel"
              value={form.telefon}
              onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))}
              placeholder="+34 600 00 00 00"
            />
          </label>
          <button type="submit" className="btn btn--income" disabled={submitting}>
            + Afegir client
          </button>
        </div>

        <div className="form-row">
          <label>
            Website
            <input
              type="url"
              value={form.website}
              onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
              placeholder="https://exemple.com"
            />
          </label>
          <label>
            Codi postal
            <input
              type="text"
              value={form.codiPostal}
              onChange={e => setForm(f => ({ ...f, codiPostal: e.target.value }))}
              placeholder="08000"
            />
          </label>
          <label>
            Ciutat
            <input
              type="text"
              value={form.ciutat}
              onChange={e => setForm(f => ({ ...f, ciutat: e.target.value }))}
              placeholder="Barcelona"
            />
          </label>
          <label>
            País
            <input
              type="text"
              value={form.pais}
              onChange={e => setForm(f => ({ ...f, pais: e.target.value }))}
              placeholder="Espanya"
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            Persona de contacte
            <input
              type="text"
              value={form.personaContacte}
              onChange={e => setForm(f => ({ ...f, personaContacte: e.target.value }))}
              placeholder="Nom del contacte"
            />
          </label>
          <label>
            Mètode de pagament
            <select value={form.metodePagament} onChange={e => setForm(f => ({ ...f, metodePagament: e.target.value }))}>
              <option value="Transferència">Transferència</option>
              <option value="Efectiu">Efectiu</option>
              <option value="Targeta">Targeta</option>
              <option value="Altres">Altres</option>
            </select>
          </label>
          <label>
            Dies de pagament
            <input
              type="number"
              min="0"
              value={form.diasPagament}
              onChange={e => setForm(f => ({ ...f, diasPagament: parseInt(e.target.value) }))}
            />
          </label>
        </div>

        <div className="form-row">
          <label style={{ gridColumn: '1 / -1' }}>
            Notes o comentaris
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Anotacions addicionals..."
              style={{ minHeight: '100px', resize: 'vertical' }}
            />
          </label>
        </div>
      </form>

      {clients.length === 0 ? (
        <p style={{ color: '#64748b', marginTop: '1.5rem' }}>Cap client registrat encara.</p>
      ) : (
        <>
          <div className="list-controls" style={{ marginTop: '1.5rem' }}>
            <label className="list-controls__label">
              <input
                type="checkbox"
                checked={filtreActius}
                onChange={e => {
                  setFiltreActius(e.target.checked)
                  setCurrentPage(1)
                }}
              />
              Només clients actius
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
                {filteredClients.length === 0
                  ? '0 resultats'
                  : `Pàgina ${currentPage} de ${totalPages} · ${startIndex + 1}-${endIndex} de ${filteredClients.length}`}
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

          {filteredClients.length === 0 ? (
            <p style={{ color: '#64748b', marginTop: '1rem' }}>No hi ha clients amb el filtre seleccionat.</p>
          ) : (
            <table className="taula" style={{ marginTop: '1rem' }}>
              <thead>
                <tr>
                  <th>Alias</th>
                  <th>Raó Social</th>
                  <th>NIF</th>
                  <th>Email</th>
                  <th>Teléfon</th>
                  <th>Pagament</th>
                  <th>Ciutat</th>
                  <th>Estat</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibleClients.map(client => (
                  <tr key={client._id}>
                    {editingId === client._id ? (
                      <>
                        <td>
                          <input
                            className="row-edit-input"
                            type="text"
                            value={editForm.nom}
                            onChange={e => setEditForm(f => ({ ...f, nom: e.target.value }))}
                          />
                        </td>
                        <td>
                          <input
                            className="row-edit-input"
                            type="text"
                            value={editForm.razonSocial}
                            onChange={e => setEditForm(f => ({ ...f, razonSocial: e.target.value }))}
                          />
                        </td>
                        <td>
                          <input
                            className="row-edit-input"
                            type="text"
                            value={editForm.nif}
                            onChange={e => setEditForm(f => ({ ...f, nif: e.target.value }))}
                          />
                        </td>
                        <td>
                          <input
                            className="row-edit-input"
                            type="email"
                            value={editForm.email}
                            onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                          />
                        </td>
                        <td>
                          <input
                            className="row-edit-input"
                            type="tel"
                            value={editForm.telefon}
                            onChange={e => setEditForm(f => ({ ...f, telefon: e.target.value }))}
                          />
                        </td>
                        <td>
                          <select
                            className="row-edit-input"
                            value={editForm.metodePagament}
                            onChange={e => setEditForm(f => ({ ...f, metodePagament: e.target.value }))}
                          >
                            <option value="Transferència">Transferència</option>
                            <option value="Efectiu">Efectiu</option>
                            <option value="Targeta">Targeta</option>
                            <option value="Altres">Altres</option>
                          </select>
                        </td>
                        <td>
                          <input
                            className="row-edit-input"
                            type="text"
                            value={editForm.ciutat}
                            onChange={e => setEditForm(f => ({ ...f, ciutat: e.target.value }))}
                          />
                        </td>
                        <td></td>
                        <td className="row-actions">
                          <button
                            type="button"
                            className="btn-page"
                            disabled={savingEdit}
                            onClick={() => saveEdit(client._id)}
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
                        <td style={{ fontWeight: 500, fontSize: '0.9em', color: '#64748b' }}>{client.nom || '—'}</td>
                        <td style={{ fontWeight: 600 }}>{client.razonSocial}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.9em' }}>{client.nif}</td>
                        <td>{client.email || '—'}</td>
                        <td>{client.telefon || '—'}</td>
                        <td>
                          <span style={{ fontSize: '0.85em', color: '#64748b' }}>
                            {client.metodePagament} ({client.diasPagament}d)
                          </span>
                        </td>
                        <td>{client.ciutat || '—'}</td>
                        <td>
                          {client.actiu ? (
                            <span style={{ color: '#10b981', fontWeight: 600 }}>✓ Actiu</span>
                          ) : (
                            <span style={{ color: '#ef4444', fontWeight: 600 }}>✕ Inactiu</span>
                          )}
                        </td>
                        <td className="row-actions">
                          <button type="button" className="btn-page" onClick={() => startEdit(client)}>Editar</button>
                          {client.actiu ? (
                            <button type="button" className="btn-delete" onClick={() => handleDelete(client._id)} title="Desactivar">✕</button>
                          ) : (
                            <button
                              type="button"
                              className="btn-page"
                              style={{ backgroundColor: '#10b981' }}
                              onClick={() => handleReactivate(client._id)}
                            >
                              Activar
                            </button>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  )
}
