/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_DONATION_URL?: string;
  readonly VITE_TRANSPARENCY_URL?: string;
  readonly VITE_ENABLE_ADMIN_UI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
