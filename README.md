# Los Tios

Detta projekt ar en Base44-export byggd med Vite och React.

## Krav

- Node.js 20+ rekommenderas
- npm 10+ eller senare

## Lokal setup

1. Installera beroenden:

```powershell
npm.cmd install
```

2. Skapa en lokal miljofil:

```powershell
Copy-Item .env.example .env.local
```

3. Fyll i dessa varden i `.env.local`:

```env
VITE_BASE44_APP_ID=din_app_id_fran_base44
VITE_BASE44_BACKEND_URL=https://din-base44-backend-url
VITE_BASE44_APP_BASE_URL=https://din-base44-backend-url
VITE_LOCAL_DEV_BYPASS_AUTH=false
```

`VITE_BASE44_APP_ID` och `VITE_BASE44_BACKEND_URL` behovs for att appen ska prata med din riktiga backend lokalt.

`VITE_BASE44_APP_BASE_URL` ar valfri och anvands av Vite-pluginen for att proxya `/api` i dev-lage.

Om du bara vill jobba i UI:t lokalt utan att skickas till Base44-login kan du tillfalligt satta:

```env
VITE_LOCAL_DEV_BYPASS_AUTH=true
```

Det bypassar admin-login i dev-lage, men ersatter inte riktig backendkonfiguration om du vill ha riktig data.

## Starta appen

```powershell
npm.cmd run dev
```

Vite visar sedan en lokal adress, oftast `http://localhost:5173`.

## Base44-auth lokalt

Appen laser in Base44-parametrar fran:

- query string, till exempel `app_id`, `server_url`, `access_token`
- annars fran `VITE_BASE44_APP_ID` och `VITE_BASE44_BACKEND_URL`

Om du oppnar appen via en Base44-inloggningsredirect kan `access_token` laggas i URL:en automatiskt och sparas i local storage av appen.

## Felsokning

- Om `npm` blockeras i PowerShell, kor `npm.cmd` i stallet for `npm`.
- Om `npm install` fastnar pa Windows-behorigheter eller antivirus, kor terminalen som Administrator eller tillat installationen utanfor begransad miljo.
- Om appen startar men inte kan prata med backend, kontrollera att `VITE_BASE44_APP_ID` och `VITE_BASE44_BACKEND_URL` stammer.
- Om appen visar en lokal setup-sida saknas Base44-konfiguration i `.env.local`.
