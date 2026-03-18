import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './App.css'
import Header from './components/Header'
import Footer from './components/Footer'
import Dashboard from './pages/Dashboard'
import Ingressos from './pages/Ingressos'
import Despeses from './pages/Despeses'
import Impostos from './pages/Impostos'
import Estalvis from './pages/Estalvis'
import Informes from './pages/Informes'
import Clients from './pages/Clients'

function App() {
  return (
    <BrowserRouter>
      <div className="layout">
        <Header />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/ingressos" element={<Ingressos />} />
            <Route path="/despeses" element={<Despeses />} />
            <Route path="/impostos" element={<Impostos />} />
            <Route path="/estalvis" element={<Estalvis />} />
            <Route path="/informes" element={<Informes />} />
            <Route path="/clients" element={<Clients />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  )
}

export default App
