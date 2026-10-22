/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /** Só desenvolvimento: "true" faz o app entrar sozinho com a conta abaixo (ver App.tsx). Nunca vale em produção. */
  readonly VITE_DEV_AUTO_LOGIN?: string;
  readonly VITE_DEV_AUTO_LOGIN_EMAIL?: string;
  readonly VITE_DEV_AUTO_LOGIN_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
