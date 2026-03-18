const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const Transaccio = require('../models/Transaccio')
const { calculaValor, obtePreu } = require('../services/cryptoService')
const { parseInvoicePdfBuffer } = require('../services/invoiceParser')
const { upload, uploadsDir } = require('../middlewares/upload')

const parseFacturaUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true)
      return
    }
    cb(new Error('Només s\'accepten fitxers PDF per analitzar factures'))
  },
})

function validateIngresRequiredFields(body) {
  if (body.tipus !== 'ingres') return null
  if (!body.clientId) return 'El client és obligatori per als ingressos'
  if (!body.descripcio || !String(body.descripcio).trim()) return 'La descripció és obligatòria per als ingressos'
  return null
}

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
    let body = req.body

    const validationError = validateIngresRequiredFields(body)
    if (validationError) {
      return res.status(400).json({ missatge: validationError })
    }

    // Si és cripto, calcula el valor en euros
    if (body.tipus === 'estalvi' && body.detallCripto && body.detallCripto.moneda) {
      const { preuUnitariEuro, totalEuro } = await calculaValor(
        body.detallCripto.moneda,
        body.detallCripto.quantitat
      )

      body = {
        ...body,
        import: totalEuro,
        detallCripto: {
          ...body.detallCripto,
          preuUnitariEuro,
          totalEuro,
          dataActualitzacio: new Date(),
        },
      }
    }

    const nova = new Transaccio(body)
    const guardada = await nova.save()
    res.status(201).json(guardada)
  } catch (error) {
    res.status(400).json({ missatge: error.message })
  }
})

// PUT /api/transaccions/:id
router.put('/:id', async (req, res) => {
  try {
    let body = req.body

    const validationError = validateIngresRequiredFields(body)
    if (validationError) {
      return res.status(400).json({ missatge: validationError })
    }

    // Si és cripto, calcula el valor en euros
    if (body.tipus === 'estalvi' && body.detallCripto && body.detallCripto.moneda) {
      const { preuUnitariEuro, totalEuro } = await calculaValor(
        body.detallCripto.moneda,
        body.detallCripto.quantitat
      )

      body = {
        ...body,
        import: totalEuro,
        detallCripto: {
          ...body.detallCripto,
          preuUnitariEuro,
          totalEuro,
          dataActualitzacio: new Date(),
        },
      }
    }

    const actualitzada = await Transaccio.findByIdAndUpdate(
      req.params.id,
      body,
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

// GET /api/cotitzacions/:moneda
router.get('/cotitzacions/:moneda', async (req, res) => {
  try {
    const preu = await obtePreu(req.params.moneda)
    res.json({ moneda: req.params.moneda, preuEuro: preu })
  } catch (error) {
    res.status(400).json({ missatge: error.message })
  }
})

// PUT /api/actualitza-criptos
// Actualitza les cotitzacions de totes les transaccions de cripto
router.put('/actualitza-criptos', async (req, res) => {
  try {
    const transaccionsAActualitzar = await Transaccio.find({
      'detallCripto.moneda': { $exists: true, $ne: null },
    })

    const actualitzades = []

    for (const transaccio of transaccionsAActualitzar) {
      if (transaccio.detallCripto && transaccio.detallCripto.moneda && transaccio.detallCripto.moneda !== 'Altres') {
        try {
          const { preuUnitariEuro, totalEuro } = await calculaValor(
            transaccio.detallCripto.moneda,
            transaccio.detallCripto.quantitat
          )

          transaccio.detallCripto.preuUnitariEuro = preuUnitariEuro
          transaccio.detallCripto.totalEuro = totalEuro
          transaccio.detallCripto.dataActualitzacio = new Date()
          transaccio.import = totalEuro

          await transaccio.save()
          actualitzades.push({
            _id: transaccio._id,
            moneda: transaccio.detallCripto.moneda,
            novPreu: preuUnitariEuro,
            novTotal: totalEuro,
          })
        } catch (err) {
          console.error(`Error actualitzant transacció ${transaccio._id}:`, err.message)
        }
      }
    }

    res.json({
      missatge: `S'han actualitzat ${actualitzades.length} transaccions de cripto`,
      actualitzades,
    })
  } catch (error) {
    res.status(500).json({ missatge: error.message })
  }
})

// POST /api/transaccions/parse-factura-pdf - Analitza un PDF i extreu Base/IVA/IRPF/Total
router.post('/parse-factura-pdf', parseFacturaUpload.single('fitxer'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ missatge: 'No s\'ha enviat cap fitxer' })
    }

    const buffer = req.file.buffer
    const { parsed, textSnippet } = await parseInvoicePdfBuffer(buffer)

    return res.json({
      missatge: 'Factura analitzada correctament',
      parsed,
      textSnippet,
    })
  } catch (error) {
    return res.status(400).json({ missatge: error.message })
  }
})

// POST /api/transaccions/:id/upload - Afegir fitxer a una transacció
router.post('/:id/upload', upload.single('fitxer'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ missatge: 'No s\'ha enviat cap fitxer' })
    }

    const transaccio = await Transaccio.findById(req.params.id)
    if (!transaccio) {
      fs.unlinkSync(req.file.path)
      return res.status(404).json({ missatge: 'Transacció no trobada' })
    }

    const adjunt = {
      fileName: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedAt: new Date(),
    }

    transaccio.adjunts = transaccio.adjunts || []
    transaccio.adjunts.push(adjunt)
    await transaccio.save()

    res.status(201).json({
      missatge: 'Fitxer enviat correctament',
      adjunt,
      transaccio,
    })
  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path)
    res.status(400).json({ missatge: error.message })
  }
})

// GET /api/transaccions/:id/descarrega/:fileName - Descarregar fitxer
router.get('/:id/descarrega/:fileName', async (req, res) => {
  try {
    const transaccio = await Transaccio.findById(req.params.id)
    if (!transaccio) {
      return res.status(404).json({ missatge: 'Transacció no trobada' })
    }

    const adjunt = transaccio.adjunts?.find(a => a.fileName === req.params.fileName)
    if (!adjunt) {
      return res.status(404).json({ missatge: 'Fitxer no trobat' })
    }

    const filePath = path.join(uploadsDir, req.params.fileName)

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ missatge: 'Fitxer no existeix al servidor' })
    }

    res.download(filePath, adjunt.originalName)
  } catch (error) {
    res.status(400).json({ missatge: error.message })
  }
})

// DELETE /api/transaccions/:id/adjunts/:fileName - Eliminar fitxer
router.delete('/:id/adjunts/:fileName', async (req, res) => {
  try {
    const transaccio = await Transaccio.findById(req.params.id)
    if (!transaccio) {
      return res.status(404).json({ missatge: 'Transacció no trobada' })
    }

    const adjuntIndex = transaccio.adjunts?.findIndex(a => a.fileName === req.params.fileName)
    if (adjuntIndex === undefined || adjuntIndex === -1) {
      return res.status(404).json({ missatge: 'Fitxer no trobat en la transacció' })
    }

    const adjunt = transaccio.adjunts[adjuntIndex]
    const filePath = path.join(uploadsDir, adjunt.fileName)

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    transaccio.adjunts.splice(adjuntIndex, 1)
    await transaccio.save()

    res.json({
      missatge: 'Fitxer eliminat correctament',
      transaccio,
    })
  } catch (error) {
    res.status(400).json({ missatge: error.message })
  }
})

// GET /api/transaccions/:id/adjunts - Obtenir llista d'adjunts
router.get('/:id/adjunts', async (req, res) => {
  try {
    const transaccio = await Transaccio.findById(req.params.id)
    if (!transaccio) {
      return res.status(404).json({ missatge: 'Transacció no trobada' })
    }

    res.json({
      adjunts: transaccio.adjunts || [],
    })
  } catch (error) {
    res.status(400).json({ missatge: error.message })
  }
})

module.exports = router
