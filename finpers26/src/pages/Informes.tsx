import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface Transaccio {
  _id: string
  tipus: 'ingres' | 'despesa' | 'estalvi'
  categoria: string
  descripcio: string
  import: number
  data: string
}

type Vista = 'ingressos' | 'despeses' | 'inversions' | 'comparativa'
type Agrupacio = 'dia' | 'mes'

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

function formatLabel(key: string, agrupacio: Agrupacio) {
  if (agrupacio === 'dia') {
    return new Date(key).toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit' })
  }
  const [year, month] = key.split('-')
  return `${month}/${year.slice(2)}`
}

export default function Informes() {
  const [transaccions, setTransaccions] = useState<Transaccio[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState<Vista>('comparativa')
  const [agrupacio, setAgrupacio] = useState<Agrupacio>('mes')
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()))
  const [selectedMonth, setSelectedMonth] = useState('all')

  useEffect(() => {
    fetch('http://localhost:3001/api/transaccions')
      .then(res => {
        if (!res.ok) throw new Error('Error carregant informes')
        return res.json()
      })
      .then(setTransaccions)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const yearOptions = useMemo(() => {
    const currentYear = String(new Date().getFullYear())
    const years = new Set(transaccions.map(t => String(new Date(t.data).getFullYear())))
    years.add(currentYear)
    return Array.from(years).sort((a, b) => Number(b) - Number(a))
  }, [transaccions])

  const filteredTransaccions = useMemo(() => {
    return transaccions.filter(t => {
      const d = new Date(t.data)
      const year = String(d.getFullYear())
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const yearMatches = selectedYear === 'all' || year === selectedYear
      const monthMatches = selectedMonth === 'all' || month === selectedMonth
      return yearMatches && monthMatches
    })
  }, [selectedMonth, selectedYear, transaccions])

  const totals = useMemo(() => {
    const ingressos = filteredTransaccions
      .filter(t => t.tipus === 'ingres')
      .reduce((sum, t) => sum + Math.abs(t.import), 0)
    const despeses = filteredTransaccions
      .filter(t => t.tipus === 'despesa')
      .reduce((sum, t) => sum + Math.abs(t.import), 0)
    const inversions = filteredTransaccions
      .filter(t => t.tipus === 'estalvi')
      .reduce((sum, t) => sum + Math.abs(t.import), 0)

    return {
      ingressos,
      despeses,
      inversions,
      saldo: ingressos - despeses - inversions,
    }
  }, [filteredTransaccions])

  const chartData = useMemo(() => {
    const bucket = new Map<string, { ingressos: number; despeses: number; inversions: number }>()

    for (const t of filteredTransaccions) {
      const date = new Date(t.data)
      const key =
        agrupacio === 'dia'
          ? date.toISOString().slice(0, 10)
          : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

      if (!bucket.has(key)) {
        bucket.set(key, { ingressos: 0, despeses: 0, inversions: 0 })
      }

      const entry = bucket.get(key)
      if (!entry) continue
      if (t.tipus === 'ingres') entry.ingressos += Math.abs(t.import)
      else if (t.tipus === 'despesa') entry.despeses += Math.abs(t.import)
      else entry.inversions += Math.abs(t.import)
    }

    return Array.from(bucket.entries())
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .map(([key, values]) => ({
        key,
        label: formatLabel(key, agrupacio),
        ingressos: values.ingressos,
        despeses: values.despeses,
        inversions: values.inversions,
      }))
  }, [agrupacio, filteredTransaccions])

  const categoryData = useMemo(() => {
    if (vista === 'comparativa') return []

    const bucket = new Map<string, number>()
    const tipusFiltre = vista === 'ingressos' ? 'ingres' : vista === 'despeses' ? 'despesa' : 'estalvi'

    for (const t of filteredTransaccions) {
      if (t.tipus !== tipusFiltre) continue
      const categoria = t.categoria || 'Sense categoria'
      if (!bucket.has(categoria)) {
        bucket.set(categoria, 0)
      }

      const entry = bucket.get(categoria)
      if (entry === undefined) continue

      bucket.set(categoria, entry + Math.abs(t.import))
    }

    return Array.from(bucket.entries())
      .map(([categoria, total]) => ({
        categoria,
        total,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 12)
  }, [filteredTransaccions, vista])

  return (
    <section>
      <h2>Informes</h2>
      <p className="page-description">
        Visualitza l'evolució dels ingressos, despeses i inversions per dies o per mesos, amb detall per categories.
      </p>

      {error && <p style={{ color: '#ef4444' }}>⚠ {error}</p>}

      <div className="cards-grid">
        <div className="card card--income">
          <span className="card__label">Total ingressos</span>
          <span className="card__value">{fmt(totals.ingressos)}</span>
        </div>
        <div className="card card--expense">
          <span className="card__label">Total despeses</span>
          <span className="card__value">{fmt(totals.despeses)}</span>
        </div>
        <div className="card card--savings">
          <span className="card__label">Total inversions</span>
          <span className="card__value">{fmt(totals.inversions)}</span>
        </div>
        <div className="card card--balance">
          <span className="card__label">Saldo de caixa</span>
          <span className="card__value">{fmt(totals.saldo)}</span>
        </div>
      </div>

      <div className="report-panel">
        <div className="report-controls">
          <div className="report-toggle-group">
            <button
              className={`report-toggle ${vista === 'ingressos' ? 'active income' : ''}`}
              onClick={() => setVista('ingressos')}
            >
              Ingressos
            </button>
            <button
              className={`report-toggle ${vista === 'despeses' ? 'active expense' : ''}`}
              onClick={() => setVista('despeses')}
            >
              Despeses
            </button>
            <button
              className={`report-toggle ${vista === 'inversions' ? 'active savings' : ''}`}
              onClick={() => setVista('inversions')}
            >
              Inversions
            </button>
            <button
              className={`report-toggle ${vista === 'comparativa' ? 'active compare' : ''}`}
              onClick={() => setVista('comparativa')}
            >
              Comparativa
            </button>
          </div>

          <div className="report-toggle-group">
            <button
              className={`report-toggle ${agrupacio === 'dia' ? 'active compare' : ''}`}
              onClick={() => setAgrupacio('dia')}
            >
              Per dies
            </button>
            <button
              className={`report-toggle ${agrupacio === 'mes' ? 'active compare' : ''}`}
              onClick={() => setAgrupacio('mes')}
            >
              Per mesos
            </button>
          </div>

          <div className="report-filter-group">
            <label className="report-filter-label">
              Any
              <select
                className="report-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
              >
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
                <option value="all">Tot l'any</option>
                {MESOS.map((mes) => (
                  <option key={mes.value} value={mes.value}>{mes.label}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="report-chart-wrap">
          {loading ? (
            <p style={{ color: '#94a3b8' }}>Carregant gràfic...</p>
          ) : chartData.length === 0 ? (
            <p style={{ color: '#94a3b8' }}>Encara no hi ha prou dades per generar l'informe.</p>
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: 4, bottom: 0 }}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={{ stroke: '#334155' }} />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={{ stroke: '#334155' }}
                  tickFormatter={(value: number) => `${value.toLocaleString('ca-ES')}€`}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }}
                  labelStyle={{ color: '#f8fafc' }}
                  formatter={(value) => (typeof value === 'number' ? fmt(value) : String(value ?? ''))}
                />
                <Legend />

                {(vista === 'ingressos' || vista === 'comparativa') && (
                  <Line
                    type="monotone"
                    dataKey="ingressos"
                    name="Ingressos"
                    stroke="#22c55e"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                )}

                {(vista === 'despeses' || vista === 'comparativa') && (
                  <Line
                    type="monotone"
                    dataKey="despeses"
                    name="Despeses"
                    stroke="#ef4444"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                )}

                {vista === 'inversions' && (
                  <Line
                    type="monotone"
                    dataKey="inversions"
                    name="Inversions"
                    stroke="#6366f1"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <h3 className="report-subtitle">
          Distribució per categoria ({vista === 'ingressos' ? 'Ingressos' : vista === 'despeses' ? 'Despeses' : vista === 'inversions' ? 'Inversions' : 'Selecciona una vista individual'})
        </h3>
        <div className="report-chart-wrap">
          {loading ? (
            <p style={{ color: '#94a3b8' }}>Carregant gràfic per categories...</p>
          ) : vista === 'comparativa' ? (
            <p style={{ color: '#94a3b8' }}>
              La comparativa de categories no té sentit entre ingressos, despeses i inversions. Selecciona una vista individual per veure aquest detall.
            </p>
          ) : categoryData.length === 0 ? (
            <p style={{ color: '#94a3b8' }}>Encara no hi ha categories amb dades.</p>
          ) : (
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={categoryData} margin={{ top: 10, right: 10, left: 4, bottom: 20 }}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" />
                <XAxis
                  dataKey="categoria"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={{ stroke: '#334155' }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={65}
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={{ stroke: '#334155' }}
                  tickFormatter={(value: number) => `${value.toLocaleString('ca-ES')}€`}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }}
                  labelStyle={{ color: '#f8fafc' }}
                  formatter={(value) => (typeof value === 'number' ? fmt(value) : String(value ?? ''))}
                />
                <Legend />

                {vista === 'ingressos' && (
                  <Bar dataKey="total" name="Ingressos" fill="#22c55e" radius={[6, 6, 0, 0]} />
                )}
                {vista === 'despeses' && (
                  <Bar dataKey="total" name="Despeses" fill="#ef4444" radius={[6, 6, 0, 0]} />
                )}
                {vista === 'inversions' && (
                  <Bar dataKey="total" name="Inversions" fill="#6366f1" radius={[6, 6, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </section>
  )
}
