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
  clip_api_key: "",
  clip_api_secret: "",
  clip_api_token: "",
  clip_payments_api_base_url: "https://api.payclip.com",
  clip_settlements_api_base_url: "https://api-gw.payclip.com",
  loyverse_public_key: "",
  loyverse_api_token: "",
  loyverse_api_base_url: "https://api.loyverse.com/v1.0",
};

export const INTEGRATION_SETTINGS_SECTIONS = [
  {
    id: "clip",
    title: "Clip",
    description:
      "Configura la llave publica, la llave secreta y los overrides de Clip para pagos y conciliaciones.",
    themeClassName: "border-yellow-500/20 bg-yellow-50",
    fields: [
      {
        key: "clip_api_key",
        label: "Clave publica",
        placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        secret: false,
        helperText: "Se usa como identificador no secreto para autenticacion basica.",
      },
      {
        key: "clip_api_secret",
        label: "Clave secreta",
        placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        secret: true,
        helperText: "Se combina con la clave publica para generar el token Basic.",
      },
      {
        key: "clip_api_token",
        label: "Token auth opcional",
        placeholder: "Basic base64(api_key:api_secret)",
        secret: true,
        helperText: "Si lo dejas vacio, la app genera el token automaticamente.",
        fullWidth: true,
      },
      {
        key: "clip_payments_api_base_url",
        label: "URL base de pagos",
        placeholder: "https://api.payclip.com",
        secret: false,
      },
      {
        key: "clip_settlements_api_base_url",
        label: "URL base de conciliaciones",
        placeholder: "https://api-gw.payclip.com",
        secret: false,
      },
    ],
  },
  {
    id: "loyverse",
    title: "Loyverse",
    description:
      "Configura las credenciales de Loyverse con un campo publico y uno secreto para mantener la estructura uniforme en admin.",
    themeClassName: "border-blue-500/20 bg-blue-50",
    fields: [
      {
        key: "loyverse_public_key",
        label: "Clave publica",
        placeholder: "public-client-id-opcional",
        secret: false,
        helperText: "Campo reservado para una llave no secreta o identificador publico de la integracion.",
      },
      {
        key: "loyverse_api_token",
        label: "Clave secreta / token",
        placeholder: "your_loyverse_token",
        secret: true,
      },
      {
        key: "loyverse_api_base_url",
        label: "URL base",
        placeholder: "https://api.loyverse.com/v1.0",
        secret: false,
        fullWidth: true,
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
