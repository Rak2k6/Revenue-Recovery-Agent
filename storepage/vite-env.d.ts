/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_NOTIFICATION_POLL_INTERVAL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  Razorpay?: new (options: Record<string, unknown>) => {
    open: () => void;
    on?: (event: string, handler: (response: unknown) => void) => void;
  };
}
