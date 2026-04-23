# Daily Cash — `DailyCashLedger` entity (Base44)

## Create the entity

In Base44, add an entity named **`DailyCashLedger`** with:

| Field | Type | Required |
|-------|------|----------|
| `ledger_payload_json` | Long text (string) | Yes |

No other fields are required for the current app version. Base44 may add `id`, `created_date`, etc. automatically.

## Payload format

`ledger_payload_json` is a **single JSON object** (stringified) with the same shape as the legacy `AppSettings.daily_cash_store_json` field:

- `openings` — object, date key `yyyy-MM-dd` → number  
- `openingCountMeta` — object, date key → `{ updatedAt: ISO string }`  
- `manualLines` — object, date key → array of line objects  
- `detailOverrides` — object, date key → object of row id → string  
- `ledgerTimeOverrides` — object, date key → object of row id → ISO string  
- `openingDiffEvents` — array of manual count / diff events  

You can copy an existing `daily_cash_store_json` value from **App Settings** into `ledger_payload_json` on a new `DailyCashLedger` row to migrate.

## How the app uses it

- Loads `DailyCashLedger.list('-created_date')` and uses **the first row** as the active document.
- If that row is missing or `ledger_payload_json` is empty / not meaningful, it falls back to **`AppSettings.daily_cash_store_json`** until you migrate.
- Saves always go to **`DailyCashLedger.update`** (or **`create`** if no row exists). If that fails (e.g. entity not created yet), it falls back once to **`AppSettings.update`** with `daily_cash_store_json`.

After migration, optional: clear `daily_cash_store_json` on App Settings so all cash state lives only on `DailyCashLedger`.
