const axios = require('axios')

const COINGECKO_API = 'https://api.coingecko.com/api/v3'

const CRYPTO_IDS = {
  Bitcoin: 'bitcoin',
  Ethereum: 'ethereum',
  Altres: null,
}

/**
 * Obté el preu actual de la criptomoneda en euros
 * @param {string} moneda - Nom de la moneda (Bitcoin, Ethereum, etc.)
 * @returns {Promise<number>} Preu en euros
 */
async function obtePreu(moneda) {
  try {
    if (!CRYPTO_IDS[moneda]) {
      throw new Error(`Moneda no suportada: ${moneda}`)
    }

    if (moneda === 'Altres') {
      throw new Error('Les monedes "Altres" requereixen especificar el preu manualment')
    }

    const cryptoId = CRYPTO_IDS[moneda]
    const response = await axios.get(`${COINGECKO_API}/simple/price`, {
      params: {
        ids: cryptoId,
        vs_currencies: 'eur',
        timeout: 5000,
      },
    })

    const preu = response.data[cryptoId]?.eur

    if (preu === undefined) {
      throw new Error(`No s'ha pogut obtenir el preu per a ${moneda}`)
    }

    return preu
  } catch (error) {
    console.error(`Error obtenint preu per ${moneda}:`, error.message)
    throw error
  }
}

/**
 * Calcula el valor total d'una quantitat de cripto el euro
 * @param {string} moneda - Nom de la moneda
 * @param {number} quantitat - Quantitat de la moneda
 * @returns {Promise<{ preuUnitariEuro: number, totalEuro: number }>}
 */
async function calculaValor(moneda, quantitat) {
  if (!quantitat || quantitat <= 0) {
    throw new Error('La quantitat ha de ser major que 0')
  }

  const preuUnitariEuro = await obtePreu(moneda)
  const totalEuro = preuUnitariEuro * quantitat

  return {
    preuUnitariEuro,
    totalEuro,
  }
}

module.exports = {
  obtePreu,
  calculaValor,
}
