const { app, BrowserWindow, ipcMain, shell, nativeImage, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const XLSX = require('xlsx');
const AdmZip = require('adm-zip');

let mainWindow;

function getPortalUrl() {
  if (app.isPackaged) {
    return 'https://idexocards.vercel.app';
  }
  return process.env.PORTAL_URL || 'https://idexocards.vercel.app';
}

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
  const portalUrl = getPortalUrl();
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
  const iconPath = path.join(__dirname, 'icon.png');
  const appIcon = nativeImage.createFromPath(iconPath);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "IDexo Press Client",
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Enable F12 and Ctrl+Shift+I to toggle DevTools for easy troubleshooting
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      const isDevToolsCombo = (input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i';
      const isF12 = input.key === 'F12';
      if (isDevToolsCombo || isF12) {
        mainWindow.webContents.toggleDevTools();
        event.preventDefault();
      }
    }
  });

  // Log renderer console messages directly to terminal stdout
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const levels = ['DEBUG', 'INFO', 'WARNING', 'ERROR'];
    console.log(`[Renderer Console - ${levels[level] || 'LOG'}] ${message} (at ${path.basename(sourceId)}:${line})`);
  });

  const portalUrl = getPortalUrl();
  const startUrl = `${portalUrl}/login`;
  console.log('Loading startup URL:', startUrl);
  
  // Track page loading status
  mainWindow.webContents.on('did-start-loading', () => {
    console.log('Page loading started...');
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Page loaded successfully.');
  });

  mainWindow.loadURL(startUrl);

  // Handle page load failures gracefully by showing our native-looking offline view
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (isMainFrame && !validatedURL.includes('offline.html')) {
      console.error(`Connection failed: ${validatedURL} (Error: ${errorCode} - ${errorDescription})`);
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
  // Register local:// protocol to serve template images stored on disk
  protocol.registerFileProtocol('local', (request, callback) => {
    const url = request.url.replace('local://', '');
    const decodedPath = decodeURIComponent(url);
    try {
      return callback(decodedPath);
    } catch (err) {
      console.error('local:// protocol error:', err);
    }
  });

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('render-process-gone', (event, webContents, details) => {
  console.error('Render process crashed or terminated:', details);
});

app.on('child-process-gone', (event, details) => {
  console.error('Child process terminated:', details);
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

// IPC handler to save template image to local disk and return a local:// URL
ipcMain.handle('save-template-image', async (event, { pressId, fileName, base64Data, mimeType }) => {
  try {
    const ext = fileName.split('.').pop().toLowerCase();
    const safeExt = ['png', 'svg', 'pdf', 'jpg', 'jpeg'].includes(ext) ? ext : 'png';
    const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${safeExt}`;
    const dir = path.join(app.getPath('userData'), 'templates', String(pressId));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const filePath = path.join(dir, uniqueName);
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);

    // For PDFs: convert first page to PNG using pdftoppm
    if (safeExt === 'pdf') {
      const pngPrefix = filePath.replace('.pdf', '');
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      try {
        await execAsync(`pdftoppm -png -r 600 -f 1 -l 1 "${filePath}" "${pngPrefix}"`);
        const generated = `${pngPrefix}-1.png`;
        const target = `${pngPrefix}.png`;
        if (fs.existsSync(generated)) fs.renameSync(generated, target);
        return { success: true, url: `local://${target}`, localPath: target };
      } catch (convErr) {
        console.error('PDF conversion error:', convErr);
        return { success: true, url: `local://${filePath}`, localPath: filePath };
      }
    }

    return { success: true, url: `local://${filePath}`, localPath: filePath };
  } catch (error) {
    console.error('save-template-image error:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler to search for original local template file
ipcMain.handle('get-local-template-path', async (event, { templateId, side }) => {
  try {
    const dir = path.join(app.getPath('userData'), 'templates');
    if (!fs.existsSync(dir)) return null;

    const files = fs.readdirSync(dir);
    const prefix = `original_${templateId}_${side}.`;
    const match = files.find(f => f.startsWith(prefix));
    if (match) {
      return path.join(dir, match);
    }
    
    // Check in pressId subfolders as fallback
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      if (item.isDirectory()) {
        const subDir = path.join(dir, item.name);
        const subFiles = fs.readdirSync(subDir);
        const subMatch = subFiles.find(f => f.startsWith(prefix));
        if (subMatch) {
          return path.join(subDir, subMatch);
        }
      }
    }
    return null;
  } catch (error) {
    console.error('get-local-template-path error:', error);
    return null;
  }
});

// IPC handler to finalize template originals by copying temp uploads to permanent path
ipcMain.handle('finalize-template-originals', async (event, { templateId, frontLocalPath, backLocalPath }) => {
  try {
    const dir = path.join(app.getPath('userData'), 'templates');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    if (frontLocalPath) {
      const cleanFrontPath = frontLocalPath.replace('local://', '');
      const ext = path.extname(cleanFrontPath);
      const targetPath = path.join(dir, `original_${templateId}_front${ext}`);
      
      if (fs.existsSync(targetPath)) {
        try { fs.unlinkSync(targetPath); } catch (e) {}
      }
      if (fs.existsSync(cleanFrontPath)) {
        fs.copyFileSync(cleanFrontPath, targetPath);
        console.log(`Finalized front template: copied ${cleanFrontPath} to ${targetPath}`);
      }
    }

    if (backLocalPath) {
      const cleanBackPath = backLocalPath.replace('local://', '');
      const ext = path.extname(cleanBackPath);
      const targetPath = path.join(dir, `original_${templateId}_back${ext}`);
      
      if (fs.existsSync(targetPath)) {
        try { fs.unlinkSync(targetPath); } catch (e) {}
      }
      if (fs.existsSync(cleanBackPath)) {
        fs.copyFileSync(cleanBackPath, targetPath);
        console.log(`Finalized back template: copied ${cleanBackPath} to ${targetPath}`);
      }
    }
    return { success: true };
  } catch (error) {
    console.error('finalize-template-originals error:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler to get Portal URL for the offline page
ipcMain.handle('get-portal-url', () => {
  return getPortalUrl();
});

// IPC handler to reload / reconnect the app
ipcMain.handle('reload-app', () => {
  if (mainWindow) {
    const portalUrl = getPortalUrl();
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
