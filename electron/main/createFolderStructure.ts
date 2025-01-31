import fs from "node:fs";
import path from "node:path";
import { app } from "electron";

export function createFolderStructure(): void {
  const dataPath = path.join(app.getPath("userData"), "data");
  const songsPath = path.join(dataPath, "songs");
  const sessionsPath = path.join(dataPath, "sessions");

  if (!fs.existsSync(songsPath)) {
    fs.mkdirSync(songsPath, { recursive: true });
  }

  if (!fs.existsSync(sessionsPath)) {
    fs.mkdirSync(sessionsPath, { recursive: true });
  }
}
