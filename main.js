// Electron entry point — wraps the HTML5 game in a native desktop window.
// This is the same binary shape you'd ship to Steam (add the Steamworks SDK later).
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0d0c12',
    title: 'The Hundred Tower: District Climb',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      // The game is fully self-contained client-side; no node integration needed.
      nodeIntegration: false
    }
  });

  Menu.setApplicationMenu(null); // hide the default menu bar for a game-like feel
  win.loadFile(path.join(__dirname, 'web', 'index.html'));

  // Smoke-test hook: when SMOKE_TEST=1, quit shortly after the page loads so CI
  // can verify the app boots without leaving a window open.
  if (process.env.SMOKE_TEST === '1') {
    win.webContents.once('did-finish-load', () => {
      console.log('SMOKE_OK: window created and index.html loaded');
      setTimeout(() => app.quit(), 800);
    });
    win.webContents.on('did-fail-load', (_e, code, desc) => {
      console.error('SMOKE_FAIL:', code, desc);
      app.exit(1);
    });
  }

  return win;
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
