/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AZURE_AD_TENANT_ID: string;
  readonly VITE_AZURE_AD_CLIENT_ID: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_HEALTH_POLL_INTERVAL_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
