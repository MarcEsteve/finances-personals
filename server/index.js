require('dotenv').config()
const express = require('express')
const cors = require('cors')
const connectDB = require('./src/config/db')
const transaccionsRouter = require('./src/routes/transaccions')

const app = express()
const PORT = process.env.PORT || 3001

connectDB()

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

app.use('/api/transaccions', transaccionsRouter)

app.get('/api/health', (_req, res) => res.json({ estat: 'ok' }))

app.listen(PORT, () => {
  console.log(`Servidor escoltant a http://localhost:${PORT}`)
})
