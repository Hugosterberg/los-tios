import { useEffect, useLayoutEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import {
  disposeDailyCashPersistence,
  flushDailyCashPersistImmediate,
  initDailyCashPersistenceLocal,
  initDailyCashPersistenceRemote,
} from "@/lib/dailyCashLocal";

/**
 * Bootstraps the Daily Cash store (opening balances, ledger time overrides, manual lines)
 * against AppSettings.daily_cash_store_json. Safe to mount on any page that needs to
 * read/write the store — writes persist to the same AppSettings row regardless of
 * which page wrote them, so e.g. Shopping can set ledger time overrides and DailyCash
 * will pick them up on next render.
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
    (import.meta.env.VITE_LOCAL_DEV_BYPASS_AUTH === "true" ||
      !appParams.appId ||
      !appParams.serverUrl);

  const { data: settings = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: () => base44.entities.AppSettings.list(),
    enabled: !isLocalOnlyMode,
  });

  const settingsRowId = settings[0]?.id ?? null;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const onStoreChangeRef = useRef(onStoreChange);
  onStoreChangeRef.current = onStoreChange;

  useLayoutEffect(() => {
    if (isLocalOnlyMode) {
      disposeDailyCashPersistence();
      initDailyCashPersistenceLocal();
      onStoreChangeRef.current?.();
      return () => {
        void flushDailyCashPersistImmediate();
        disposeDailyCashPersistence();
      };
    }
    if (!settingsRowId) {
      return undefined;
    }

    const cached = queryClient.getQueryData(["appSettings"]);
    const rowFromCache = Array.isArray(cached)
      ? cached.find((r) => r?.id === settingsRowId)
      : null;
    const rowFromRender = Array.isArray(settingsRef.current)
      ? settingsRef.current.find((r) => r?.id === settingsRowId)
      : null;
    const row = rowFromCache ?? rowFromRender;
    const serverJson =
      typeof row?.daily_cash_store_json === "string" ? row.daily_cash_store_json : "";

    const persist = async (json) => {
      await base44.entities.AppSettings.update(settingsRowId, {
        daily_cash_store_json: json,
      });
      queryClient.setQueryData(["appSettings"], (prev) => {
        if (!prev?.length) return prev;
        const first = prev[0];
        if (first?.id !== settingsRowId) return prev;
        return [{ ...first, daily_cash_store_json: json }, ...prev.slice(1)];
      });
    };

    disposeDailyCashPersistence();
    const { migrated, memoryMerged } = initDailyCashPersistenceRemote(serverJson, persist);
    if (migrated || memoryMerged) {
      void flushDailyCashPersistImmediate().catch((err) => {
        console.error("[dailyCash] migration persist failed", err);
      });
    }
    onStoreChangeRef.current?.();

    return () => {
      void flushDailyCashPersistImmediate();
      disposeDailyCashPersistence();
    };
  }, [isLocalOnlyMode, settingsRowId, queryClient]);

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
