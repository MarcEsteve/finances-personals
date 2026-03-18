const express = require('express')
const router = express.Router()
const Transaccio = require('../models/Transaccio')

// GET /api/transaccions
router.get('/', async (req, res) => {
  try {
    const transaccions = await Transaccio.find().sort({ data: -1 })
    res.json(transaccions)
  } catch (error) {
    res.status(500).json({ missatge: error.message })
  }
})

// POST /api/transaccions
router.post('/', async (req, res) => {
  try {
    const nova = new Transaccio(req.body)
    const guardada = await nova.save()
    res.status(201).json(guardada)
  } catch (error) {
    res.status(400).json({ missatge: error.message })
  }
})

// PUT /api/transaccions/:id
router.put('/:id', async (req, res) => {
  try {
    const actualitzada = await Transaccio.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )

    if (!actualitzada) {
      return res.status(404).json({ missatge: 'Transacció no trobada' })
    }

    res.json(actualitzada)
  } catch (error) {
    res.status(400).json({ missatge: error.message })
  }
})

// DELETE /api/transaccions/:id
router.delete('/:id', async (req, res) => {
  try {
    await Transaccio.findByIdAndDelete(req.params.id)
    res.json({ missatge: 'Transacció eliminada' })
  } catch (error) {
    res.status(500).json({ missatge: error.message })
  }
})

module.exports = router
