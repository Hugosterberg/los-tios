export const DEFAULT_APP_SETTINGS = {
  restaurant_name: "Los Tios",
  logo_url: "",
  primary_color: "#DC2626",
  secondary_color: "#F97316",
  accent_color: "#10B981",
  text_color: "#111827",
  background_color: "#F9FAFB",
  theme_style: "modern",
  phone_number: "",
  address: "",
  email: "",
  accept_cash: true,
  accept_card: true,
  bank_name: "",
  bank_account_number: "",
  bank_account_holder: "",
  clabe: "",
  clip_payment_link: "",
  clip_api_key: "38cfbdd5-05f4-4056-957c-1e29aeee2ab9",
  clip_api_secret: "1deb44a5-a307-42f9-a636-515bdc676f6b",
  clip_api_token: "",
  clip_payments_api_base_url: "https://api.payclip.com",
  clip_settlements_api_base_url: "https://api-gw.payclip.com",
  loyverse_public_key: "",
  loyverse_api_token: "",
  loyverse_api_base_url: "https://api.loyverse.com/v1.0",
  /** Optional. If empty, first store from Loyverse API is used when posting receipts. */
  loyverse_store_id: "",
  loyverse_default_category_id: "",
  /** Internal Notion integration secret (secret_…) from https://www.notion.so/my-integrations — optional if OAuth is used. */
  notion_internal_token: "",
};

export const INTEGRATION_SETTINGS_SECTIONS = [
  {
    id: "clip",
    title: "Clip",
    description:
      "Configure the public key, secret key, and Clip overrides for payments and settlements.",
    themeClassName: "border-yellow-500/20 bg-yellow-50",
    fields: [
      {
        key: "clip_api_key",
        label: "Public key",
        placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        secret: false,
        helperText: "Used as the non-secret identifier for basic authentication.",
      },
      {
        key: "clip_api_secret",
        label: "Secret key",
        placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        secret: true,
        helperText: "Combined with the public key to generate the Basic token.",
      },
      {
        key: "clip_api_token",
        label: "Optional auth token",
        placeholder: "Basic base64(api_key:api_secret)",
        secret: true,
        helperText: "If left empty, the app generates the token automatically.",
        fullWidth: true,
      },
      {
        key: "clip_payments_api_base_url",
        label: "Payments base URL",
        placeholder: "https://api.payclip.com",
        secret: false,
      },
      {
        key: "clip_settlements_api_base_url",
        label: "Settlements base URL",
        placeholder: "https://api-gw.payclip.com",
        secret: false,
      },
    ],
  },
  {
    id: "loyverse",
    title: "Loyverse",
    description:
      "Configure Loyverse credentials with one public field and one secret field to keep the admin structure consistent.",
    themeClassName: "border-blue-500/20 bg-blue-50",
    fields: [
      {
        key: "loyverse_public_key",
        label: "Public key",
        placeholder: "public-client-id-opcional",
        secret: false,
        helperText: "Reserved field for a non-secret key or public integration identifier.",
      },
      {
        key: "loyverse_api_token",
        label: "Secret key / token",
        placeholder: "your_loyverse_token",
        secret: true,
      },
      {
        key: "loyverse_api_base_url",
        label: "Base URL",
        placeholder: "https://api.loyverse.com/v1.0",
        secret: false,
        fullWidth: true,
      },
      {
        key: "loyverse_store_id",
        label: "Store ID (for API receipts)",
        placeholder: "Optional — UUID from Loyverse Back Office → Stores",
        secret: false,
        helperText: "Used when syncing completed web orders to Loyverse. Leave empty to use the first store returned by the API.",
        fullWidth: true,
      },
      {
        key: "loyverse_default_category_id",
        label: "Default category ID (for new items from web)",
        placeholder: "Optional — UUID from Loyverse Back Office → Categories",
        secret: false,
        helperText: "Used when creating menu items via API. If empty, the first category from Loyverse is used.",
        fullWidth: true,
      },
    ],
  },
  {
    id: "notion",
    title: "Notion",
    description:
      "Use OAuth from Base44 when available, or paste an internal integration token so the Notion page and proxy work without OAuth.",
    themeClassName: "border-white/10 bg-[#141414]",
    fields: [
      {
        key: "notion_internal_token",
        label: "Internal integration token",
        placeholder: "secret_…",
        secret: true,
        fullWidth: true,
        helperText:
          "Create an internal integration at notion.so/my-integrations (Developers → New integration), copy the secret, then share the pages you need with that integration.",
      },
    ],
  },
];

export function buildDefaultAppSettings(overrides = {}) {
  return {
    ...DEFAULT_APP_SETTINGS,
    ...overrides,
  };
}
