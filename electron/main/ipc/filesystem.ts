import { ipcMain, dialog } from 'electron'

export function registerFilesystemHandlers(): void {
  ipcMain.handle('fs:pickFile', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Audio', extensions: ['wav', 'mp3', 'flac', 'aiff', 'ogg', 'm4a'] }],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('fs:pickFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    })
    return result.canceled ? null : result.filePaths[0]
  })
}
