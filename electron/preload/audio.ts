import { ipcRenderer, contextBridge } from "electron";

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld("api", {
  send: (channel: string, data?: unknown) => {
    // Asegúrate de que solo se envíen a canales predefinidos por razones de seguridad
    const validChannels = ["download-mp3"];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },

  receive: (channel: string, func: (...args: unknown[]) => void) => {
    const validChannels = ["mp3-downloaded", "error"];
    if (validChannels.includes(channel)) {
      // Eliminar el listener existente para evitar duplicados
      ipcRenderer.removeAllListeners(channel);
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
});
