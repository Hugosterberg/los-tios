# Daily Cash — `DailyCashLedger` entity (Base44)

## What you do in Base44 (only this)

1. Create an entity named **`DailyCashLedger`**.
2. Add one string/long-text field: **`ledger_payload_json`** (required).

That is all. **You do not need to paste old JSON by hand** unless the automatic step below fails (e.g. entity missing or API error — then check browser console).

## Automatic migration from App Settings

After deploy, when an admin opens the app (any screen that loads `useDailyCashStoreSync`):

- If **`AppSettings.daily_cash_store_json`** has real data **and** the ledger row has no meaningful `ledger_payload_json` yet, the client **copies the legacy string into `DailyCashLedger`** (`create` or `update` the first row).
- Then the in-memory store hydrates from the ledger.

So migration = **create the entity + field in Base44 → deploy this frontend → log in and load the admin app once**.

## Payload format

`ledger_payload_json` is a **single JSON object** (stringified) with the same shape as the legacy `AppSettings.daily_cash_store_json` field:

- `openings` — object, date key `yyyy-MM-dd` → number  
- `openingCountMeta` — object, date key → `{ updatedAt: ISO string }`  
- `manualLines` — object, date key → array of line objects  
- `detailOverrides` — object, date key → object of row id → string  
- `ledgerTimeOverrides` — object, date key → object of row id → ISO string  
- `openingDiffEvents` — array of manual count / diff events  

## How the app uses it

- Loads `DailyCashLedger.list('-created_date')` and uses **the first row** as the active document.
- If that row is missing or `ledger_payload_json` is empty / not meaningful, it falls back to **`AppSettings.daily_cash_store_json`** until the automatic backfill succeeds.
- Saves go to **`DailyCashLedger.update`** (or **`create`** if no row exists). If that fails (e.g. entity not created yet), it falls back to **`AppSettings.update`** with `daily_cash_store_json`.

Optional cleanup: after you have confirmed data in `DailyCashLedger`, you may clear **`daily_cash_store_json`** on App Settings in Base44 so cash state lives only on the ledger entity.
