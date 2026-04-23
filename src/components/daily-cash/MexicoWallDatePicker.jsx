// @ts-nocheck
import { useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { enUS } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { dateFromMexicoDateKey, getMexicoDateKey, isPlainDateKey } from "@/lib/mexicoTime";

const ledgerCalendarClassNames = {
  months: "flex flex-col space-y-3",
  month: "space-y-3",
  caption: "relative flex min-h-[28px] items-center justify-center pt-1",
  caption_label: "text-xs font-medium capitalize text-yellow-200/90",
  nav: "flex items-center space-x-1",
  nav_button: cn(
    "inline-flex h-7 w-7 items-center justify-center rounded-md border border-yellow-500/20 bg-black/40 p-0 text-yellow-500/80 hover:bg-yellow-500/10 hover:text-yellow-200",
  ),
  nav_button_previous: "absolute left-0.5",
  nav_button_next: "absolute right-0.5",
  table: "w-full border-collapse",
  head_row: "flex",
  head_cell: "w-8 rounded-md text-[0.65rem] font-normal text-yellow-600/70",
  row: "mt-1 flex w-full",
  cell: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-transparent",
  day: cn(
    "h-8 w-8 rounded-md p-0 text-[11px] font-normal text-gray-400 aria-selected:opacity-100",
    "hover:bg-yellow-500/10 hover:text-yellow-100",
  ),
  day_selected:
    "bg-yellow-500/25 text-yellow-100 hover:bg-yellow-500/35 hover:text-yellow-50 focus:bg-yellow-500/25 focus:text-yellow-100",
  day_today: "bg-yellow-500/10 font-medium text-yellow-200",
  day_outside: "text-gray-600 opacity-45",
  day_disabled: "text-gray-600 opacity-25",
  day_hidden: "invisible",
};

/**
 * Mexico calendar day (yyyy-MM-dd) — avoids native date input / OS popup styling.
 * @param {{ value: string, onChange: (dateKey: string) => void, onPopoverClose?: (overrideDateKey?: string) => void, className?: string, disabled?: boolean }} props
 */
export function MexicoWallDatePicker({ value, onChange, onPopoverClose, className, disabled }) {
  const [open, setOpen] = useState(false);
  const closedAfterSelect = useRef(false);

  const selected = isPlainDateKey(value) ? dateFromMexicoDateKey(value) : undefined;
  const defaultMonth = selected ?? dateFromMexicoDateKey(getMexicoDateKey(Date.now()));

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          if (closedAfterSelect.current) {
            closedAfterSelect.current = false;
            return;
          }
          onPopoverClose?.();
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={value ? `Date ${value}` : "Pick date"}
          className={cn(
            "inline-flex h-7 min-w-[6.75rem] items-center justify-center gap-1 rounded border border-yellow-500/25 bg-black/35 px-1.5 text-[10px] font-medium tabular-nums text-gray-200 transition hover:border-yellow-400/35 hover:bg-yellow-500/[0.06] focus-visible:outline focus-visible:ring-1 focus-visible:ring-yellow-500/45 disabled:opacity-50",
            className,
          )}
        >
          <CalendarDays className="h-3 w-3 shrink-0 text-yellow-500/55" aria-hidden />
          <span>{value || "—"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-auto border border-yellow-500/20 bg-[#14120c] p-2 shadow-xl outline-none"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Calendar
          mode="single"
          locale={enUS}
          selected={selected}
          defaultMonth={defaultMonth}
          onSelect={(d) => {
            if (!d) return;
            const k = getMexicoDateKey(d);
            onChange(k);
            closedAfterSelect.current = true;
            setOpen(false);
            onPopoverClose?.(k);
          }}
          initialFocus
          className="rounded-lg p-0 [--cell-size:2rem] text-gray-100"
          classNames={ledgerCalendarClassNames}
        />
      </PopoverContent>
    </Popover>
  );
}
