// @ts-nocheck
import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  clearOpeningDiffEventsFromStore,
  clearRemoteManualCountSnapshot,
  flushDailyCashPersistImmediate,
  getDailyCashPersistenceMode,
  peekOpeningDiffEventsFromStoreBlob,
  setRemoteManualCountSnapshot,
  syncOpeningsAfterManualCountsReplace,
} from "@/lib/dailyCashLocal";
import { migrateLegacyManualCountBlobToBase44 } from "@/lib/manualCashCountMigration";
import {
  MANUAL_CASH_COUNTS_QUERY_KEY,
  listManualCashCountRows,
  manualCashCountRowToEvent,
} from "@/lib/manualCashCountRepository";

/**
 * Loads manual drawer counts from the `ManualCashCount` Base44 entity and mirrors them into
 * {@link listOpeningCountDiffs} via {@link setRemoteManualCountSnapshot}.
 *
 * On query error the last successful snapshot is preserved so the UI keeps showing
 * stale data rather than going blank. The caller receives `isError` / `isLoading` to
 * render the appropriate indicator.
 *
 * @param {{ enabled: boolean; onSnapshotChange?: () => void }} args
 * @returns {{ isError: boolean; isLoading: boolean; refetch: () => void }}
 */
export function useManualCashCountsSync({ enabled, onSnapshotChange }) {
  const queryClient = useQueryClient();
  const onSnapRef = useRef(onSnapshotChange);
  onSnapRef.current = onSnapshotChange;
  const lastSnapshotKeyRef = useRef("");
  const hasEverSucceededRef = useRef(false);

  const q = useQuery({
    queryKey: MANUAL_CASH_COUNTS_QUERY_KEY,
    queryFn: listManualCashCountRows,
    enabled: enabled && getDailyCashPersistenceMode() === "remote",
    staleTime: 30_000,
    retry: 2,
    retryDelay: 3_000,
  });

  useEffect(() => {
    if (!enabled) {
      lastSnapshotKeyRef.current = "";
      hasEverSucceededRef.current = false;
      clearRemoteManualCountSnapshot();
      onSnapRef.current?.();
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const push = (events) => {
      const sorted = [...events].sort((a, b) => new Date(b?.ts || 0) - new Date(a?.ts || 0));
      const key = `${q.dataUpdatedAt}:${sorted.length}:${sorted.map((e) => e?.id).join("|")}`;
      if (key === lastSnapshotKeyRef.current) return;
      lastSnapshotKeyRef.current = key;
      hasEverSucceededRef.current = true;
      setRemoteManualCountSnapshot(sorted, true);
      syncOpeningsAfterManualCountsReplace(sorted);
      onSnapRef.current?.();
    };

    if (q.isError) {
      // Preserve the last known snapshot — don't go blank on a transient error.
      // If we never succeeded, clear so the fallback (local blob) can show.
      if (!hasEverSucceededRef.current) {
        lastSnapshotKeyRef.current = "";
        clearRemoteManualCountSnapshot();
        onSnapRef.current?.();
      }
      return;
    }

    if (!q.isSuccess || q.data === undefined) return;

    const rows = q.data;

    if (rows.length > 0) {
      if (peekOpeningDiffEventsFromStoreBlob().length > 0) {
        clearOpeningDiffEventsFromStore();
        void flushDailyCashPersistImmediate();
      }
      const events = rows.map(manualCashCountRowToEvent).filter(Boolean);
      push(events);
      return;
    }

    const legacy = peekOpeningDiffEventsFromStoreBlob();
    if (legacy.length > 0) {
      void migrateLegacyManualCountBlobToBase44(queryClient).then((mig) => {
        if (mig?.ok && (mig.migratedRows > 0 || mig.clearedLegacyBlob)) {
          return queryClient.invalidateQueries({ queryKey: MANUAL_CASH_COUNTS_QUERY_KEY });
        }
        return undefined;
      });
      return;
    }

    push([]);
  }, [enabled, q.isSuccess, q.isError, q.data, q.dataUpdatedAt, queryClient]);

  return {
    isError: q.isError,
    isLoading: q.isLoading || (q.isFetching && !q.isError),
    refetch: () => queryClient.invalidateQueries({ queryKey: MANUAL_CASH_COUNTS_QUERY_KEY }),
  };
}
