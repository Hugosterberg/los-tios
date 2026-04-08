import React from "react";
import { ArrowDownAZ, ArrowUpZA, Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

function toCsv(rows, columns) {
  const header = columns.map((column) => column.label).join(",");
  const lines = rows.map((row) =>
    columns
      .map((column) => {
        const raw = row[column.key];
        const value = raw === null || raw === undefined ? "" : String(raw);
        return `"${value.replaceAll('"', '""')}"`;
      })
      .join(",")
  );

  return [header, ...lines].join("\n");
}

export default function InsightTable({
  title,
  subtitle,
  sourceBadge,
  columns,
  rows,
  emptyMessage = "No records found.",
  defaultSortKey,
  searchPlaceholder = "Filter rows",
  className,
}) {
  const [query, setQuery] = React.useState("");
  const [sortKey, setSortKey] = React.useState(defaultSortKey || columns[0]?.key);
  const [direction, setDirection] = React.useState("desc");

  const filteredRows = React.useMemo(() => {
    const loweredQuery = query.toLowerCase();
    const searched = rows.filter((row) =>
      columns.some((column) => String(row[column.key] ?? "").toLowerCase().includes(loweredQuery))
    );

    return [...searched].sort((left, right) => {
      const leftValue = left[sortKey];
      const rightValue = right[sortKey];

      if (typeof leftValue === "number" && typeof rightValue === "number") {
        return direction === "asc" ? leftValue - rightValue : rightValue - leftValue;
      }

      return direction === "asc"
        ? String(leftValue).localeCompare(String(rightValue))
        : String(rightValue).localeCompare(String(leftValue));
    });
  }, [columns, direction, query, rows, sortKey]);

  const exportCsv = () => {
    const blob = new Blob([toCsv(filteredRows, columns)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.toLowerCase().replaceAll(" ", "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleSort = (key) => {
    if (sortKey === key) {
      setDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setDirection("desc");
  };

  return (
    <div className={cn("rounded-2xl border border-yellow-500/20 bg-[#242424]", className)}>
      <div className="flex flex-col gap-3 border-b border-yellow-500/10 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-yellow-400">{title}</h3>
            {sourceBadge ? sourceBadge : null}
          </div>
          {subtitle ? <p className="text-xs text-gray-400">{subtitle}</p> : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 w-full rounded-lg border border-yellow-500/10 bg-[#1a1a1a] pl-9 pr-3 text-sm text-white outline-none transition-colors placeholder:text-gray-500 focus:border-yellow-400/40 sm:w-56"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={exportCsv}
            className="border-yellow-500/20 bg-[#1a1a1a] text-gray-200 hover:bg-[#2b2b2b] hover:text-white"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      <Table className="min-w-full">
        <TableHeader>
          <TableRow className="border-yellow-500/10 hover:bg-transparent">
            {columns.map((column) => (
              <TableHead key={column.key} className="px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-gray-500">
                <button
                  type="button"
                  onClick={() => toggleSort(column.key)}
                  className="inline-flex items-center gap-1 transition-colors hover:text-white"
                >
                  {column.label}
                  {sortKey === column.key ? (
                    direction === "asc" ? <ArrowDownAZ className="h-3 w-3" /> : <ArrowUpZA className="h-3 w-3" />
                  ) : null}
                </button>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredRows.length ? (
            filteredRows.map((row) => (
              <TableRow key={row.id || row.source_system || JSON.stringify(row)} className="border-yellow-500/10 hover:bg-[#1f1f1f]">
                {columns.map((column) => (
                  <TableCell key={column.key} className="px-4 py-3 text-sm text-gray-200">
                    {column.render ? column.render(row[column.key], row) : row[column.key]}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow className="border-yellow-500/10">
              <TableCell colSpan={columns.length} className="px-4 py-10 text-center text-sm text-gray-500">
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
