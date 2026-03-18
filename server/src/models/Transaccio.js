const mongoose = require('mongoose')

const detallFacturaSchema = new mongoose.Schema(
  {
    base: {
      type: Number,
      min: 0,
    },
    ivaPct: {
      type: Number,
      min: 0,
      max: 100,
    },
    ivaImport: {
      type: Number,
      min: 0,
    },
    irpfPct: {
      type: Number,
      min: 0,
      max: 100,
    },
    irpfImport: {
      type: Number,
      min: 0,
    },
    totalFactura: {
      type: Number,
      min: 0,
    },
  },
  { _id: false }
)

const detallNominaSchema = new mongoose.Schema(
  {
    mode: {
      type: String,
      enum: ['net', 'brut', 'base'],
    },
    baseSou: {
      type: Number,
      min: 0,
    },
    complements: {
      type: Number,
      min: 0,
    },
    brut: {
      type: Number,
      min: 0,
    },
    irpfImport: {
      type: Number,
      min: 0,
    },
    ssImport: {
      type: Number,
      min: 0,
    },
    altresDeduccions: {
      type: Number,
      min: 0,
    },
    net: {
      type: Number,
      min: 0,
    },
  },
  { _id: false }
)

const detallIngresSchema = new mongoose.Schema(
  {
    tipus: {
      type: String,
      enum: ['general', 'factura', 'nomina'],
    },
    factura: {
      type: detallFacturaSchema,
      default: undefined,
    },
    nomina: {
      type: detallNominaSchema,
      default: undefined,
    },
  },
  { _id: false }
)

const transaccioSchema = new mongoose.Schema(
  {
    tipus: {
      type: String,
      enum: ['ingres', 'despesa', 'estalvi'],
      required: true,
    },
    categoria: {
      type: String,
      required: true,
      trim: true,
    },
    descripcio: {
      type: String,
      trim: true,
      default: '',
    },
    import: {
      type: Number,
      required: true,
      min: 0,
    },
    data: {
      type: Date,
      required: true,
      default: Date.now,
    },
    detallIngres: {
      type: detallIngresSchema,
      default: undefined,
    },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Transaccio', transaccioSchema)
