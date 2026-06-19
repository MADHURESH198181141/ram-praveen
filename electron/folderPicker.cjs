const { ipcMain, dialog, BrowserWindow } = require('electron');

ipcMain.handle('select-storage-folder', async () => {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(focusedWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Storage Folder',
    buttonLabel: 'Select Folder'
  });
  
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});
