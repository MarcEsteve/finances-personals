const mongoose = require('mongoose')

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
  },
  { timestamps: true }
)

module.exports = mongoose.model('Transaccio', transaccioSchema)
