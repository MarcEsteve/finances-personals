const express = require('express')
const router = express.Router()
const Client = require('../models/Client')

// GET /api/clients - Obtenir tots els clients
router.get('/', async (req, res) => {
  try {
    const clients = await Client.find().sort({ nom: 1 })
    res.json(clients)
  } catch (error) {
    res.status(500).json({ missatge: error.message })
  }
})

// GET /api/clients/actius - Obtenir només clients actius
router.get('/actius', async (req, res) => {
  try {
    const clients = await Client.find({ actiu: true }).sort({ nom: 1 })
    res.json(clients)
  } catch (error) {
    res.status(500).json({ missatge: error.message })
  }
})

// GET /api/clients/:id - Obtenir un client específic
router.get('/:id', async (req, res) => {
  try {
    const client = await Client.findById(req.params.id)
    if (!client) {
      return res.status(404).json({ missatge: 'Client no trobat' })
    }
    res.json(client)
  } catch (error) {
    res.status(500).json({ missatge: error.message })
  }
})

// POST /api/clients - Crear un nou client
router.post('/', async (req, res) => {
  try {
    // Validar camps obligatoris per a Verifactu
    if (!req.body.nif || !req.body.nif.trim()) {
      return res.status(400).json({ missatge: 'NIF/CIF és obligatori' })
    }
    if (!req.body.razonSocial || !req.body.razonSocial.trim()) {
      return res.status(400).json({ missatge: 'Raó Social és obligatori' })
    }
    if (!req.body.direccio || !req.body.direccio.trim()) {
      return res.status(400).json({ missatge: 'Adreça és obligatori' })
    }

    // Verificar que el NIF no existeix ja
    const existingClient = await Client.findOne({ nif: req.body.nif.trim() })
    if (existingClient) {
      return res.status(400).json({ missatge: 'Ja existeix un client amb aquest NIF' })
    }

    const client = new Client(req.body)
    const saved = await client.save()
    res.status(201).json(saved)
  } catch (error) {
    res.status(400).json({ missatge: error.message })
  }
})

// PUT /api/clients/:id - Actualitzar un client
router.put('/:id', async (req, res) => {
  try {
    // Validar camps obligatoris si es proporcionen
    if (req.body.nif && !req.body.nif.trim()) {
      return res.status(400).json({ missatge: 'NIF/CIF no pot estar buit' })
    }
    if (req.body.razonSocial && !req.body.razonSocial.trim()) {
      return res.status(400).json({ missatte: 'Raó Social no pot estar buit' })
    }
    if (req.body.direccio && !req.body.direccio.trim()) {
      return res.status(400).json({ missatge: 'Adreça no pot estar buida' })
    }

    // Si es modifica el NIF, verificar que no existeix ja
    if (req.body.nif) {
      const existingClient = await Client.findOne({ nif: req.body.nif.trim(), _id: { $ne: req.params.id } })
      if (existingClient) {
        return res.status(400).json({ missatge: 'Ja existeix un altre client amb aquest NIF' })
      }
    }

    const client = await Client.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )

    if (!client) {
      return res.status(404).json({ missatge: 'Client no trobat' })
    }

    res.json(client)
  } catch (error) {
    res.status(400).json({ missatge: error.message })
  }
})

// DELETE /api/clients/:id - Eliminar un client (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const client = await Client.findByIdAndUpdate(
      req.params.id,
      { actiu: false },
      { new: true }
    )

    if (!client) {
      return res.status(404).json({ missatge: 'Client no trobat' })
    }

    res.json({ missatge: 'Client desactivat correctament', client })
  } catch (error) {
    res.status(500).json({ missatge: error.message })
  }
})

// PUT /api/clients/:id/reactivar - Reactivar un client
router.put('/:id/reactivar', async (req, res) => {
  try {
    const client = await Client.findByIdAndUpdate(
      req.params.id,
      { actiu: true },
      { new: true }
    )

    if (!client) {
      return res.status(404).json({ missatge: 'Client no trobat' })
    }

    res.json({ missatge: 'Client reactivat correctament', client })
  } catch (error) {
    res.status(500).json({ missatge: error.message })
  }
})

module.exports = router
