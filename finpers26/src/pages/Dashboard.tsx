import { useEffect, useMemo, useState } from 'react'

interface Transaccio {
  _id: string
  tipus: 'ingres' | 'despesa' | 'estalvi'
  categoria: string
  descripcio: string
  import: number
  data: string
}

const MESOS = [
  { value: '01', label: 'Gener' },
  { value: '02', label: 'Febrer' },
  { value: '03', label: 'Març' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Maig' },
  { value: '06', label: 'Juny' },
  { value: '07', label: 'Juliol' },
  { value: '08', label: 'Agost' },
  { value: '09', label: 'Setembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Novembre' },
  { value: '12', label: 'Desembre' },
]

function fmt(n: number) {
  return n.toLocaleString('ca-ES', { minimumFractionDigits: 2 }) + ' €'
}

export default function Dashboard() {
  const [transaccions, setTransaccions] = useState<Transaccio[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()))
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'))

  useEffect(() => {
    fetch('http://localhost:3001/api/transaccions')
      .then(res => {
        if (!res.ok) throw new Error('Error carregant dades')
        return res.json()
      })
      .then(setTransaccions)
      .catch(err => setError(err.message))
  }, [])

  const yearOptions = useMemo(() => {
    const currentYear = String(new Date().getFullYear())
    const years = new Set(transaccions.map(t => String(new Date(t.data).getFullYear())))
    years.add(currentYear)
    return Array.from(years).sort((a, b) => Number(b) - Number(a))
  }, [transaccions])

  const filteredTransaccions = useMemo(() => {
    return transaccions.filter(t => {
      const date = new Date(t.data)
      const year = String(date.getFullYear())
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const yearMatches = selectedYear === 'all' || year === selectedYear
      const monthMatches = selectedMonth === 'all' || month === selectedMonth
      return yearMatches && monthMatches
    })
  }, [selectedMonth, selectedYear, transaccions])

  const resum = useMemo(() => {
    const ingressos = filteredTransaccions
      .filter(t => t.tipus === 'ingres')
      .reduce((sum, t) => sum + Math.abs(t.import), 0)
    const despeses = filteredTransaccions
      .filter(t => t.tipus === 'despesa')
      .reduce((sum, t) => sum + Math.abs(t.import), 0)
    const estalvis = filteredTransaccions
      .filter(t => t.tipus === 'estalvi')
      .reduce((sum, t) => sum + Math.abs(t.import), 0)

    const expenseRate = ingressos > 0 ? Math.round((despeses / ingressos) * 100) : 0
    const savingRate = ingressos > 0 ? Math.round((estalvis / ingressos) * 100) : 0
    const saldo = ingressos - despeses - estalvis

    return { ingressos, despeses, estalvis, expenseRate, savingRate, saldo }
  }, [filteredTransaccions])

  const fonsEmergencia = useMemo(() => {
    return transaccions
      .filter(t => t.tipus === 'estalvi' && t.categoria === 'Fons emergència')
      .reduce((sum, t) => sum + Math.abs(t.import), 0)
  }, [transaccions])

  const topCategories = useMemo(() => {
    const bucket = new Map<string, number>()

    for (const transaccio of filteredTransaccions) {
      if (transaccio.tipus !== 'despesa') continue
      const categoria = transaccio.categoria || 'Sense categoria'
      bucket.set(categoria, (bucket.get(categoria) || 0) + Math.abs(transaccio.import))
    }

    return Array.from(bucket.entries())
      .map(([categoria, total]) => ({
        categoria,
        total,
        percentatge: resum.despeses > 0 ? Math.round((total / resum.despeses) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3)
  }, [filteredTransaccions, resum.despeses])

  const latestTransaccions = useMemo(() => {
    return [...filteredTransaccions]
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
      .slice(0, 8)
  }, [filteredTransaccions])

  const mesosCoberts = resum.despeses > 0 ? fonsEmergencia / resum.despeses : 0
  const periodeLabel = selectedMonth === 'all'
    ? `Any ${selectedYear === 'all' ? 'complet' : selectedYear}`
    : `${MESOS.find(m => m.value === selectedMonth)?.label || selectedMonth} ${selectedYear}`

  return (
    <section>
      <h2>Dashboard</h2>
      <p className="page-description">
        Resum del periode seleccionat amb ritme de despesa, cobertura del fons d'emergencia i principals focus de despesa.
      </p>
      {error && <p style={{ color: '#ef4444' }}>⚠ {error} — comprova que el servidor està actiu.</p>}

      <div className="report-panel">
        <div className="report-controls">
          <div className="report-filter-group">
            <label className="report-filter-label">
              Any
              <select
                className="report-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                <option value="all">Tots</option>
                {yearOptions.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </label>

            <label className="report-filter-label">
              Mes
              <select
                className="report-select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                <option value="all">Tots</option>
                {MESOS.map((mes) => (
                  <option key={mes.value} value={mes.value}>{mes.label}</option>
                ))}
              </select>
            </label>
          </div>
          <span className="dashboard-period-label">Periode actiu: {periodeLabel}</span>
        </div>
      </div>

      <div className="cards-grid">
        <div className="card card--income">
          <span className="card__label">Ingressos del periode</span>
          <span className="card__value">{fmt(resum.ingressos)}</span>
        </div>
        <div className="card card--expense">
          <span className="card__label">Despeses del periode</span>
          <span className="card__value">{fmt(resum.despeses)}</span>
        </div>
        <div className="card card--savings">
          <span className="card__label">Estalvi / inversió fora caixa</span>
          <span className="card__value">{fmt(resum.estalvis)}</span>
        </div>
        <div className="card card--balance">
          <span className="card__label">Saldo de caixa</span>
          <span className="card__value">{fmt(resum.saldo)}</span>
        </div>
        <div className="card card--balance">
          <span className="card__label">% destinat a estalvi/inversió</span>
          <span className="card__value">{resum.savingRate}%</span>
        </div>
        <div className="card card--expense">
          <span className="card__label">Taxa de despesa</span>
          <span className="card__value">{resum.expenseRate}%</span>
        </div>
        <div className="card card--savings">
          <span className="card__label">Fons d'emergència acumulat</span>
          <span className="card__value">{fmt(fonsEmergencia)}</span>
        </div>
        <div className="card card--balance">
          <span className="card__label">Mesos coberts</span>
          <span className="card__value">{mesosCoberts.toFixed(1)}</span>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-panel">
          <h3 className="dashboard-panel__title">Top 3 categories de despesa</h3>
          {topCategories.length > 0 ? (
            <div className="dashboard-top-list">
              {topCategories.map((item, index) => (
                <div key={item.categoria} className="dashboard-top-item">
                  <div>
                    <span className="dashboard-top-rank">#{index + 1}</span>
                    <strong>{item.categoria}</strong>
                  </div>
                  <div className="dashboard-top-values">
                    <strong>{fmt(item.total)}</strong>
                    <span>{item.percentatge}% de les despeses</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="dashboard-empty">No hi ha despeses en aquest periode.</p>
          )}
        </div>

        <div className="dashboard-panel">
          <h3 className="dashboard-panel__title">Lectura ràpida</h3>
          <ul className="dashboard-insights">
            <li>El fons d'emergència cobreix aproximadament <strong>{mesosCoberts.toFixed(1)} mesos</strong> de despesa al ritme actual.</li>
            <li>Estàs destinant <strong>{resum.savingRate}%</strong> dels ingressos a estalvi o inversió.</li>
            <li>La despesa representa <strong>{resum.expenseRate}%</strong> dels ingressos del periode.</li>
          </ul>
        </div>
      </div>

      {latestTransaccions.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ color: '#94a3b8', fontSize: '1rem', marginBottom: '0.75rem' }}>Últimes transaccions del periode</h3>
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
              {latestTransaccions.map(t => (
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
