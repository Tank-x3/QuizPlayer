const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;

const DATA_DIR = path.join(__dirname, '../docs/data');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile('manager/index.html');
  // win.webContents.openDevTools(); // Uncomment for debugging
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// === IPC Handlers ===

ipcMain.handle('read-file', async (event, filename) => {
  try {
    const filePath = path.join(DATA_DIR, filename);
    let data = await fs.readFile(filePath, 'utf-8');
    // Strip BOM if present
    if (data.charCodeAt(0) === 0xFEFF) {
      data = data.slice(1);
    }
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${filename}:`, error);
    throw error;
  }
});

ipcMain.handle('write-file', async (event, filename, content) => {
  try {
    const filePath = path.join(DATA_DIR, filename);
    await fs.writeFile(filePath, JSON.stringify(content, null, 2), 'utf-8');
    return { success: true };
  } catch (error) {
    console.error(`Error writing ${filename}:`, error);
    throw error;
  }
});

ipcMain.handle('list-files', async () => {
  try {
    const files = await fs.readdir(DATA_DIR);
    return files.filter(file => file.endsWith('.json'));
  } catch (error) {
    console.error('Error listing files:', error);
    throw error;
  }
});

ipcMain.handle('delete-file', async (event, filename) => {
  // Safety check: ensure filename doesn't contain traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new Error('Invalid filename');
  }
  const filePath = path.join(DATA_DIR, filename);
  await fs.unlink(filePath);
  return { success: true };
});
