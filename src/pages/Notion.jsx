import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpen, CheckSquare, FileText, Loader2, RefreshCw,
  Search, ChevronRight, ExternalLink, CheckCircle2, Circle, X
} from "lucide-react";

function extractPlainText(richText = []) {
  return richText.map((t) => t.plain_text || "").join("");
}

function getPageTitle(page) {
  if (!page.properties) return "(untitled)";
  for (const prop of Object.values(page.properties)) {
    if (prop.type === "title" && prop.title?.length > 0) {
      return extractPlainText(prop.title);
    }
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
    if (prop.type === "status") return prop.status?.name;
    if (prop.type === "select" && prop.select) return prop.select.name;
  }
  return null;
}

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
          {checked
            ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            : <Circle className="h-4 w-4 text-gray-500 shrink-0" />}
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
        const isSelected = selectedId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            className={`w-full text-left flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
              isSelected ? "border-yellow-400/50 bg-yellow-400/10" : "border-white/10 bg-[#1a1a1a] hover:bg-white/5"
            }`}
          >
            {isDb
              ? <CheckSquare className="h-4 w-4 shrink-0 text-purple-400" />
              : checkbox === true
                ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                : checkbox === false
                  ? <Circle className="h-4 w-4 shrink-0 text-gray-500" />
                  : <FileText className="h-4 w-4 shrink-0 text-blue-400" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{title}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {status && <span className="mr-2 text-yellow-400/80">{status}</span>}
                {new Date(item.last_edited_time).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
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

  return { results, loading, error, search };
}

function SearchTab() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const { results, loading, error, search } = useNotionSearch();

  const handleSearch = () => {
    if (!query.trim()) return;
    setSelected(null);
    search({ query: query.trim(), page_size: 30 });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Search pages, docs, tasks..."
          className="border-white/10 bg-[#0d0d0d] text-white placeholder:text-gray-500"
        />
        <Button onClick={handleSearch} disabled={loading || !query.trim()} className="bg-yellow-400 text-black hover:bg-yellow-300 shrink-0">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
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

function DocumentsTab() {
  const [selected, setSelected] = useState(null);
  const { results, loading, error, search } = useNotionSearch();
  const [loaded, setLoaded] = useState(false);

  const load = () => {
    setSelected(null);
    setLoaded(true);
    search({ filter: { value: "page", property: "object" }, page_size: 50 });
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">{results.length > 0 ? `${results.length} pages found` : ""}</p>
        <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}
          className="border-white/10 bg-transparent text-gray-300 hover:bg-white/5">
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>
      {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}
      {loading && <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-yellow-400" /></div>}
      {!loading && (
        <div className={`grid gap-4 ${selected ? "lg:grid-cols-2" : "grid-cols-1"}`}>
          <ResultList items={results} selectedId={selected?.id} onSelect={setSelected} emptyMessage="No pages found." />
          {selected && <PageContent key={selected.id} page={selected} onClose={() => setSelected(null)} />}
        </div>
      )}
    </div>
  );
}

function TasksTab() {
  const [selected, setSelected] = useState(null);
  const { results, loading, error, search } = useNotionSearch();

  const load = () => {
    setSelected(null);
    search({ query: "", page_size: 100 });
  };

  useEffect(() => { load(); }, []);

  // Filter: only pages that have a checkbox=false (not done) or a non-done status
  const tasks = results.filter((item) => {
    if (item.object !== "page") return false;
    const checkbox = getCheckboxStatus(item);
    if (checkbox === true) return false; // done
    if (checkbox === false) return true; // todo
    // Check status property
    if (!item.properties) return false;
    for (const [, prop] of Object.entries(item.properties)) {
      if (prop.type === "status") {
        const name = prop.status?.name?.toLowerCase() || "";
        if (name.includes("done") || name.includes("complete") || name.includes("finished")) return false;
        return true;
      }
    }
    return false;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">{!loading && `${tasks.length} open tasks`}</p>
        <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}
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
          <ResultList items={tasks} selectedId={selected?.id} onSelect={setSelected} emptyMessage="No open tasks." />
          {selected && <PageContent key={selected.id} page={selected} onClose={() => setSelected(null)} />}
        </div>
      )}
    </div>
  );
}

export default function NotionPage() {
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
        <Tabs defaultValue="search" className="space-y-6">
          <TabsList className="bg-[#1a1a1a] border border-white/10 p-1 h-auto gap-1">
            <TabsTrigger value="search" className="data-[state=active]:bg-yellow-400/10 data-[state=active]:text-yellow-300 text-gray-400 rounded-lg px-4 py-2">
              <Search className="h-4 w-4 mr-2" /> Search
            </TabsTrigger>
            <TabsTrigger value="documents" className="data-[state=active]:bg-yellow-400/10 data-[state=active]:text-yellow-300 text-gray-400 rounded-lg px-4 py-2">
              <FileText className="h-4 w-4 mr-2" /> Documents
            </TabsTrigger>
            <TabsTrigger value="tasks" className="data-[state=active]:bg-yellow-400/10 data-[state=active]:text-yellow-300 text-gray-400 rounded-lg px-4 py-2">
              <CheckSquare className="h-4 w-4 mr-2" /> Open Tasks
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="mt-0"><SearchTab /></TabsContent>
          <TabsContent value="documents" className="mt-0"><DocumentsTab /></TabsContent>
          <TabsContent value="tasks" className="mt-0"><TasksTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}