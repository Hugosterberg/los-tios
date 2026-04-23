// @ts-nocheck
import { Link } from "react-router-dom";
import { BookOpen, ExternalLink, KeyRound, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const KEYS_HUB = "/IntegrationsHub?hub=keys";

/**
 * Integrations hub tab: requirements and links for Notion (internal integration token via App Settings).
 */
export default function NotionIntegration() {
  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <div className="border-b border-yellow-500/20 py-5">
        <div className="mx-auto max-w-[1360px] px-3 sm:px-5 lg:px-6">
          <div className="flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-yellow-400" />
            <div>
              <h1 className="text-lg font-bold text-yellow-400">Notion</h1>
              <p className="text-xs text-gray-500">
                Internal integration token and Notion API access used by this app&apos;s Notion workspace and proxy.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1360px] space-y-6 px-3 py-6 sm:px-5 lg:px-6">
        <Card className="border-white/10 bg-[#242424] shadow-none">
          <CardHeader>
            <CardTitle className="text-base text-yellow-200">What you need (English)</CardTitle>
            <p className="text-sm text-gray-400">
              Notion integrations use the official Notion API. This project typically authenticates with an{" "}
              <strong className="text-white">internal integration</strong> secret unless your deployment uses OAuth via the platform.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-gray-300">
            <ol className="list-decimal space-y-3 pl-5 marker:text-yellow-400">
              <li>
                In Notion, open{" "}
                <strong className="text-white">Settings → Connections → Develop or manage integrations</strong> (or go directly to{" "}
                <a
                  href="https://www.notion.so/my-integrations"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-300 underline underline-offset-2"
                >
                  notion.so/my-integrations
                </a>
                ).
              </li>
              <li>
                Create a <strong className="text-white">New integration</strong>, choose the workspace, and copy the{" "}
                <strong className="text-white">Internal Integration Secret</strong> (starts with <code className="text-gray-400">secret_</code>
                ).
              </li>
              <li>
                <strong className="text-white">Share every page or database</strong> the app must read or update: open the page →{" "}
                <strong className="text-white">⋯ → Connections → Connect to</strong> → select your integration. Without this, API calls return
                404 or restricted errors.
              </li>
              <li>
                Paste the secret into this app under <strong className="text-white">API Keys → Notion → Internal integration token</strong>, or set
                the equivalent environment variable for local development if your project defines one.
              </li>
            </ol>

            <p className="rounded-xl border border-yellow-500/15 bg-yellow-500/5 p-3 text-xs text-yellow-100/90">
              Capabilities (content read/write, comments, etc.) depend on what you enable on the integration in Notion. Use least privilege for
              production.
            </p>

            <div className="flex flex-wrap gap-3">
              <Button asChild className="bg-yellow-400 text-black hover:bg-yellow-300">
                <Link to={KEYS_HUB}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Open API Keys (Notion field)
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-white/15 text-gray-200 hover:bg-white/5">
                <Link to="/Notion">
                  <BookOpen className="mr-2 h-4 w-4" />
                  Open Notion workspace
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-sky-500/40 text-sky-300 hover:bg-sky-500/10">
                <a href="https://developers.notion.com/docs/getting-started" target="_blank" rel="noreferrer">
                  Notion API — Getting started
                  <ExternalLink className="ml-2 h-3.5 w-3.5 opacity-70" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
