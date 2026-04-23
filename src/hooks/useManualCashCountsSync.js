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
 * Loads manual drawer counts from the `ManualCashCount` Base44 entity (one row per save) and
 * mirrors them into {@link listOpeningCountDiffs} via {@link setRemoteManualCountSnapshot}.
 * Legacy blob migration runs in {@link useDailyCashStoreSync} after remote hydration; this hook
 * retries migration if the table was still empty while legacy events remained (e.g. race).
 *
 * @param {{ enabled: boolean; onSnapshotChange?: () => void }} args
 */
export function useManualCashCountsSync({ enabled, onSnapshotChange }) {
  const queryClient = useQueryClient();
  const onSnapRef = useRef(onSnapshotChange);
  onSnapRef.current = onSnapshotChange;
  const lastSnapshotKeyRef = useRef("");

  const q = useQuery({
    queryKey: MANUAL_CASH_COUNTS_QUERY_KEY,
    queryFn: listManualCashCountRows,
    enabled: enabled && getDailyCashPersistenceMode() === "remote",
    staleTime: 30_000,
    retry: false,
  });

  useEffect(() => {
    if (!enabled) {
      lastSnapshotKeyRef.current = "";
      clearRemoteManualCountSnapshot();
      onSnapRef.current?.();
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const push = (events) => {
      const sorted = [...events].sort((a, b) => new Date(b?.ts || 0) - new Date(a?.ts || 0));
      /* Include `dataUpdatedAt` so comment / time edits refetched from the server always refresh the snapshot. */
      const key = `${q.dataUpdatedAt}:${sorted.length}:${sorted.map((e) => e?.id).join("|")}`;
      if (key === lastSnapshotKeyRef.current) return;
      lastSnapshotKeyRef.current = key;
      setRemoteManualCountSnapshot(sorted, true);
      syncOpeningsAfterManualCountsReplace(sorted);
      onSnapRef.current?.();
    };

    if (q.isError) {
      lastSnapshotKeyRef.current = "";
      clearRemoteManualCountSnapshot();
      onSnapRef.current?.();
      return;
    }

    if (!q.isSuccess || q.data === undefined) return;

    const rows = q.data;
    if (rows === null) {
      lastSnapshotKeyRef.current = "";
      clearRemoteManualCountSnapshot();
      onSnapRef.current?.();
      return;
    }

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

  return { manualCashCountsQuery: q };
}
