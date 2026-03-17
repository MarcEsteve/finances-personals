require('dotenv').config()
const mongoose = require('mongoose')
const Transaccio = require('./src/models/Transaccio')

const dades = [
  { tipus: 'ingres',  categoria: 'Nòmina',        descripcio: 'Nòmina març',          import: 2200, data: new Date('2026-03-01') },
  { tipus: 'ingres',  categoria: 'Freelance',      descripcio: 'Projecte web',         import: 450,  data: new Date('2026-03-10') },
  { tipus: 'despesa', categoria: 'Habitatge',      descripcio: 'Lloguer març',         import: 750,  data: new Date('2026-03-02') },
  { tipus: 'despesa', categoria: 'Alimentació',    descripcio: 'Supermercat setmana 1',import: 95,   data: new Date('2026-03-03') },
  { tipus: 'despesa', categoria: 'Alimentació',    descripcio: 'Supermercat setmana 2',import: 88,   data: new Date('2026-03-10') },
  { tipus: 'despesa', categoria: 'Transport',      descripcio: 'T-Casual metro',       import: 42,   data: new Date('2026-03-04') },
  { tipus: 'despesa', categoria: 'Subscripcions',  descripcio: 'Netflix + Spotify',    import: 28,   data: new Date('2026-03-05') },
  { tipus: 'despesa', categoria: 'Salut',          descripcio: 'Farmàcia',             import: 34,   data: new Date('2026-03-08') },
  { tipus: 'despesa', categoria: 'Lleure',         descripcio: 'Sopar amb amics',      import: 55,   data: new Date('2026-03-15') },
  { tipus: 'ingres',  categoria: 'Altres',         descripcio: 'Devolució Hisenda',    import: 180,  data: new Date('2026-03-12') },
]

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI)
    console.log('Connectat a MongoDB...')
    await Transaccio.deleteMany({})
    console.log('Col·lecció neta.')
    await Transaccio.insertMany(dades)
    console.log(`${dades.length} transaccions inserides correctament.`)
  } catch (err) {
    console.error('Error al seed:', err.message)
  } finally {
    await mongoose.disconnect()
    console.log('Desconnectat.')
  }
}

seed()
