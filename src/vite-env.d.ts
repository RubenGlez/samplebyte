/// <reference types="vite/client" />

interface Window {
  // exposed in the `electron/preload/index.ts`
  ipcRenderer: import("electron").IpcRenderer;
  api: {
    send: (channel: string, data?: unknown) => void;
    receive: (channel: string, func: (...args: unknown[]) => void) => void;
  };
}
