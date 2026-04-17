import React from "react";

export default function LocalSetupHelp() {
  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-3xl mx-auto pt-10">
        <div className="rounded-2xl border border-yellow-500/20 bg-[#161616] p-8 shadow-2xl">
          <p className="text-xs font-bold tracking-[0.28em] uppercase text-yellow-400 mb-3">Local Setup</p>
          <h1 className="text-3xl font-bold text-yellow-400 mb-4">Backend configuration missing</h1>
          <p className="text-slate-300 mb-6">
            The app can run locally, but to talk to your real backend it needs an app ID and backend URL in{" "}
            <code className="mx-1 rounded bg-black/30 px-2 py-1">.env.local</code> (see variable names below).
          </p>

          <div className="mb-6 rounded-xl border border-amber-500/25 bg-amber-950/25 p-4 text-sm leading-relaxed text-amber-100/95">
            <p className="font-semibold text-amber-200">Backend not reachable from this build.</p>
            <p className="mt-2">
              Add the <code className="rounded bg-black/40 px-1.5 py-0.5 text-xs">VITE_*</code> variables below in{" "}
              <code className="rounded bg-black/40 px-1.5 py-0.5 text-xs">.env.local</code> so shopping and finance data save to
              your hosted database. Finance data is only kept in this browser if you set{" "}
              <code className="rounded bg-black/40 px-1.5 py-0.5 text-xs">VITE_LOCAL_DEV_FINANCE=true</code> for offline UI work.
            </p>
          </div>

          <div className="rounded-xl bg-black/30 border border-white/10 p-4 mb-6">
            <p className="text-sm text-slate-200 mb-3">Add this to <code>.env.local</code>:</p>
            <pre className="text-xs text-yellow-300 whitespace-pre-wrap">{`VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_BACKEND_URL=https://your-backend-url

# Optional: local UI without login
VITE_LOCAL_DEV_BYPASS_AUTH=true

# Optional: proxy for /api in the Vite dev server
VITE_BASE44_APP_BASE_URL=https://your-backend-url`}</pre>
          </div>

          <div className="space-y-2 text-sm text-slate-300">
            <p>
              1. Copy <code>.env.example</code> to <code>.env.local</code>.
            </p>
            <p>2. Fill in your real app ID and backend URL.</p>
            <p>
              3. Restart the dev server with <code>npm.cmd run dev</code>.
            </p>
            <p>
              4. If you only need to work on the UI locally, set <code>VITE_LOCAL_DEV_BYPASS_AUTH=true</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
