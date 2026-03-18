const multer = require('multer')
const path = require('path')
const fs = require('fs')

// Carpeta on es guardaran els fitxers
const uploadsDir = path.join(__dirname, '../../uploads')

// Crear la carpeta si no existeix
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// Configuració de magatzem
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    // Generar nom únic amb timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, `${uniqueSuffix}-${file.originalname}`)
  },
})

// Filtre de tipus de fitxers permesos
const fileFilter = (req, file, cb) => {
  // Tipus de fitxers permesos: PDF, imatges, fulls de càlcul, documents
  const allowedMimes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv',
  ]

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error(`Tipus de fitxer no permès: ${file.mimetype}`), false)
  }
}

// Configuració final de multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB màxim
  },
})

module.exports = { upload, uploadsDir }
