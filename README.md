<p align="center">
	<img src="finpers26/public/finpers26-icon.png" alt="Finances Personals 2026" width="120" />
</p>

# Finances Personals 2026

Aplicació web full-stack per registrar i analitzar les finances personals i de freelance:

- Transaccions d'ingressos, despeses i estalvis
- Gestió de clients (amb dades fiscals)
- Informes i vista de dashboard
- Suport d'adjunts per transacció
- Càlcul de valor en euros per cripto
- Lectura de PDF de factura per extreure base, IVA, IRPF i total

## Stack tecnològic

- **Frontend:** React + TypeScript + Vite + Recharts
- **Backend:** Node.js + Express
- **Base de dades:** MongoDB

## Estat actual

El projecte està separat en dos paquets:

- `finpers26`: aplicació React (Vite)
- `server`: API REST amb Express i MongoDB

### Pàgines implementades (frontend)

- Dashboard (`/`)
- Ingressos (`/ingressos`)
- Despeses (`/despeses`)
- Impostos (`/impostos`)
- Estalvis (`/estalvis`)
- Informes (`/informes`)
- Clients (`/clients`)

### API implementada (backend)

- `GET /api/health`
- `GET/POST/PUT/DELETE /api/transaccions`
- `GET /api/transaccions/cotitzacions/:moneda`
- `PUT /api/transaccions/actualitza-criptos`
- `POST /api/transaccions/parse-factura-pdf`
- `POST /api/transaccions/:id/upload`
- `GET /api/transaccions/:id/descarrega/:fileName`
- `DELETE /api/transaccions/:id/adjunts/:fileName`
- `GET /api/transaccions/:id/adjunts`
- `GET/POST/PUT/DELETE /api/clients`
- `GET /api/clients/actius`
- `PUT /api/clients/:id/reactivar`

## Requisits

- Node.js 20+ recomanat
- npm 10+ recomanat
- Instància MongoDB (local o cloud)

## Configuració

### 1) Instal.lar dependències

```bash
cd finpers26
npm install

cd ../server
npm install
```

### 2) Variables d'entorn backend

Crea el fitxer `server/.env` amb:

```env
MONGO_URI=mongodb://localhost:27017/finpers26
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

## Execució en desenvolupament

Obre dos terminals:

### Terminal 1 (backend)

```bash
cd server
npm run dev
```

### Terminal 2 (frontend)

```bash
cd finpers26
npm run dev
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:3001`

## Notes

- Els fitxers pujats es guarden a `server/uploads` (es crea automàticament si no existeix).
- El backend publica aquests fitxers sota la ruta `/uploads`.
- El càlcul de cripto i el parser de factures depenen de serveis externs i del contingut del PDF.

