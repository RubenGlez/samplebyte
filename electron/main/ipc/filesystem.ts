import { dialog } from 'electron'
import { handle } from './handle'

export function registerFilesystemHandlers(): void {
  handle('fs:pickFile', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Audio', extensions: ['wav', 'mp3', 'flac', 'aiff', 'ogg', 'm4a'] }],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  handle('fs:pickFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    })
    return result.canceled ? null : result.filePaths[0]
  })
}
