export default function Dashboard() {
  return (
    <section>
      <h2>Dashboard</h2>
      <div className="cards-grid">
        <div className="card card--income">
          <span className="card__label">Ingressos del mes</span>
          <span className="card__value">0,00 €</span>
        </div>
        <div className="card card--expense">
          <span className="card__label">Despeses del mes</span>
          <span className="card__value">0,00 €</span>
        </div>
        <div className="card card--balance">
          <span className="card__label">Saldo</span>
          <span className="card__value">0,00 €</span>
        </div>
        <div className="card card--savings">
          <span className="card__label">% Estalvi</span>
          <span className="card__value">0%</span>
        </div>
      </div>
    </section>
  )
}
