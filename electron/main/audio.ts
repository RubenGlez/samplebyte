import { ipcMain, BrowserWindow, app } from "electron";
import ytdl from "ytdl-core";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { PassThrough } from "stream";
import fs from "node:fs/promises";
import path from "node:path";
import { Region } from "wavesurfer.js/dist/plugins/regions";

export type SampleRegion = Pick<Region, "start" | "end">;

export type Session = {
  name: string;
  regions: SampleRegion[];
};

export type Project = Session & {
  song: Buffer;
};

const dataPath = path.join(app.getPath("userData"), "data");
const songsPath = path.join(dataPath, "songs");
const sessionsPath = path.join(dataPath, "sessions");

const saveSong = async (fileName: string, song: Buffer) => {
  const filePath = path.join(songsPath, fileName);
  await fs.writeFile(filePath, song);
};

const retrieveSong = async (fileName: string) => {
  const filePath = path.join(songsPath, fileName);
  const data = await fs.readFile(filePath);
  return data;
};

const saveSession = async (fileName: string, regions: Project["regions"]) => {
  const filePath = path.join(sessionsPath, fileName + ".json");
  await fs.writeFile(filePath, JSON.stringify({ name: fileName, regions }));
};

const retrieveSession = async (fileName: string) => {
  const filePath = path.join(sessionsPath, fileName + ".json");
  const data = await fs.readFile(filePath, { encoding: "utf8" });
  return JSON.parse(data) as Session;
};

const getAllSessions = async () => {
  const files = await fs.readdir(sessionsPath);
  const sessions = await Promise.all(
    files.map(async (file) => {
      const filePath = path.join(sessionsPath, file);
      const data = await fs.readFile(filePath, { encoding: "utf8" });
      return JSON.parse(data) as Session;
    })
  );
  return sessions;
};

export const getAllProjects = async () => {
  try {
    const files = await fs.readdir(sessionsPath);
    const projectNames = files.map((file) => path.basename(file, ".json"));
    return projectNames;
  } catch (error) {
    console.error("Error fetching stored projects:", error);
    throw error;
  }
};

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

ipcMain.on("downloadSong", async (event, videoUrl) => {
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
        event.sender.send("downloadSongError", err.message);
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
      event.sender.send("downloadSongSuccess", {
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
      event.sender.send("downloadSongError", error.message);
    }
  }
});

ipcMain.on("saveProject", async (event, params) => {
  const { name, song, regions } = params as Project;

  const win = BrowserWindow.getFocusedWindow();

  if (!win) {
    console.error("No hay ventana de navegador enfocada.");
    return;
  }

  try {
    const projectName = name.trim();
    const buffer = Buffer.from(song);
    console.log(`Saving project: ${projectName}`);
    await saveSong(projectName, buffer);
    console.log(`Song saved: ${projectName}`);
    await saveSession(projectName, regions);
    console.log(`Session saved: ${projectName}`);
    event.sender.send("saveProjectSuccess");
  } catch (error) {
    console.error("Error al guardar el proyecto:", error);
    if (error instanceof Error) {
      event.sender.send("saveProjectError", error.message);
    }
  }
});

ipcMain.on("retrieveProject", async (event, fileName: string) => {
  const win = BrowserWindow.getFocusedWindow();

  if (!win) {
    console.error("No hay ventana de navegador enfocada.");
    return;
  }

  try {
    const song = await retrieveSong(fileName);
    const session = await retrieveSession(fileName);
    event.sender.send("retrieveProjectSuccess", { song, session });
  } catch (error) {
    console.error("Error al recuperar el proyecto:", error);
    if (error instanceof Error) {
      event.sender.send("retrieveProjectError", error.message);
    }
  }
});

ipcMain.on("getSessions", async (event) => {
  const win = BrowserWindow.getFocusedWindow();

  if (!win) {
    console.error("No hay ventana de navegador enfocada.");
    return;
  }

  try {
    const sessions = await getAllSessions();
    event.sender.send("getSessionsSuccess", { sessions });
  } catch (error) {
    console.error("Error al recuperar las sesiones:", error);
    if (error instanceof Error) {
      event.sender.send("getSessionsError", error.message);
    }
  }
});

ipcMain.on("getStoredProjects", async (event) => {
  try {
    const projects = await getAllProjects();
    console.log(`Retrieved projects: ${projects}`);
    event.sender.send("getStoredProjectsSuccess", projects);
  } catch (error) {
    console.error("Error fetching stored projects:", error);
    if (error instanceof Error) {
      event.sender.send("getStoredProjectsError", error.message);
    }
  }
});
