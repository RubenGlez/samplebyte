import { ipcMain, BrowserWindow } from "electron";
import ytdl from "ytdl-core";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { PassThrough } from "stream";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

ipcMain.on("download-mp3", async (event, videoUrl) => {
  const win = BrowserWindow.getFocusedWindow();

  if (!win) {
    console.error("No hay ventana de navegador enfocada.");
    return;
  }

  // Crear un stream de lectura desde el video de YouTube
  const audioStream = ytdl(videoUrl, { quality: "highestaudio" });
  const passThrough = new PassThrough(); // Un stream a través del cual pasaremos los datos procesados

  ffmpeg(audioStream)
    .audioBitrate(128)
    .format("mp3")
    .on("end", () => {
      console.log("Proceso de conversión a MP3 finalizado.");
      // No necesitamos enviar un archivo, el evento de finalización es suficiente
      // ya que estamos enviando los datos a medida que se generan
    })
    .on("error", (err) => {
      console.error("Error al convertir el video a MP3:", err);
      event.sender.send("mp3-download-error", err.message);
    })
    .pipe(passThrough, { end: true }); // Asegurarse de que el stream de salida se cierre cuando ffmpeg termine

  // Recolectar los datos del stream y enviarlos al proceso de renderizado
  const audioBuffer: Buffer[] = [];
  passThrough.on("data", (chunk) => {
    audioBuffer.push(chunk);
  });

  passThrough.on("end", () => {
    const audioData = Buffer.concat(audioBuffer);
    event.sender.send("mp3-downloaded", audioData);
  });
});
