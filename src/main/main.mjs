import { app, BrowserWindow, dialog, ipcMain, shell, Menu } from 'electron';
// import { ipcMain, Menu } from 'electron';
import { readFile, writeFile } from 'fs/promises';
import { join, basename } from 'path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { create } from 'domain';

// Main is an mjs file so we can use import.meta.url
const __dirname = dirname(fileURLToPath(import.meta.url));

const getCurrentFile = async (browserWindow) => {
  if (currentFile.filePath) return currentFile.filePath;
  if (!browserWindow) return;
  return showSaveDialog(browserWindow);
};

const setCurrentFile = (browserWindow, filePath, content) => {
  currentFile.filePath = filePath;
  currentFile.content = content;

  app.addRecentDocument(filePath);
  browserWindow.setTitle(`${basename(filePath)} - ${app.name}`);
  // macOS
  browserWindow.setRepresentedFilename(filePath);
};

const hasChanges = (content) => {
  return currentFile.content !== content;
};

let currentFile = {
  content: '',
  filePath: undefined,
};

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      sandbox: false,
      // This points to the preload.mjs file in the vite build
      preload: join(__dirname, 'preload.mjs'),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
    // showOpenDialog(mainWindow);
  });

  mainWindow.webContents.openDevTools({
    mode: 'detach',
  });

  return mainWindow;
};

// app.on('ready', createWindow);

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Open File
const openFile = async (browserWindow, filePath) => {
  const content = await readFile(filePath, { encoding: 'utf-8' });
  setCurrentFile(browserWindow, filePath, content);
  browserWindow.webContents.send('file-opened', content, filePath);
};

// Show Open Dialog Window
const showOpenDialog = async (browserWindow) => {
  const result = await dialog.showOpenDialog(browserWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Markdown File', extensions: ['md'] }],
  });

  if (result.canceled) return;
  const [filePath] = result.filePaths;
  openFile(browserWindow, filePath);
};

// Export HTML
const exportHlml = async (filePath, html) => {
  await writeFile(filePath, html, { encoding: 'utf-8' });
};

// Show Export HTML Dialog Window
const showExportHtmlDialog = async (browserWindow, html) => {
  const result = await dialog.showSaveDialog(browserWindow, {
    title: 'Export HTML',
    filters: [{ name: 'HTML file', extensions: ['html'] }],
  });
  if (result.canceled) return;
  const { filePath } = result;
  if (!filePath) return;
  exportHlml(filePath, html);
};

// Save File
const saveFile = async (browserWindow, content) => {
  const filePath = await getCurrentFile(browserWindow);
  // const filePath = currentFile.filePath ?? (await showSaveDialog(browserWindow));
  if (!filePath) return;
  await writeFile(filePath, content, { encoding: 'utf-8' });
  setCurrentFile(browserWindow, filePath, content);
};

// Show Save Dialog Window
const showSaveDialog = async (browserWindow, content) => {
  const result = await dialog.showSaveDialog(browserWindow, {
    title: 'Save Markdown',
    filters: [{ name: 'Markdown file', extensions: ['md'] }],
  });
  if (result.canceled) return;
  const { filePath } = result;
  if (!filePath) return;
  return filePath;
};

// IPC Channel: show-open-dialog channel
ipcMain.on('show-open-dialog', (event) => {
  const browserWindow = BrowserWindow.fromWebContents(event.sender);
  if (!browserWindow) return;
  showOpenDialog(browserWindow);
});

// IPC Channel: show-export-html-dialog
ipcMain.on('show-export-html-dialog', async (event, html) => {
  const browserWindow = BrowserWindow.fromWebContents(event.sender);
  if (!browserWindow) return;
  showExportHtmlDialog(browserWindow, html);
});

// IPC Channel: save-file
ipcMain.on('save-file', async (event, content) => {
  const browserWindow = BrowserWindow.fromWebContents(event.sender);
  if (!browserWindow) return;
  await saveFile(browserWindow, content);
});

// IPC Channel: has-changes
ipcMain.handle('has-changes', async (event, content) => {
  const browserWindow = BrowserWindow.fromWebContents(event.sender);
  const changed = hasChanges(content);

  browserWindow?.setDocumentEdited(changed);

  return hasChanges(content);
});

// IPC Channel: show-in-folder
ipcMain.on('show-in-folder', async () => {
  if (currentFile.filePath) {
    await shell.showItemInFolder(currentFile.filePath);
  }
});

// IPC Channel: open-in-default-application
ipcMain.on('open-in-default-application', (event) => {
  if (currentFile.filePath) {
    shell.openPath(currentFile.filePath);
  }
});

// Application Menu
const template = [
  {
    label: 'File',
    submenu: [
      {
        label: 'Open',
        accelerator: 'CommandOrControl+O',
        click: () => {
          let browserWindow = BrowserWindow.getFocusedWindow();
          if (!browserWindow) browserWindow = createWindow();
          showOpenDialog(browserWindow);
        },
      },
    ],
  },
  {
    label: 'Edit',
    role: 'editMenu',
  },
];

// macOS
if (process.platform === 'darwin') {
  template.unshift({ label: app.name, role: 'appMenu' });
}
const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);
