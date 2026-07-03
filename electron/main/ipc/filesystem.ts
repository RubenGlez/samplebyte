import { dialog } from 'electron'
import { handle } from './handle'
import { allowLocalPath } from '../services/localFileAccess'

export function registerFilesystemHandlers(): void {
  handle('fs:pickFile', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Audio', extensions: ['wav', 'mp3', 'flac', 'aiff', 'ogg', 'm4a'] }],
    })
    if (result.canceled) return null
    // The user chose this file, so allow local-file:// to serve it before it lands in any DB row.
    allowLocalPath(result.filePaths[0])
    return result.filePaths[0]
  })

  // Broker a path the renderer obtained out-of-band (a drag-dropped file's path from
  // webUtils.getPathForFile) so it can be played/analysed before autosave persists the project.
  handle('fs:allowPath', (_, filePath: string) => {
    allowLocalPath(filePath)
  })

  handle('fs:pickFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    })
    return result.canceled ? null : result.filePaths[0]
  })
}
