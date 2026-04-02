import React from "react";

export default function LocalSetupHelp() {
  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-3xl mx-auto pt-10">
        <div className="rounded-2xl border border-yellow-500/20 bg-[#161616] p-8 shadow-2xl">
          <p className="text-xs font-bold tracking-[0.28em] uppercase text-yellow-400 mb-3">Local Setup</p>
          <h1 className="text-3xl font-bold text-yellow-400 mb-4">Base44 config saknas</h1>
          <p className="text-slate-300 mb-6">
            Appen kan byggas lokalt, men for att prata med din riktiga backend behover den Base44-konfiguration i
            <code className="mx-1 rounded bg-black/30 px-2 py-1">.env.local</code>.
          </p>

          <div className="rounded-xl bg-black/30 border border-white/10 p-4 mb-6">
            <p className="text-sm text-slate-200 mb-3">Lagg in detta i <code>.env.local</code>:</p>
            <pre className="text-xs text-yellow-300 whitespace-pre-wrap">{`VITE_BASE44_APP_ID=din_app_id
VITE_BASE44_BACKEND_URL=https://din-base44-backend-url

# Valfritt: for lokal UI-utveckling utan Base44-login
VITE_LOCAL_DEV_BYPASS_AUTH=true

# Valfritt: proxy for /api i Vite dev-servern
VITE_BASE44_APP_BASE_URL=https://din-base44-backend-url`}</pre>
          </div>

          <div className="space-y-2 text-sm text-slate-300">
            <p>1. Kopiera <code>.env.example</code> till <code>.env.local</code>.</p>
            <p>2. Fyll i ditt riktiga <code>APP_ID</code> och backend-URL.</p>
            <p>3. Starta om dev-servern med <code>npm.cmd run dev</code>.</p>
            <p>4. Om du bara behover jobba i UI:t lokalt, satt <code>VITE_LOCAL_DEV_BYPASS_AUTH=true</code>.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
