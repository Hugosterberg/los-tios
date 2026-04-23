// @ts-nocheck
import { Link } from "react-router-dom";
import { BookOpen, Cloud, ExternalLink, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const KEYS_HUB = "/IntegrationsHub?hub=keys";

/**
 * Integrations hub tab: requirements for future Google Drive API integration.
 */
export default function GoogleDriveIntegration() {
  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <div className="border-b border-yellow-500/20 py-5">
        <div className="mx-auto max-w-[1360px] px-3 sm:px-5 lg:px-6">
          <div className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-yellow-400" />
            <div>
              <h1 className="text-lg font-bold text-yellow-400">Google Drive</h1>
              <p className="text-xs text-gray-500">Google Drive API — OAuth 2.0, scopes, and Cloud project setup (prepared for future in-app connection).</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1360px] space-y-6 px-3 py-6 sm:px-5 lg:px-6">
        <Card className="border-white/10 bg-[#242424] shadow-none">
          <CardHeader>
            <CardTitle className="text-base text-yellow-200">What you need (English)</CardTitle>
            <p className="text-sm text-gray-400">
              Google Drive files and metadata are accessed with the <strong className="text-white">Google Drive API</strong> and{" "}
              <strong className="text-white">OAuth 2.0</strong>. You can reuse the same Google Cloud project as Gmail if both are enabled there.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-gray-300">
            <ol className="list-decimal space-y-3 pl-5 marker:text-yellow-400">
              <li>
                In{" "}
                <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" className="text-sky-300 underline underline-offset-2">
                  Google Cloud Console
                </a>
                , select a project and enable the <strong className="text-white">Google Drive API</strong> (<strong className="text-white">APIs &amp; Services → Library</strong>
                ).
              </li>
              <li>
                Complete the <strong className="text-white">OAuth consent screen</strong> and add test users while in testing mode, or complete verification
                for production and broader scopes.
              </li>
              <li>
                Create <strong className="text-white">OAuth 2.0 credentials</strong> suitable for your client (web / installed / service account for
                domain-wide delegation only where appropriate). For user files in a browser app, user OAuth is typical.
              </li>
              <li>
                Choose <strong className="text-white">scopes</strong> deliberately, for example:{" "}
                <code className="rounded bg-black/40 px-1 text-gray-400">https://www.googleapis.com/auth/drive.readonly</code> for read-only access;{" "}
                <code className="rounded bg-black/40 px-1 text-gray-400">https://www.googleapis.com/auth/drive.file</code> for per-file access created or
                opened by the app (often easier for review than full <code className="text-gray-400">drive</code> scope).
              </li>
              <li>
                Register <strong className="text-white">redirect URIs</strong> exactly (production and local dev). Use PKCE for public OAuth clients.
              </li>
              <li>
                Persist <strong className="text-white">refresh tokens</strong> securely on a server; never expose client secrets in front-end bundles for
                production user flows.
              </li>
            </ol>

            <p className="rounded-xl border border-sky-500/20 bg-sky-950/30 p-3 text-xs text-sky-100/90">
              <strong className="text-sky-200">Status:</strong> requirement checklist only — Drive OAuth and storage of tokens in this app are not wired yet.
              Gmail and Drive can share one Cloud project and one consent screen if you plan both.
            </p>

            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline" className="border-white/15 text-gray-200 hover:bg-white/5">
                <Link to={KEYS_HUB}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  API Keys (other integrations)
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-sky-500/40 text-sky-300 hover:bg-sky-500/10">
                <a href="https://developers.google.com/drive/api/guides/about-sdk" target="_blank" rel="noreferrer">
                  Drive API overview
                  <ExternalLink className="ml-2 h-3.5 w-3.5 opacity-70" />
                </a>
              </Button>
              <Button asChild variant="outline" className="border-sky-500/40 text-sky-300 hover:bg-sky-500/10">
                <a href="https://developers.google.com/drive/api/guides/api-specific-auth" target="_blank" rel="noreferrer">
                  Drive scopes &amp; auth
                  <BookOpen className="ml-2 h-3.5 w-3.5 opacity-70" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
