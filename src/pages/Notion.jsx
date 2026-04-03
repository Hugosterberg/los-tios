import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpen, CheckSquare, FileText, Loader2, RefreshCw,
  Search, ChevronRight, ExternalLink, CheckCircle2, Circle, X,
  User, Calendar, Flag, AlertCircle
} from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractPlainText(richText = []) {
  return richText.map((t) => t.plain_text || "").join("");
}

function getPageTitle(page) {
  // Database pages: title is in a property with type "title"
  if (page.properties) {
    for (const prop of Object.values(page.properties)) {
      if (prop.type === "title") {
        const text = extractPlainText(prop.title || []);
        if (text.trim()) return text;
      }
    }
  }
  // Regular pages: title is directly on page.title
  if (page.title) {
    const text = extractPlainText(Array.isArray(page.title) ? page.title : []);
    if (text.trim()) return text;
  }
  return "(untitled)";
}

function getCheckboxStatus(page) {
  if (!page.properties) return null;
  for (const [, prop] of Object.entries(page.properties)) {
    if (prop.type === "checkbox") return prop.checkbox;
  }
  return null;
}

function getTaskStatus(page) {
  if (!page.properties) return null;
  for (const [, prop] of Object.entries(page.properties)) {
    if (prop.type === "status") return { name: prop.status?.name, color: prop.status?.color };
  }
  return null;
}

function getStatusPropertyKey(page) {
  if (!page.properties) return null;
  for (const [key, prop] of Object.entries(page.properties)) {
    if (prop.type === "status") return key;
  }
  return null;
}

function getCheckboxPropertyKey(page) {
  if (!page.properties) return null;
  for (const [key, prop] of Object.entries(page.properties)) {
    if (prop.type === "checkbox") return key;
  }
  return null;
}

function getPageMeta(page) {
  if (!page.properties) return {};
  const meta = {};
  for (const [key, prop] of Object.entries(page.properties)) {
    const k = key.toLowerCase();
    if ((prop.type === "people" || prop.type === "person") && prop.people?.length > 0) {
      meta.assignees = prop.people.map((p) => p.name || p.id).filter(Boolean);
    }
    if (prop.type === "date" && prop.date?.start && (k.includes("due") || k.includes("deadline") || k.includes("date") || k.includes("fecha"))) {
      if (!meta.deadline) meta.deadline = prop.date.start;
    }
    if ((k.includes("priority") || k.includes("prioridad")) && prop.type === "select" && prop.select) {
      meta.priority = prop.select.name;
      meta.priorityColor = prop.select.color;
    }
  }
  return meta;
}

function isTaskDone(item) {
  const checkbox = getCheckboxStatus(item);
  if (checkbox === true) return true;
  if (!item.properties) return false;
  for (const [, prop] of Object.entries(item.properties)) {
    if (prop.type === "status") {
      const name = prop.status?.name?.toLowerCase() || "";
      return name.includes("done") || name.includes("complete") || name.includes("finished");
    }
  }
  return false;
}

const PRIORITY_COLORS = {
  red: "text-red-400 bg-red-500/15 border-red-500/30",
  orange: "text-orange-400 bg-orange-500/15 border-orange-500/30",
  yellow: "text-yellow-400 bg-yellow-500/15 border-yellow-500/30",
  green: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
  blue: "text-blue-400 bg-blue-500/15 border-blue-500/30",
  gray: "text-gray-400 bg-gray-500/15 border-gray-500/30",
  default: "text-gray-400 bg-white/5 border-white/10",
};

const STATUS_COLORS = {
  "In progress": "text-blue-300 bg-blue-500/15 border-blue-500/30",
  "Not started": "text-gray-400 bg-gray-500/10 border-gray-500/20",
  "Done": "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
  "default": "text-yellow-300 bg-yellow-500/10 border-yellow-500/30",
};

// ─── renderBlock ─────────────────────────────────────────────────────────────

function renderBlock(block) {
  const text = (arr) => extractPlainText(arr || []);
  switch (block.type) {
    case "paragraph":
      return <p className="text-gray-300 text-sm leading-relaxed">{text(block.paragraph?.rich_text)}</p>;
    case "heading_1":
      return <h2 className="text-lg font-bold text-white mt-4">{text(block.heading_1?.rich_text)}</h2>;
    case "heading_2":
      return <h3 className="text-base font-semibold text-white mt-3">{text(block.heading_2?.rich_text)}</h3>;
    case "heading_3":
      return <h4 className="text-sm font-semibold text-gray-200 mt-2">{text(block.heading_3?.rich_text)}</h4>;
    case "bulleted_list_item":
      return <li className="text-gray-300 text-sm ml-4 list-disc">{text(block.bulleted_list_item?.rich_text)}</li>;
    case "numbered_list_item":
      return <li className="text-gray-300 text-sm ml-4 list-decimal">{text(block.numbered_list_item?.rich_text)}</li>;
    case "to_do": {
      const checked = block.to_do?.checked;
      return (
        <div className="flex items-center gap-2 text-sm">
          {checked ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" /> : <Circle className="h-4 w-4 text-gray-500 shrink-0" />}
          <span className={checked ? "line-through text-gray-500" : "text-gray-300"}>{text(block.to_do?.rich_text)}</span>
        </div>
      );
    }
    case "quote":
      return <blockquote className="border-l-2 border-yellow-400/50 pl-3 text-gray-400 italic text-sm">{text(block.quote?.rich_text)}</blockquote>;
    case "code":
      return <pre className="bg-black/40 rounded p-3 text-xs text-emerald-300 overflow-x-auto">{text(block.code?.rich_text)}</pre>;
    case "divider":
      return <hr className="border-white/10 my-2" />;
    default:
      return null;
  }
}

// ─── PageContent ─────────────────────────────────────────────────────────────

function PageContent({ page, onClose }) {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    base44.functions.invoke("notionProxy", { path: `blocks/${page.id}/children`, method: "GET" })
      .then((res) => setBlocks(res.data?.results || []))
      .catch(() => setBlocks([]))
      .finally(() => setLoading(false));
  }, [page.id]);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#141414] flex flex-col max-h-[70vh]">
      <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-yellow-400 shrink-0" />
          <h3 className="text-sm font-semibold text-white truncate">{getPageTitle(page)}</h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {page.url && (
            <a href={page.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300">
              <ExternalLink className="h-3.5 w-3.5" /> Open in Notion
            </a>
          )}
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-2">
        {loading && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-yellow-400" /></div>}
        {!loading && blocks.length === 0 && <p className="text-sm text-gray-500 text-center py-6">No content found.</p>}
        {!loading && blocks.map((block) => {
          const rendered = renderBlock(block);
          return rendered ? <div key={block.id}>{rendered}</div> : null;
        })}
      </div>
    </div>
  );
}

// ─── TaskCard ─────────────────────────────────────────────────────────────────

function TaskCard({ item, selectedId, onSelect, onMarkDone }) {
  const [marking, setMarking] = useState(false);
  const title = getPageTitle(item);
  const status = getTaskStatus(item);
  const meta = getPageMeta(item);
  const isSelected = selectedId === item.id;
  const isOverdue = meta.deadline && new Date(meta.deadline) < new Date();
  const deadlineStr = meta.deadline ? new Date(meta.deadline).toLocaleDateString("sv-SE") : null;
  const statusColorClass = STATUS_COLORS[status?.name] || STATUS_COLORS.default;

  const handleMarkDone = async (e) => {
    e.stopPropagation();
    setMarking(true);
    await onMarkDone(item);
    setMarking(false);
  };

  return (
    <div
      className={`rounded-xl border transition-all ${isSelected ? "border-yellow-400/50 bg-yellow-400/10" : "border-white/10 bg-[#1a1a1a]"}`}
    >
      <button
        type="button"
        onClick={() => onSelect(item)}
        className="w-full text-left flex gap-3 px-4 py-3"
      >
        <div className="mt-0.5 shrink-0">
          <Circle className="h-4 w-4 text-gray-500" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{title}</p>

          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {/* Status */}
            {status?.name && (
              <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${statusColorClass}`}>
                {status.name}
              </span>
            )}
            {/* Priority */}
            {meta.priority && (
              <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${PRIORITY_COLORS[meta.priorityColor] || PRIORITY_COLORS[meta.priority?.toLowerCase()] || PRIORITY_COLORS.default}`}>
                <Flag className="h-2.5 w-2.5" />
                {meta.priority}
              </span>
            )}
            {/* Deadline */}
            {deadlineStr && (
              <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${isOverdue ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-white/10 bg-white/5 text-gray-400"}`}>
                {isOverdue ? <AlertCircle className="h-2.5 w-2.5" /> : <Calendar className="h-2.5 w-2.5" />}
                {deadlineStr}
              </span>
            )}
            {/* Assignees */}
            {meta.assignees?.map((name) => (
              <span key={name} className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-gray-400">
                <User className="h-2.5 w-2.5" />
                {name}
              </span>
            ))}
            {/* Created date */}
            <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-gray-400">
              Skapad: {new Date(item.created_time).toLocaleDateString("sv-SE")}
            </span>
            <span className="text-[10px] text-gray-600 ml-auto shrink-0">
              Redigerad: {new Date(item.last_edited_time).toLocaleDateString("sv-SE")}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 self-center">
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-gray-500 hover:text-yellow-400">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <ChevronRight className="h-4 w-4 text-gray-600" />
        </div>
      </button>

      {/* Mark as Done button */}
      <div className="px-4 pb-3 flex justify-end">
        <button
          onClick={handleMarkDone}
          disabled={marking}
          className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-50"
        >
          {marking ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
          Mark as Done
        </button>
      </div>
    </div>
  );
}

// ─── ResultList (for Search + Documents) ─────────────────────────────────────

function ResultList({ items, selectedId, onSelect, emptyMessage }) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-10">{emptyMessage}</p>;
  }
  return (
    <div className="space-y-2">
      {items.map((item) => {
        const title = getPageTitle(item);
        const isDb = item.object === "database";
        const checkbox = getCheckboxStatus(item);
        const status = getTaskStatus(item);
        const meta = getPageMeta(item);
        const isSelected = selectedId === item.id;
        const isOverdue = meta.deadline && new Date(meta.deadline) < new Date();
        const deadlineStr = meta.deadline ? new Date(meta.deadline).toLocaleDateString("sv-SE") : null;
        const statusColorClass = STATUS_COLORS[status?.name] || STATUS_COLORS.default;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            className={`w-full text-left flex gap-3 rounded-xl border px-4 py-3 transition-all ${
              isSelected ? "border-yellow-400/50 bg-yellow-400/10" : "border-white/10 bg-[#1a1a1a] hover:bg-white/5"
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {isDb
                ? <CheckSquare className="h-4 w-4 text-purple-400" />
                : checkbox === true
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  : checkbox === false
                    ? <Circle className="h-4 w-4 text-gray-500" />
                    : <FileText className="h-4 w-4 text-blue-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{title}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                {status?.name && (
                  <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${statusColorClass}`}>
                    {status.name}
                  </span>
                )}
                {meta.priority && (
                  <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${PRIORITY_COLORS[meta.priorityColor] || PRIORITY_COLORS[meta.priority?.toLowerCase()] || PRIORITY_COLORS.default}`}>
                    <Flag className="h-2.5 w-2.5" />{meta.priority}
                  </span>
                )}
                {deadlineStr && (
                  <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${isOverdue ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-white/10 bg-white/5 text-gray-400"}`}>
                    {isOverdue ? <AlertCircle className="h-2.5 w-2.5" /> : <Calendar className="h-2.5 w-2.5" />}
                    {deadlineStr}
                  </span>
                )}
                {meta.assignees?.map((name) => (
                  <span key={name} className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-gray-400">
                    <User className="h-2.5 w-2.5" />{name}
                  </span>
                ))}
                <span className="text-[10px] text-gray-600 ml-auto shrink-0">
                  {new Date(item.last_edited_time).toLocaleDateString("sv-SE")}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 self-center">
              {item.url && (
                <a href={item.url} target="_blank" rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-gray-500 hover:text-yellow-400">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              <ChevronRight className="h-4 w-4 text-gray-600" />
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── useNotionSearch ──────────────────────────────────────────────────────────

function useNotionSearch() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const search = async (body) => {
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      const res = await base44.functions.invoke("notionProxy", { path: "search", method: "POST", body });
      setResults(res.data?.results || []);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  };

  return { results, setResults, loading, error, search };
}

// ─── SearchTab ────────────────────────────────────────────────────────────────

function SearchTab() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const { results, loading, error, search } = useNotionSearch();

  useEffect(() => {
    if (!query.trim()) return;
    const timer = setTimeout(() => {
      setSelected(null);
      search({ query: query.trim(), page_size: 30 });
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search pages, docs, tasks..."
          className="border-white/10 bg-[#0d0d0d] text-white placeholder:text-gray-500"
        />
        {loading && <Loader2 className="h-5 w-5 animate-spin text-yellow-400 self-center shrink-0" />}
      </div>
      {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}
      {loading && <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-yellow-400" /></div>}
      {!loading && results.length === 0 && !error && (
        <div className="text-center py-12 text-gray-500 text-sm">
          <Search className="h-10 w-10 mx-auto mb-3 opacity-20" />
          Search your Notion workspace above.
        </div>
      )}
      {!loading && results.length > 0 && (
        <div className={`grid gap-4 ${selected ? "lg:grid-cols-2" : "grid-cols-1"}`}>
          <ResultList items={results} selectedId={selected?.id} onSelect={setSelected} emptyMessage="No results." />
          {selected && <PageContent key={selected.id} page={selected} onClose={() => setSelected(null)} />}
        </div>
      )}
    </div>
  );
}

// ─── DocumentsTab ─────────────────────────────────────────────────────────────

function DocumentsTab() {
  const [selected, setSelected] = useState(null);
  const { results, loading, error, search } = useNotionSearch();

  const load = () => {
    setSelected(null);
    search({ filter: { value: "page", property: "object" }, page_size: 50, sort: { direction: "ascending", timestamp: "last_edited_time" } });
  };

  useEffect(() => { load(); }, []);

  // Only show pages that are NOT tasks and have a real title
  const docs = results.filter((item) => {
    if (getPageTitle(item) === "(untitled)") return false;
    if (!item.properties) return true;
    const props = Object.values(item.properties);
    return !props.some((p) => p.type === "checkbox" || p.type === "status");
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">{docs.length > 0 ? `${docs.length} documents found` : ""}</p>
        <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}
          className="border-white/10 bg-transparent text-gray-300 hover:bg-white/5">
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>
      {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}
      {loading && <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-yellow-400" /></div>}
      {!loading && (
        <div className={`grid gap-4 ${selected ? "lg:grid-cols-2" : "grid-cols-1"}`}>
          <ResultList items={docs} selectedId={selected?.id} onSelect={setSelected} emptyMessage="No documents found." />
          {selected && <PageContent key={selected.id} page={selected} onClose={() => setSelected(null)} />}
        </div>
      )}
    </div>
  );
}

// ─── TasksTab ─────────────────────────────────────────────────────────────────

function TasksTab({ tasks, loading, error, onRefresh, onMarkDone }) {
  const [selected, setSelected] = useState(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">{!loading && `${tasks.length} open tasks`}</p>
        <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={loading}
          className="border-white/10 bg-transparent text-gray-300 hover:bg-white/5">
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>
      {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}
      {loading && <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-yellow-400" /></div>}
      {!loading && tasks.length === 0 && !error && (
        <div className="text-center py-12 text-gray-500 text-sm">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-20" />
          No open tasks found — everything is done!
        </div>
      )}
      {!loading && tasks.length > 0 && (
        <div className={`grid gap-4 ${selected ? "lg:grid-cols-2" : "grid-cols-1"}`}>
          <div className="space-y-2">
            {tasks.map((item) => (
              <TaskCard
                key={item.id}
                item={item}
                selectedId={selected?.id}
                onSelect={setSelected}
                onMarkDone={onMarkDone}
              />
            ))}
          </div>
          {selected && <PageContent key={selected.id} page={selected} onClose={() => setSelected(null)} />}
        </div>
      )}
    </div>
  );
}

// ─── NotionPage ───────────────────────────────────────────────────────────────

export default function NotionPage() {
  const [allResults, setAllResults] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState(null);

  const fetchTasks = useCallback(async () => {
    setTasksLoading(true);
    setTasksError(null);
    try {
      const res = await base44.functions.invoke("notionProxy", {
        path: "search", method: "POST", body: { query: "", page_size: 100 }
      });
      setAllResults(res.data?.results || []);
    } catch (e) {
      setTasksError(e?.response?.data?.error || e?.message || "Failed to load.");
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, []);

  const tasks = allResults.filter((item) => {
    if (item.object !== "page") return false;
    if (!item.properties) return false;
    const props = Object.values(item.properties);
    const isTask = props.some((p) => p.type === "checkbox" || p.type === "status");
    if (!isTask) return false;
    return !isTaskDone(item);
  });

  const handleMarkDone = async (item) => {
    const checkboxKey = getCheckboxPropertyKey(item);
    const statusKey = getStatusPropertyKey(item);

    let properties = {};
    if (checkboxKey) {
      properties[checkboxKey] = { checkbox: true };
    } else if (statusKey) {
      // Try to set status to "Done" — Notion requires the exact option name that exists
      properties[statusKey] = { status: { name: "Done" } };
    }

    if (Object.keys(properties).length === 0) return;

    await base44.functions.invoke("notionProxy", {
      path: `pages/${item.id}`,
      method: "PATCH",
      body: { properties },
    });

    // Remove from local list optimistically
    setAllResults((prev) => prev.filter((p) => p.id !== item.id));
  };

  return (
    <div className="min-h-screen bg-[#111111] text-white">
      {/* Header */}
      <div className="border-b border-yellow-500/20 bg-gradient-to-r from-[#151515] via-[#1d1602] to-[#151515]">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-yellow-400/10 p-3 text-yellow-300">
              <BookOpen className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Notion</h1>
              <p className="mt-1 text-sm text-gray-400">Browse your workspace — search pages, read documents and manage open tasks.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Tabs defaultValue="tasks" className="space-y-6">
          <TabsList className="bg-[#1a1a1a] border border-white/10 p-1 h-auto gap-1">
            <TabsTrigger value="tasks" className="data-[state=active]:bg-yellow-400/10 data-[state=active]:text-yellow-300 text-gray-400 rounded-lg px-4 py-2">
              <CheckSquare className="h-4 w-4 mr-2" /> Open Tasks
              {tasksLoading
                ? <Loader2 className="ml-1.5 h-3 w-3 animate-spin text-yellow-400" />
                : tasks.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-yellow-400/20 border border-yellow-400/30 px-1.5 py-0.5 text-[10px] font-bold text-yellow-300 leading-none">
                    {tasks.length}
                  </span>
                )}
            </TabsTrigger>
            <TabsTrigger value="documents" className="data-[state=active]:bg-yellow-400/10 data-[state=active]:text-yellow-300 text-gray-400 rounded-lg px-4 py-2">
              <FileText className="h-4 w-4 mr-2" /> Documents
            </TabsTrigger>
            <TabsTrigger value="search" className="data-[state=active]:bg-yellow-400/10 data-[state=active]:text-yellow-300 text-gray-400 rounded-lg px-4 py-2">
              <Search className="h-4 w-4 mr-2" /> Search
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="mt-0"><SearchTab /></TabsContent>
          <TabsContent value="documents" className="mt-0"><DocumentsTab /></TabsContent>
          <TabsContent value="tasks" className="mt-0">
            <TasksTab
              tasks={tasks}
              loading={tasksLoading}
              error={tasksError}
              onRefresh={fetchTasks}
              onMarkDone={handleMarkDone}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}