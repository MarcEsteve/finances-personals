import { useEffect, useState } from 'react'

interface Transaccio {
  _id: string
  tipus: 'ingres' | 'despesa'
  categoria: string
  descripcio: string
  import: number
  data: string
}

function fmt(n: number) {
  return n.toLocaleString('ca-ES', { minimumFractionDigits: 2 }) + ' €'
}

export default function Dashboard() {
  const [transaccions, setTransaccions] = useState<Transaccio[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('http://localhost:3001/api/transaccions')
      .then(res => {
        if (!res.ok) throw new Error('Error carregant dades')
        return res.json()
      })
      .then(setTransaccions)
      .catch(err => setError(err.message))
  }, [])

  const ingressos = transaccions.filter(t => t.tipus === 'ingres').reduce((s, t) => s + t.import, 0)
  const despeses  = transaccions.filter(t => t.tipus === 'despesa').reduce((s, t) => s + t.import, 0)
  const saldo     = ingressos - despeses
  const estalvi   = ingressos > 0 ? Math.round((saldo / ingressos) * 100) : 0

  return (
    <section>
      <h2>Dashboard</h2>
      {error && <p style={{ color: '#ef4444' }}>⚠ {error} — comprova que el servidor està actiu.</p>}
      <div className="cards-grid">
        <div className="card card--income">
          <span className="card__label">Ingressos del mes</span>
          <span className="card__value">{fmt(ingressos)}</span>
        </div>
        <div className="card card--expense">
          <span className="card__label">Despeses del mes</span>
          <span className="card__value">{fmt(despeses)}</span>
        </div>
        <div className="card card--balance">
          <span className="card__label">Saldo</span>
          <span className="card__value">{fmt(saldo)}</span>
        </div>
        <div className="card card--savings">
          <span className="card__label">% Estalvi</span>
          <span className="card__value">{estalvi}%</span>
        </div>
      </div>

      {transaccions.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ color: '#94a3b8', fontSize: '1rem', marginBottom: '0.75rem' }}>Últimes transaccions</h3>
          <table className="taula">
            <thead>
              <tr>
                <th>Data</th>
                <th>Categoria</th>
                <th>Descripció</th>
                <th>Import</th>
              </tr>
            </thead>
            <tbody>
              {transaccions.slice(0, 8).map(t => (
                <tr key={t._id}>
                  <td>{new Date(t.data).toLocaleDateString('ca-ES')}</td>
                  <td>{t.categoria}</td>
                  <td>{t.descripcio}</td>
                  <td className={t.tipus === 'ingres' ? 'positiu' : 'negatiu'}>
                    {t.tipus === 'ingres' ? '+' : '-'}{fmt(t.import)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
