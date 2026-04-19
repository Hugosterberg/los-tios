import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { invokeNotionProxy } from "@/api/notionClient";
import { useQuery } from "@tanstack/react-query";
import { getResolvedIntegrationSettings } from "@/lib/integrationSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen, CheckSquare, FileText, Loader2, RefreshCw, Search, ChevronRight, ExternalLink, CheckCircle2, Circle } from "lucide-react";

function extractPlainText(richText = []) {
  return richText.map((t) => t.plain_text || "").join("");
}

function getPageTitle(page) {
  if (!page.properties) return page.id;
  for (const prop of Object.values(page.properties)) {
    if (prop.type === "title" && prop.title?.length > 0) {
      return extractPlainText(prop.title);
    }
  }
  return page.id;
}

function buildNotionSearchBody(overrides) {
  const b = { ...overrides };
  if (b.query !== undefined && String(b.query).trim() === "") {
    delete b.query;
  }
  return b;
}

function getCheckboxStatus(page) {
  if (!page.properties) return null;
  for (const [key, prop] of Object.entries(page.properties)) {
    if (prop.type === "checkbox") return { key, checked: prop.checkbox };
  }
  return null;
}

export default function NotionExplorer() {
  const [view, setView] = useState("search"); // "search" | "pages" | "databases"
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPage, setSelectedPage] = useState(null);
  const [pageBlocks, setPageBlocks] = useState([]);
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [error, setError] = useState(null);

  const { data: settings = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: () => base44.entities.AppSettings.list(),
  });
  const integrationSettings = useMemo(
    () => getResolvedIntegrationSettings(settings[0] || {}),
    [settings],
  );

  const callNotion = async (path, method = "GET", body = null) => {
    const payload = { path, method };
    if (body != null) payload.body = body;
    const data = await invokeNotionProxy(payload, integrationSettings);
    return data;
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResults([]);
    setSelectedPage(null);
    try {
      const data = await callNotion("search", "POST", buildNotionSearchBody({ query: query.trim(), page_size: 20 }));
      setResults(data.results || []);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || "Search failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleLoadAll = async (type) => {
    setLoading(true);
    setError(null);
    setResults([]);
    setSelectedPage(null);
    setView(type);
    try {
      const data = await callNotion("search", "POST", {
        filter: { value: type === "pages" ? "page" : "database", property: "object" },
        page_size: 50,
      });
      setResults(data.results || []);
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  };

  const openPage = async (page) => {
    setSelectedPage(page);
    setPageBlocks([]);
    setLoadingBlocks(true);
    try {
      const data = await callNotion(`blocks/${page.id}/children`, "GET");
      setPageBlocks(data.results || []);
    } catch (e) {
      setPageBlocks([]);
    } finally {
      setLoadingBlocks(false);
    }
  };

  const renderBlock = (block) => {
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
        const content = text(block.to_do?.rich_text);
        return (
          <div className="flex items-center gap-2 text-sm">
            {checked
              ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              : <Circle className="h-4 w-4 text-gray-500 shrink-0" />}
            <span className={checked ? "line-through text-gray-500" : "text-gray-300"}>{content}</span>
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
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => { setView("search"); setResults([]); setSelectedPage(null); }}
          className={`border-white/10 bg-transparent text-gray-300 hover:bg-white/5 ${view === "search" ? "border-yellow-400/50 text-yellow-300 bg-yellow-400/10" : ""}`}
        >
          <Search className="h-3.5 w-3.5 mr-1.5" /> Search
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleLoadAll("pages")}
          className={`border-white/10 bg-transparent text-gray-300 hover:bg-white/5 ${view === "pages" && !loading ? "border-yellow-400/50 text-yellow-300 bg-yellow-400/10" : ""}`}
        >
          <FileText className="h-3.5 w-3.5 mr-1.5" /> All Pages
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleLoadAll("databases")}
          className={`border-white/10 bg-transparent text-gray-300 hover:bg-white/5 ${view === "databases" && !loading ? "border-yellow-400/50 text-yellow-300 bg-yellow-400/10" : ""}`}
        >
          <CheckSquare className="h-3.5 w-3.5 mr-1.5" /> Databases / Tasks
        </Button>
      </div>

      {/* Search bar */}
      {view === "search" && (
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search pages, docs, tasks in Notion..."
            className="border-white/10 bg-[#0d0d0d] text-white placeholder:text-gray-500"
          />
          <Button
            type="button"
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="bg-yellow-400 text-black hover:bg-yellow-300 shrink-0"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
        </div>
      )}

      {/* Two-panel layout when page selected */}
      {!loading && (
        <div className={`grid gap-4 ${selectedPage ? "lg:grid-cols-2" : "grid-cols-1"}`}>
          {/* Results list */}
          {results.length > 0 && (
            <div className="space-y-2">
              {selectedPage && <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Results</p>}
              {results.map((item) => {
                const title = getPageTitle(item);
                const isDb = item.object === "database";
                const checkbox = getCheckboxStatus(item);
                const isSelected = selectedPage?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openPage(item)}
                    className={`w-full text-left flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                      isSelected
                        ? "border-yellow-400/50 bg-yellow-400/10"
                        : "border-white/10 bg-[#141414] hover:bg-white/5"
                    }`}
                  >
                    {isDb ? (
                      <CheckSquare className="h-4 w-4 shrink-0 text-purple-400" />
                    ) : checkbox ? (
                      checkbox.checked
                        ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                        : <Circle className="h-4 w-4 shrink-0 text-gray-500" />
                    ) : (
                      <FileText className="h-4 w-4 shrink-0 text-blue-400" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{title || "(untitled)"}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {isDb ? "Database" : "Page"} • {new Date(item.last_edited_time).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-gray-500 hover:text-yellow-400"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      <ChevronRight className={`h-4 w-4 text-gray-500 transition-transform ${isSelected ? "rotate-90" : ""}`} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Page content panel */}
          {selectedPage && (
            <div className="rounded-2xl border border-white/10 bg-[#141414] p-5 space-y-4 max-h-[600px] overflow-y-auto">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Page Content</p>
                  <h3 className="text-base font-semibold text-white">{getPageTitle(selectedPage)}</h3>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => openPage(selectedPage)}
                  className="h-8 w-8 text-gray-500 hover:text-white hover:bg-white/5"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>

              {loadingBlocks && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
                </div>
              )}

              {!loadingBlocks && pageBlocks.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-6">No content found in this page.</p>
              )}

              {!loadingBlocks && pageBlocks.length > 0 && (
                <div className="space-y-2">
                  {pageBlocks.map((block) => {
                    const rendered = renderBlock(block);
                    return rendered ? <div key={block.id}>{rendered}</div> : null;
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!loading && results.length === 0 && !error && view === "search" && (
        <div className="text-center py-12 text-gray-500 text-sm">
          <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
          Search for pages, documents or tasks in your Notion workspace.
        </div>
      )}
    </div>
  );
}