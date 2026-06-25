const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const XLSX = require('xlsx');
const AdmZip = require('adm-zip');

let mainWindow;

// Configure Auto-Updater targeting secure CDN release path
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on('checking-for-update', () => {
  console.log('Checking for updates...');
});

autoUpdater.on('update-available', (info) => {
  console.log(`Update available: ${info.version}`);
});

autoUpdater.on('update-not-available', () => {
  console.log('No updates available.');
});

autoUpdater.on('error', (err) => {
  console.error('Auto-updater error:', err);
});

autoUpdater.on('update-downloaded', (info) => {
  console.log(`Update downloaded: version ${info.version}. Installing...`);
  autoUpdater.quitAndInstall();
});

function isVersionOutdated(current, minimum) {
  const parse = v => v.split('.').map(Number);
  const currParts = parse(current);
  const minParts = parse(minimum);
  for (let i = 0; i < 3; i++) {
    if ((currParts[i] || 0) < (minParts[i] || 0)) return true;
    if ((currParts[i] || 0) > (minParts[i] || 0)) return false;
  }
  return false;
}

async function checkCloudVersionCompat() {
  const portalUrl = process.env.PORTAL_URL || 'https://idexocards.vercel.app';
  const appVersion = app.getVersion();
  
  try {
    const response = await fetch(`${portalUrl}/api/desktop/version`);
    if (!response.ok) return;

    const data = await response.json();
    const minVer = data.minimumVersion;

    if (isVersionOutdated(appVersion, minVer)) {
      mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.executeJavaScript(`
          alert("CRITICAL WARNING: Your Press Client version (${appVersion}) is outdated and no longer supported. Please download the latest version (${data.latestVersion}) to continue.");
        `);
      });
    }
  } catch (error) {
    console.error('Failed to execute compatibility checks:', error);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "IDexo Press Client",
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const portalUrl = process.env.PORTAL_URL || 'https://idexocards.vercel.app';
  console.log('Loading startup URL:', `${portalUrl}/dashboard`);
  mainWindow.loadURL(`${portalUrl}/dashboard`);

  // Handle page load failures gracefully by showing our native-looking offline view
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (isMainFrame && !validatedURL.includes('offline.html')) {
      console.log(`Connection failed: ${validatedURL} (Error: ${errorCode} - ${errorDescription})`);
      mainWindow.loadFile(path.join(__dirname, 'offline.html'));
    }
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Execute version verification and update check
  checkCloudVersionCompat();
  autoUpdater.checkForUpdatesAndNotify().catch(err => {
    console.error('Failed to trigger update check:', err);
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handler to save PDF binary buffer directly to OS documents folder
ipcMain.handle('save-pdf', async (event, { fileName, base64Data }) => {
  try {
    const documentsPath = app.getPath('documents');
    let subfolder = 'Production';
    if (fileName.toLowerCase().includes('approval')) {
      subfolder = 'Approvals';
    } else if (fileName.toLowerCase().includes('invoice')) {
      subfolder = 'Invoices';
    }
    const targetDir = path.join(documentsPath, 'Student_ID_Prints', subfolder);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const filePath = path.join(targetDir, fileName);
    const buffer = Buffer.from(base64Data, 'base64');
    
    fs.writeFileSync(filePath, buffer);
    return { success: true, path: filePath };
  } catch (error) {
    console.error('Failed to save file:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler to detect desktop context
ipcMain.handle('is-desktop', () => {
  return true;
});

// IPC handler to get Portal URL for the offline page
ipcMain.handle('get-portal-url', () => {
  return process.env.PORTAL_URL || 'https://idexocards.vercel.app';
});

// IPC handler to reload / reconnect the app
ipcMain.handle('reload-app', () => {
  if (mainWindow) {
    const portalUrl = process.env.PORTAL_URL || 'https://idexocards.vercel.app';
    console.log(`Reconnecting to server at: ${portalUrl}/dashboard`);
    mainWindow.loadURL(`${portalUrl}/dashboard`);
  }
});

// IPC handler for automatic 90-day exceeded data backup
ipcMain.handle('run-backup', async (event, { clientName, templateName, templateFields, records }) => {
  try {
    const documentsPath = app.getPath('documents');
    const safeClientName = clientName.replace(/[^a-z0-9_-]/gi, '_');
    const safeTemplateName = templateName.replace(/[^a-z0-9_-]/gi, '_');
    const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    const targetDir = path.join(documentsPath, 'IDexo_Backups', safeClientName, safeTemplateName, dateStr);
    
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 1. Generate Excel sheet
    const headers = ['ID', 'Photo Filename', ...templateFields];
    const rows = records.map(r => {
      const row = {
        'ID': r.id,
        'Photo Filename': r.photoUrl ? `${r.id}${path.extname(new URL(r.photoUrl).pathname) || '.jpg'}` : 'N/A'
      };
      templateFields.forEach(field => {
        row[field] = r.fields[field] || '';
      });
      return row;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
    XLSX.utils.book_append_sheet(wb, ws, 'Backup_Data');
    
    const excelPath = path.join(targetDir, 'backup_data.xlsx');
    XLSX.writeFile(wb, excelPath);

    // 2. Download photos and package them into ZIP
    const zip = new AdmZip();
    const savedIds = [];

    for (const r of records) {
      if (r.photoUrl) {
        try {
          const extension = path.extname(new URL(r.photoUrl).pathname) || '.jpg';
          const filename = `${r.id}${extension}`;
          
          const response = await fetch(r.photoUrl);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            zip.addFile(filename, buffer);
            savedIds.push(r.id);
          } else {
            console.error(`Failed to download photo for ID ${r.id}: ${response.statusText}`);
            savedIds.push(r.id);
          }
        } catch (downloadErr) {
          console.error(`Error downloading photo for ID ${r.id}:`, downloadErr);
          savedIds.push(r.id);
        }
      } else {
        savedIds.push(r.id);
      }
    }

    if (savedIds.length > 0) {
      const zipPath = path.join(targetDir, 'photos.zip');
      zip.writeZip(zipPath);
    }

    return { success: true, savedIds, path: targetDir };
  } catch (error) {
    console.error('Failed to execute backup:', error);
    return { success: false, error: error.message };
  }
});
