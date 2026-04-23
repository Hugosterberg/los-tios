// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

function parseHHmm(value) {
  const m = String(value || "00:00").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return ["00", "00"];
  return [String(Number(m[1])).padStart(2, "0"), String(Number(m[2])).padStart(2, "0")];
}

/**
 * Minimal hour:minute picker (Mexico wall clock display) to avoid native OS time popup styling.
 * @param {{
 *  value: string,
 *  onChange: (nextHHmm: string) => void,
 *  onPopoverClose?: () => void,
 *  onInteractiveCommit?: (nextHHmm: string) => void,
 *  className?: string,
 *  disabled?: boolean
 * }} props
 */
export function MexicoWallTimePicker({ value, onChange, onPopoverClose, onInteractiveCommit, className, disabled }) {
  const [open, setOpen] = useState(false);
  const [h, m] = useMemo(() => parseHHmm(value), [value]);
  const hourColRef = useRef(null);
  const minColRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      const hb = hourColRef.current?.querySelector(`[data-time-val="${h}"]`);
      const mb = minColRef.current?.querySelector(`[data-time-val="${m}"]`);
      hb?.scrollIntoView({ block: "center", behavior: "smooth" });
      mb?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 0);
    return () => window.clearTimeout(t);
  }, [open, h, m]);

  const display = `${h}:${m}`;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onPopoverClose?.();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={`Time ${display}`}
          className={cn(
            "inline-flex h-7 min-w-[4.75rem] items-center justify-center gap-1 rounded border border-yellow-500/25 bg-black/35 px-1.5 text-[10px] font-medium tabular-nums text-gray-200 transition hover:border-yellow-400/35 hover:bg-yellow-500/[0.06] focus-visible:outline focus-visible:ring-1 focus-visible:ring-yellow-500/45 disabled:opacity-50",
            className,
          )}
        >
          <Clock className="h-3 w-3 shrink-0 text-yellow-500/55" aria-hidden />
          <span>{display}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-auto border border-yellow-500/20 bg-[#14120c] p-0 shadow-xl outline-none"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-stretch gap-0.5 p-1.5">
          <div
            ref={hourColRef}
            className="h-36 w-[2.65rem] overflow-y-auto overscroll-y-contain rounded-md border border-yellow-500/10 bg-[#0a0a08] py-0.5 [scrollbar-width:thin] [scrollbar-color:rgba(234,179,8,0.25)_transparent]"
          >
            <div className="flex flex-col gap-px">
              {HOURS.map((hour) => (
                <button
                  key={hour}
                  type="button"
                  data-time-val={hour}
                  className={cn(
                    "mx-0.5 rounded px-1.5 py-0.5 text-center text-[11px] tabular-nums transition",
                    hour === h
                      ? "bg-yellow-500/18 text-yellow-100"
                      : "text-gray-500 hover:bg-white/[0.05] hover:text-gray-300",
                  )}
                  onClick={() => {
                    const next = `${hour}:${m}`;
                    onChange(next);
                    onInteractiveCommit?.(next);
                  }}
                >
                  {hour}
                </button>
              ))}
            </div>
          </div>
          <span className="flex select-none items-center self-center px-0.5 text-[11px] font-light text-yellow-600/40">
            :
          </span>
          <div
            ref={minColRef}
            className="h-36 w-[2.65rem] overflow-y-auto overscroll-y-contain rounded-md border border-yellow-500/10 bg-[#0a0a08] py-0.5 [scrollbar-width:thin] [scrollbar-color:rgba(234,179,8,0.25)_transparent]"
          >
            <div className="flex flex-col gap-px">
              {MINUTES.map((minute) => (
                <button
                  key={minute}
                  type="button"
                  data-time-val={minute}
                  className={cn(
                    "mx-0.5 rounded px-1.5 py-0.5 text-center text-[11px] tabular-nums transition",
                    minute === m
                      ? "bg-yellow-500/18 text-yellow-100"
                      : "text-gray-500 hover:bg-white/[0.05] hover:text-gray-300",
                  )}
                  onClick={() => {
                    const next = `${h}:${minute}`;
                    onChange(next);
                    onInteractiveCommit?.(next);
                  }}
                >
                  {minute}
                </button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
