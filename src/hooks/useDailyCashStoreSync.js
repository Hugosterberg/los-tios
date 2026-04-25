// @ts-nocheck
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import {
  awaitDailyCashRemotePersistIdle,
  dailyCashStoreJsonStringHasMeaningfulData,
  disposeDailyCashPersistence,
  flushDailyCashPersistImmediate,
  initDailyCashPersistenceLocal,
  initDailyCashPersistenceRemote,
} from "@/lib/dailyCashLocal";
import { useManualCashCountsSync } from "@/hooks/useManualCashCountsSync";
import { migrateLegacyManualCountBlobToBase44 } from "@/lib/manualCashCountMigration";
import {
  DAILY_CASH_LEDGER_PAYLOAD_FIELD,
  DAILY_CASH_LEDGER_QUERY_KEY,
  listDailyCashLedgerRows,
  persistDailyCashLedgerPayload,
  pickDailyCashHydrationJsonString,
} from "@/lib/dailyCashLedgerRepository";

/**
 * Bootstraps the Daily Cash store (opening balances, ledger time overrides, manual lines).
 * Production: primary storage is **`DailyCashLedger.ledger_payload_json`**; legacy
 * **`AppSettings.daily_cash_store_json`** is read only if the ledger is empty, and used
 * as a persist fallback if the ledger API fails. Safe to mount on any admin page that
 * reads or writes the store.
 *
 * @returns {{
 *   settings: any[];
 *   settingsRowId: string | null;
 *   isLocalOnlyMode: boolean;
 * }}
 */
export function useDailyCashStoreSync({ onStoreChange } = {}) {
  const queryClient = useQueryClient();

  const isLocalOnlyMode =
    import.meta.env.DEV &&
    (!appParams.appId || !appParams.serverUrl);

  const { data: settings = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: () => base44.entities.AppSettings.list(),
    enabled: !isLocalOnlyMode,
  });

  const { data: ledgerRows = [], isFetched: isLedgerQueryFetched } = useQuery({
    queryKey: DAILY_CASH_LEDGER_QUERY_KEY,
    queryFn: listDailyCashLedgerRows,
    enabled: !isLocalOnlyMode,
    staleTime: 60_000,
    retry: false,
  });

  const settingsRowId = settings[0]?.id ?? null;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const onStoreChangeRef = useRef(onStoreChange);
  onStoreChangeRef.current = onStoreChange;

  const ledgerRow = ledgerRows[0] ?? null;
  const ledgerBootstrapKey = useMemo(
    () =>
      ledgerRow
        ? `${ledgerRow.id}:${String(ledgerRow[DAILY_CASH_LEDGER_PAYLOAD_FIELD] || "").length}`
        : `none:${ledgerRows.length}`,
    [ledgerRow, ledgerRows.length],
  );

  useLayoutEffect(() => {
    if (isLocalOnlyMode) {
      disposeDailyCashPersistence();
      initDailyCashPersistenceLocal();
      onStoreChangeRef.current?.();
      return () => {
        void flushDailyCashPersistImmediate().finally(() => {
          disposeDailyCashPersistence();
        });
      };
    }
    if (!settingsRowId) {
      return undefined;
    }
    /* Wait for the ledger list query to settle. Otherwise `ledgerRows` is [] while loading, we
       hydrate from empty + legacy-only, then when the real row arrives this effect re-runs and
       the cleanup `flush` can overwrite `ledger_payload_json` with that empty store — wiping
       manual count history (`openingDiffEvents`). */
    if (!isLedgerQueryFetched) {
      return undefined;
    }

    let cancelled = false;

    const bootstrap = async () => {
      try {
        await awaitDailyCashRemotePersistIdle();
      } catch {
        /* ignore — idle chain already swallows persist errors */
      }
      if (cancelled) return;

      const cachedSettings = queryClient.getQueryData(["appSettings"]);
      const rowFromCache = Array.isArray(cachedSettings)
        ? cachedSettings.find((r) => r?.id === settingsRowId)
        : null;
      const rowFromRender = Array.isArray(settingsRef.current)
        ? settingsRef.current.find((r) => r?.id === settingsRowId)
        : null;
      const settingsRow = rowFromCache ?? rowFromRender;

      const cachedLedger = queryClient.getQueryData(DAILY_CASH_LEDGER_QUERY_KEY);
      let ledgerRow0 = Array.isArray(cachedLedger) ? cachedLedger[0] : null;
      const fromAppRaw = settingsRow?.daily_cash_store_json;

      /* One-shot server migration: legacy AppSettings blob → DailyCashLedger (no manual copy in Base44 UI). */
      if (
        !cancelled &&
        typeof fromAppRaw === "string" &&
        dailyCashStoreJsonStringHasMeaningfulData(fromAppRaw)
      ) {
        const fromLedgerRaw = ledgerRow0?.[DAILY_CASH_LEDGER_PAYLOAD_FIELD];
        const ledgerHasPayload =
          typeof fromLedgerRaw === "string" &&
          dailyCashStoreJsonStringHasMeaningfulData(fromLedgerRaw);
        if (!ledgerHasPayload) {
          try {
            await persistDailyCashLedgerPayload({
              json: fromAppRaw,
              ledgerRowId: ledgerRow0?.id ?? null,
              settingsRowId,
              queryClient,
            });
            const after = queryClient.getQueryData(DAILY_CASH_LEDGER_QUERY_KEY);
            ledgerRow0 = Array.isArray(after) ? after[0] : ledgerRow0;
          } catch (err) {
            console.warn(
              "[dailyCashLedger] automatic legacy→ledger migration failed (create entity `DailyCashLedger` in Base44?)",
              err,
            );
          }
        }
      }

      const serverJson = pickDailyCashHydrationJsonString(ledgerRow0, settingsRow);

      const persist = async (json) => {
        const led = queryClient.getQueryData(DAILY_CASH_LEDGER_QUERY_KEY);
        const r0 = Array.isArray(led) ? led[0] : null;
        await persistDailyCashLedgerPayload({
          json,
          ledgerRowId: r0?.id ?? null,
          settingsRowId,
          queryClient,
        });
      };

      disposeDailyCashPersistence();
      const { migrated, memoryMerged } = initDailyCashPersistenceRemote(serverJson, persist);
      if (migrated || memoryMerged) {
        try {
          await flushDailyCashPersistImmediate();
        } catch (err) {
          console.error("[dailyCash] migration persist failed", err);
        }
      }
      if (!cancelled) {
        /* Base44: create `ManualCashCount` rows from legacy `openingDiffEvents`, then persist ledger JSON without them. */
        try {
          const mig = await migrateLegacyManualCountBlobToBase44(queryClient);
          if (mig?.ok === false) {
            console.warn("[manualCashCount] bootstrap migration did not complete:", mig?.reason || "unknown");
          }
        } catch (err) {
          console.warn("[manualCashCount] bootstrap migration error", err);
        }
        onStoreChangeRef.current?.();
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
      void flushDailyCashPersistImmediate().finally(() => {
        disposeDailyCashPersistence();
      });
    };
  }, [isLocalOnlyMode, settingsRowId, isLedgerQueryFetched, queryClient, ledgerBootstrapKey]);

  useEffect(() => {
    if (isLocalOnlyMode || !settingsRowId) return undefined;
    const flush = () => {
      void flushDailyCashPersistImmediate();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, [isLocalOnlyMode, settingsRowId]);

  const { isError: manualCountsError, isLoading: manualCountsLoading, refetch: manualCountsRefetch } =
    useManualCashCountsSync({
      enabled: !isLocalOnlyMode && !!settingsRowId && isLedgerQueryFetched,
      onSnapshotChange: () => onStoreChangeRef.current?.(),
    });

  return { settings, settingsRowId, isLocalOnlyMode, manualCountsError, manualCountsLoading, manualCountsRefetch };
}
