require('dotenv').config()
const express = require('express')
const cors = require('cors')
const connectDB = require('./src/config/db')
const transaccionsRouter = require('./src/routes/transaccions')

const app = express()
const PORT = process.env.PORT || 3001
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

connectDB()

app.use(cors({ origin: CORS_ORIGIN }))
app.use(express.json())

app.use('/api/transaccions', transaccionsRouter)

app.get('/api/health', (_req, res) => res.json({ estat: 'ok' }))

app.listen(PORT, () => {
  console.log(`Servidor escoltant a http://localhost:${PORT}`)
})
