import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

/**
 * All app data (entities, auth, functions) goes through the Base44 JS SDK.
 * Connection is configured via `appParams` (URL query, localStorage, or `VITE_BASE44_*` env).
 * There is no direct `@supabase/supabase-js` client in this frontend — the hosted backend
 * (which may use Postgres/Supabase on the server side) is accessed only through this SDK.
 */
const { appId, serverUrl, token, functionsVersion } = appParams;

// Create a client with authentication required
export const base44 = createClient({
  appId,
  serverUrl,
  token,
  functionsVersion,
  requiresAuth: false
});
