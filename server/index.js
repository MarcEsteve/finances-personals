require('dotenv').config()
const express = require('express')
const path = require('path')
const cors = require('cors')
const connectDB = require('./src/config/db')
const transaccionsRouter = require('./src/routes/transaccions')
const clientsRouter = require('./src/routes/clients')

const app = express()
const PORT = process.env.PORT || 3001
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

connectDB()

app.use(cors({ origin: CORS_ORIGIN }))
app.use(express.json())

// Servir fitxers estàtics de la carpeta uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

app.use('/api/transaccions', transaccionsRouter)
app.use('/api/clients', clientsRouter)

app.get('/api/health', (_req, res) => res.json({ estat: 'ok' }))

app.listen(PORT, () => {
  console.log(`Servidor escoltant a http://localhost:${PORT}`)
})
