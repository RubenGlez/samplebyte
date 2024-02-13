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

  try {
    // Obtener información del video
    const videoInfo = await ytdl.getInfo(videoUrl);
    const videoTitle = videoInfo.videoDetails.title;
    // Puedes agregar más metadatos de acuerdo a tus necesidades

    // Crear un stream de lectura desde el video de YouTube
    const audioStream = ytdl.downloadFromInfo(videoInfo, {
      quality: "highestaudio",
    });
    const passThrough = new PassThrough(); // Un stream a través del cual pasaremos los datos procesados

    ffmpeg(audioStream)
      .audioBitrate(128)
      .format("mp3")
      .on("end", () => {
        console.log("Proceso de conversión a MP3 finalizado.");
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
      // Envía los datos de audio junto con los metadatos
      event.sender.send("mp3-downloaded", {
        audioData,
        metadata: {
          title: videoTitle,
          // Otros metadatos aquí
        },
      });
    });
  } catch (error) {
    console.error("Error al obtener información del video:", error);
    if (error instanceof Error) {
      event.sender.send("mp3-download-error", error.message);
    }
  }
});
