const mongoose = require('mongoose')

const clientSchema = new mongoose.Schema(
  {
    nom: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    telefon: {
      type: String,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
    },
    
    // Dades fiscals (obligatoris per a Verifactu)
    nif: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    razonSocial: {
      type: String,
      required: true,
      trim: true,
    },
    
    // Adreça (obligatoria per a Verifactu)
    direccio: {
      type: String,
      required: true,
      trim: true,
    },
    codiPostal: {
      type: String,
      trim: true,
    },
    ciutat: {
      type: String,
      trim: true,
    },
    pais: {
      type: String,
      trim: true,
      default: 'Espanya',
    },
    
    // Dades de facturació
    metodePagament: {
      type: String,
      enum: ['Transferència', 'Efectiu', 'Targeta', 'Altres'],
      default: 'Transferència',
    },
    diasPagament: {
      type: Number,
      default: 30,
    },
    
    // Contact
    personaContacte: {
      type: String,
      trim: true,
    },
    
    // Control
    actiu: {
      type: Boolean,
      default: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Client', clientSchema)
