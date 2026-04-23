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
 *   bumpStoreTick: () => void;
 *   storeTick: number;
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

  const { data: ledgerRows = [] } = useQuery({
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
      const ledgerRow0 = Array.isArray(cachedLedger) ? cachedLedger[0] : null;

      const serverJson = pickDailyCashHydrationJsonString(ledgerRow0, settingsRow);
      const fromApp = settingsRow?.daily_cash_store_json;
      const fromLedger = ledgerRow0?.[DAILY_CASH_LEDGER_PAYLOAD_FIELD];
      const shouldSeedLedger =
        typeof fromApp === "string" &&
        dailyCashStoreJsonStringHasMeaningfulData(fromApp) &&
        !dailyCashStoreJsonStringHasMeaningfulData(fromLedger);

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
      if (migrated || memoryMerged || shouldSeedLedger) {
        void flushDailyCashPersistImmediate().catch((err) => {
          console.error("[dailyCash] migration / ledger seed persist failed", err);
        });
      }
      if (!cancelled) {
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
  }, [isLocalOnlyMode, settingsRowId, queryClient, ledgerBootstrapKey]);

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

  return { settings, settingsRowId, isLocalOnlyMode };
}
