// @ts-nocheck
import { Link } from "react-router-dom";
import { BookOpen, ExternalLink, KeyRound, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const KEYS_HUB = "/IntegrationsHub?hub=keys";

/**
 * Integrations hub tab: requirements for future Gmail (Google) API integration.
 */
export default function GmailIntegration() {
  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <div className="border-b border-yellow-500/20 py-5">
        <div className="mx-auto max-w-[1360px] px-3 sm:px-5 lg:px-6">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-yellow-400" />
            <div>
              <h1 className="text-lg font-bold text-yellow-400">Gmail</h1>
              <p className="text-xs text-gray-500">Google Gmail API — OAuth 2.0 and consent requirements (prepared for future in-app connection).</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1360px] space-y-6 px-3 py-6 sm:px-5 lg:px-6">
        <Card className="border-white/10 bg-[#242424] shadow-none">
          <CardHeader>
            <CardTitle className="text-base text-yellow-200">What you need (English)</CardTitle>
            <p className="text-sm text-gray-400">
              Gmail is accessed through the <strong className="text-white">Google Gmail API</strong> with <strong className="text-white">OAuth 2.0</strong>.
              End users (or your workspace admin) must approve the scopes your app requests. Plan this before wiring credentials into this app.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-gray-300">
            <ol className="list-decimal space-y-3 pl-5 marker:text-yellow-400">
              <li>
                Create or use a <strong className="text-white">Google Cloud project</strong> in{" "}
                <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" className="text-sky-300 underline underline-offset-2">
                  Google Cloud Console
                </a>
                .
              </li>
              <li>
                Enable the <strong className="text-white">Gmail API</strong> for that project (<strong className="text-white">APIs &amp; Services → Library</strong>
                ).
              </li>
              <li>
                Configure the <strong className="text-white">OAuth consent screen</strong>: app name, support email, developer contact, and (for
                production) verification if you use sensitive or restricted scopes.
              </li>
              <li>
                Create <strong className="text-white">OAuth 2.0 Client IDs</strong> (typically <strong className="text-white">Web application</strong> for
                this SPA): note the <strong className="text-white">Client ID</strong> and <strong className="text-white">Client secret</strong>, and register
                correct <strong className="text-white">Authorized JavaScript origins</strong> and{" "}
                <strong className="text-white">Authorized redirect URIs</strong> matching your deployed URL (and localhost for dev).
              </li>
              <li>
                Request only the scopes you need, for example:{" "}
                <code className="rounded bg-black/40 px-1 text-gray-400">https://www.googleapis.com/auth/gmail.readonly</code> for read-only, or{" "}
                <code className="rounded bg-black/40 px-1 text-gray-400">https://www.googleapis.com/auth/gmail.send</code> to send mail — combine
                carefully; broader scopes increase review requirements.
              </li>
              <li>
                Implement the OAuth flow (authorization code with PKCE recommended for public clients) and store{" "}
                <strong className="text-white">refresh tokens</strong> securely server-side; access tokens expire frequently.
              </li>
            </ol>

            <p className="rounded-xl border border-sky-500/20 bg-sky-950/30 p-3 text-xs text-sky-100/90">
              <strong className="text-sky-200">Status:</strong> this screen documents requirements only. Saving Gmail credentials in this app will be added
              when the OAuth + backend pieces are implemented; use API Keys / env for other integrations until then.
            </p>

            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline" className="border-white/15 text-gray-200 hover:bg-white/5">
                <Link to={KEYS_HUB}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  API Keys (other integrations)
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-sky-500/40 text-sky-300 hover:bg-sky-500/10">
                <a href="https://developers.google.com/gmail/api/guides" target="_blank" rel="noreferrer">
                  Gmail API guides
                  <ExternalLink className="ml-2 h-3.5 w-3.5 opacity-70" />
                </a>
              </Button>
              <Button asChild variant="outline" className="border-sky-500/40 text-sky-300 hover:bg-sky-500/10">
                <a href="https://developers.google.com/identity/protocols/oauth2" target="_blank" rel="noreferrer">
                  Google OAuth 2.0
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
