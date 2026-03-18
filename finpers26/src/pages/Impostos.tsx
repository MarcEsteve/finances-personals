import { useEffect, useMemo, useState } from 'react'

interface Transaccio {
  _id: string
  tipus: 'ingres' | 'despesa' | 'estalvi'
  categoria: string
  import: number
  data: string
}

const AUTONOM_CATEGORIES = /(freelance|aut[oò]nom|factur|consultor|servei|projecte)/i

const QUARTERS = [
  { value: 'Q1', label: 'T1 (Gen-Mar)', months: [1, 2, 3] },
  { value: 'Q2', label: 'T2 (Abr-Jun)', months: [4, 5, 6] },
  { value: 'Q3', label: 'T3 (Jul-Set)', months: [7, 8, 9] },
  { value: 'Q4', label: 'T4 (Oct-Des)', months: [10, 11, 12] },
]

function fmt(n: number) {
  return n.toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function clampPct(n: number) {
  if (Number.isNaN(n)) return 0
  if (n < 0) return 0
  if (n > 100) return 100
  return n
}

export default function Impostos() {
  const [transaccions, setTransaccions] = useState<Transaccio[]>([])
  const [error, setError] = useState<string | null>(null)

  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()))
  const [selectedQuarter, setSelectedQuarter] = useState('Q1')

  const [ivaRate, setIvaRate] = useState(21)
  const [irpfRate, setIrpfRate] = useState(20)
  const [deduiblePct, setDeduiblePct] = useState(60)
  const [ssMensual, setSsMensual] = useState(320)

  const [impostCotxeAnual, setImpostCotxeAnual] = useState(120)
  const [impostMotoAnual, setImpostMotoAnual] = useState(65)

  useEffect(() => {
    fetch('http://localhost:3001/api/transaccions')
      .then(res => {
        if (!res.ok) throw new Error('Error carregant dades fiscals')
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

  const quarterMonths = useMemo(() => {
    return QUARTERS.find(q => q.value === selectedQuarter)?.months ?? [1, 2, 3]
  }, [selectedQuarter])

  const trimestreData = useMemo(() => {
    return transaccions.filter(t => {
      const d = new Date(t.data)
      const year = String(d.getFullYear())
      const month = d.getMonth() + 1
      return year === selectedYear && quarterMonths.includes(month)
    })
  }, [quarterMonths, selectedYear, transaccions])

  const calculs = useMemo(() => {
    const ingressosAutonom = trimestreData
      .filter(t => t.tipus === 'ingres' && AUTONOM_CATEGORIES.test(t.categoria))
      .reduce((sum, t) => sum + Math.abs(t.import), 0)

    const despesesTotals = trimestreData
      .filter(t => t.tipus === 'despesa')
      .reduce((sum, t) => sum + Math.abs(t.import), 0)

    const despesesDeduibles = despesesTotals * (clampPct(deduiblePct) / 100)

    const ivaRepercutit = ingressosAutonom * (clampPct(ivaRate) / 100)
    const ivaSuportat = despesesDeduibles * (clampPct(ivaRate) / 100)
    const ivaTrimestral = Math.max(0, ivaRepercutit - ivaSuportat)

    const quotaSsTrimestral = Math.max(0, ssMensual) * 3
    const baseIrpf = Math.max(0, ingressosAutonom - despesesDeduibles - quotaSsTrimestral)
    const irpfTrimestral = baseIrpf * (clampPct(irpfRate) / 100)

    const impostosVehiclesAnuals = Math.max(0, impostCotxeAnual) + Math.max(0, impostMotoAnual)
    const prorrataVehiclesTrimestre = impostosVehiclesAnuals / 4

    const reservaRecomanada = ivaTrimestral + irpfTrimestral + quotaSsTrimestral + prorrataVehiclesTrimestre

    return {
      ingressosAutonom,
      despesesTotals,
      despesesDeduibles,
      ivaRepercutit,
      ivaSuportat,
      ivaTrimestral,
      quotaSsTrimestral,
      baseIrpf,
      irpfTrimestral,
      impostosVehiclesAnuals,
      prorrataVehiclesTrimestre,
      reservaRecomanada,
    }
  }, [deduiblePct, impostCotxeAnual, impostMotoAnual, irpfRate, ivaRate, ssMensual, trimestreData])

  return (
    <section>
      <h2>Impostos</h2>
      <p className="page-description">
        Estimació fiscal mínima per autònom: IVA trimestral, IRPF estimat, cotització a la Seguretat Social i impostos anuals de vehicles.
      </p>

      {error && <p style={{ color: '#ef4444' }}>⚠ {error}</p>}

      <form className="form-transaccio">
        <div className="form-row">
          <label>
            Any
            <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
              {yearOptions.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </label>

          <label>
            Trimestre
            <select value={selectedQuarter} onChange={e => setSelectedQuarter(e.target.value)}>
              {QUARTERS.map(q => (
                <option key={q.value} value={q.value}>{q.label}</option>
              ))}
            </select>
          </label>

          <label>
            IVA factures (%)
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={ivaRate}
              onChange={e => setIvaRate(Number(e.target.value))}
            />
          </label>

          <label>
            IRPF estimat (%)
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={irpfRate}
              onChange={e => setIrpfRate(Number(e.target.value))}
            />
          </label>

          <label>
            Despesa deduïble (%)
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={deduiblePct}
              onChange={e => setDeduiblePct(Number(e.target.value))}
            />
          </label>

          <label>
            Quota SS mensual (€)
            <input
              type="number"
              min="0"
              step="1"
              value={ssMensual}
              onChange={e => setSsMensual(Number(e.target.value))}
            />
          </label>
        </div>
      </form>

      <div className="cards-grid">
        <div className="card card--income">
          <span className="card__label">IVA repercutit</span>
          <span className="card__value">{fmt(calculs.ivaRepercutit)}</span>
        </div>
        <div className="card card--expense">
          <span className="card__label">IVA suportat</span>
          <span className="card__value">{fmt(calculs.ivaSuportat)}</span>
        </div>
        <div className="card card--balance">
          <span className="card__label">IVA a ingressar (trimestre)</span>
          <span className="card__value">{fmt(calculs.ivaTrimestral)}</span>
        </div>
        <div className="card card--expense">
          <span className="card__label">IRPF estimat autònom</span>
          <span className="card__value">{fmt(calculs.irpfTrimestral)}</span>
        </div>
        <div className="card card--savings">
          <span className="card__label">Quota SS trimestre</span>
          <span className="card__value">{fmt(calculs.quotaSsTrimestral)}</span>
        </div>
        <div className="card card--balance">
          <span className="card__label">Reserva recomanada</span>
          <span className="card__value">{fmt(calculs.reservaRecomanada)}</span>
        </div>
      </div>

      <div className="form-transaccio" style={{ marginTop: '1.5rem' }}>
        <h3 style={{ marginTop: 0, color: '#cbd5e1', fontSize: '1rem' }}>Impostos anuals (vehicles)</h3>
        <div className="form-row">
          <label>
            Impost cotxe anual (€)
            <input
              type="number"
              min="0"
              step="1"
              value={impostCotxeAnual}
              onChange={e => setImpostCotxeAnual(Number(e.target.value))}
            />
          </label>

          <label>
            Impost moto anual (€)
            <input
              type="number"
              min="0"
              step="1"
              value={impostMotoAnual}
              onChange={e => setImpostMotoAnual(Number(e.target.value))}
            />
          </label>
        </div>

        <div style={{ marginTop: '1rem', color: '#94a3b8', fontSize: '0.9rem' }}>
          <div>Total impostos anuals de vehicles: <strong style={{ color: '#f8fafc' }}>{fmt(calculs.impostosVehiclesAnuals)}</strong></div>
          <div>Prorrata trimestral aplicada a la reserva: <strong style={{ color: '#f8fafc' }}>{fmt(calculs.prorrataVehiclesTrimestre)}</strong></div>
        </div>
      </div>

      <div className="form-transaccio" style={{ marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0, color: '#cbd5e1', fontSize: '1rem' }}>Base de càlcul del trimestre</h3>
        <div style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.7 }}>
          <div>Ingressos autònom detectats per categoria: <strong style={{ color: '#f8fafc' }}>{fmt(calculs.ingressosAutonom)}</strong></div>
          <div>Despeses totals: <strong style={{ color: '#f8fafc' }}>{fmt(calculs.despesesTotals)}</strong></div>
          <div>Despeses deduïbles estimades: <strong style={{ color: '#f8fafc' }}>{fmt(calculs.despesesDeduibles)}</strong></div>
          <div>Base IRPF estimada: <strong style={{ color: '#f8fafc' }}>{fmt(calculs.baseIrpf)}</strong></div>
        </div>
      </div>
    </section>
  )
}
