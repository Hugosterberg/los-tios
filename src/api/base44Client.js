import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

/**
 * All app data (entities, auth, functions) goes through the Base44 JS SDK.
 * Connection is configured via `appParams` (URL query, localStorage, or `VITE_BASE44_*` env).
 * There is no direct `@supabase/supabase-js` client in this frontend — the hosted backend
 * (which may use Postgres/Supabase on the server side) is accessed only through this SDK.
 */
const { appId, serverUrl, token, functionsVersion } = appParams;
const hasBackendConfig = Boolean(appId && serverUrl);

const createNoopEntityClient = () => ({
  list: async () => [],
  get: async () => null,
  create: async (payload = {}) => {
    const p = payload && typeof payload === "object" ? payload : {};
    return { ...p, id: p.id ?? `noop-${Date.now()}` };
  },
  update: async (_id, payload = {}) => payload,
  delete: async (id) => ({ id }),
});

const createLocalNoopClient = () => ({
  entities: new Proxy(
    {},
    {
      get: () => createNoopEntityClient(),
    },
  ),
  auth: {
    me: async () => null,
    logout: () => {},
    redirectToLogin: () => {},
  },
  appLogs: {
    logUserInApp: async () => null,
  },
  integrations: new Proxy(
    {},
    {
      get: () => ({
        invoke: async () => null,
      }),
    },
  ),
  functions: {
    invoke: async () => null,
  },
});

// Create a client with authentication required
export const base44 = hasBackendConfig
  ? createClient({
      appId,
      serverUrl,
      token,
      functionsVersion,
      requiresAuth: false,
    })
  : createLocalNoopClient();
