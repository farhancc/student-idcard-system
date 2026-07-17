const { app, BrowserWindow, ipcMain, shell, nativeImage, protocol, safeStorage, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const ExcelJS = require('exceljs');
const AdmZip = require('adm-zip');

function getSystemPathFromLocalUrl(localUrl) {
  if (!localUrl) return '';
  let urlPath = localUrl.replace(/^local:\/\//i, '');
  if (process.platform === 'win32') {
    if (urlPath.startsWith('/')) {
      urlPath = urlPath.slice(1);
    }
  } else {
    if (!urlPath.startsWith('/')) {
      urlPath = '/' + urlPath;
    }
  }
  return decodeURIComponent(urlPath);
}

function getLocalUrlFromSystemPath(systemPath) {
  if (!systemPath) return '';
  let formattedPath = systemPath.replace(/\\/g, '/');
  if (process.platform === 'win32' && !formattedPath.startsWith('/')) {
    formattedPath = '/' + formattedPath;
  }
  return `local://${formattedPath}`;
}


// Register local:// protocol scheme as privileged to avoid CORS/Fetch errors
protocol.registerSchemesAsPrivileged([
  { scheme: 'local', privileges: { secure: true, standard: true, corsEnabled: true, supportFetchAPI: true } }
]);

// ── Offline Print Queue ────────────────────────────────────────────────────
// Uses a JSON file as a durable local queue. No native modules required.
function getQueueFilePath() {
  return path.join(app.getPath('userData'), 'offline_print_queue.json');
}

function readQueue() {
  try {
    const queuePath = getQueueFilePath();
    if (!fs.existsSync(queuePath)) return [];
    const raw = fs.readFileSync(queuePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[OfflineQueue] Failed to read queue file:', err);
    return [];
  }
}

function writeQueue(queue) {
  try {
    const queuePath = getQueueFilePath();
    // Atomic write: write to .tmp then rename to avoid corruption
    const tmpPath = queuePath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(queue, null, 2), 'utf8');
    fs.renameSync(tmpPath, queuePath);
  } catch (err) {
    console.error('[OfflineQueue] Failed to write queue file:', err);
  }
}

function enqueuePrintLog(entry) {
  const queue = readQueue();
  queue.push({ ...entry, queuedAt: new Date().toISOString(), retries: 0 });
  writeQueue(queue);
  console.log(`[OfflineQueue] Enqueued print log. Queue length: ${queue.length}`);
  return queue.length;
}

async function flushQueueToServer(portalUrl, authToken) {
  const queue = readQueue();
  if (queue.length === 0) return { flushed: 0, failed: 0, remaining: 0 };

  let token = authToken;
  if (!token) {
    try {
      const cookies = await session.defaultSession.cookies.get({ name: 'press_auth_token' });
      if (cookies && cookies.length > 0) {
        token = cookies[0].value;
        console.log('[OfflineQueue] Retrieved auth token from session cookies.');
      } else {
        console.warn('[OfflineQueue] No press_auth_token cookie found in default session.');
      }
    } catch (cookieErr) {
      console.error('[OfflineQueue] Failed to read press_auth_token from session cookies:', cookieErr);
    }
  }

  const surviving = [];
  let flushed = 0;
  let failed = 0;

  for (const entry of queue) {
    try {
      const res = await fetch(`${portalUrl}/api/jobs/production-complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(entry.payload),
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      if (res.ok) {
        flushed++;
        console.log(`[OfflineQueue] Flushed entry for job #${entry.payload?.jobId}`);
      } else {
        const errText = await res.text();
        console.warn(`[OfflineQueue] Server rejected entry (${res.status}): ${errText}`);
        
        // 401 Unauthorized / 403 Forbidden: do not discard immediately, keep for retry
        if (res.status === 401 || res.status === 403) {
          entry.retries = (entry.retries || 0) + 1;
          surviving.push(entry);
          failed++;
        } else if (res.status >= 400 && res.status < 500) {
          // Other 4xx client errors: discard — do not retry bad data
          failed++;
        } else {
          // 5xx server error: keep in queue for next attempt
          entry.retries = (entry.retries || 0) + 1;
          surviving.push(entry);
          failed++;
        }
      }
    } catch (fetchErr) {
      // Network error: keep in queue
      console.warn(`[OfflineQueue] Network error flushing entry:`, fetchErr.message);
      entry.retries = (entry.retries || 0) + 1;
      // Discard after 10 retries to prevent infinite accumulation
      if ((entry.retries || 0) < 10) {
        surviving.push(entry);
      } else {
        console.warn(`[OfflineQueue] Discarding entry after 10 retries.`);
        failed++;
      }
    }
  }

  writeQueue(surviving);
  return { flushed, failed, remaining: surviving.length };
}

let mainWindow;

function getPortalUrl() {
  if (process.env.PORTAL_URL) {
    return process.env.PORTAL_URL;
  }
  return app.isPackaged ? 'https://idexocards.vercel.app' : 'http://localhost:3000';
}

// Configure Auto-Updater targeting secure CDN release path
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

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
    show: false, // Hide initially to ensure focus event fires cleanly on show
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Enable F12 and Ctrl+Shift+I to toggle DevTools for easy troubleshooting
  mainWindow.webContents.on('before-input-event', (event, input) => {
    try {
      if (input && input.type === 'keyDown' && typeof input.key === 'string') {
        const isDevToolsCombo = (input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i';
        const isF12 = input.key === 'F12';
        if (isDevToolsCombo || isF12) {
          mainWindow.webContents.toggleDevTools();
          event.preventDefault();
        }
      }
    } catch (err) {
      console.error('Error in before-input-event handler:', err);
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
  // Register local:// protocol to serve template images stored on disk with CORS headers
  protocol.handle('local', async (request) => {
    const decodedPath = getSystemPathFromLocalUrl(request.url);
    try {
      const fileBuffer = await fs.promises.readFile(decodedPath);
      // Determine content type based on extension
      const ext = path.extname(decodedPath).toLowerCase();
      let contentType = 'application/octet-stream';
      if (ext === '.png') contentType = 'image/png';
      else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
      else if (ext === '.svg') contentType = 'image/svg+xml';
      else if (ext === '.webp') contentType = 'image/webp';
      else if (ext === '.pdf') contentType = 'application/pdf';

      return new Response(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': '*'
        }
      });
    } catch (err) {
      console.error('local:// protocol error:', err);
      return new Response('File not found', { status: 404 });
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
ipcMain.handle('save-pdf', async (event, { fileName, base64Data, clientName }) => {
  try {
    const documentsPath = app.getPath('documents');
    let subfolder = 'production';
    if (fileName.toLowerCase().includes('approval')) {
      subfolder = 'approval';
    } else if (fileName.toLowerCase().includes('invoice')) {
      subfolder = 'invoices';
    }
    const safeClientName = (clientName || 'Client').trim().replace(/[^a-z0-9_-]/gi, '_');
    const targetDir = path.join(documentsPath, 'idexo_prints', safeClientName, subfolder);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const datedFileName = `${dateStr}_${fileName}`;

    const filePath = path.join(targetDir, datedFileName);
    const buffer = Buffer.from(base64Data, 'base64');
    
    fs.writeFileSync(filePath, buffer);
    return { success: true, path: filePath };
  } catch (error) {
    console.error('Failed to save file:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler to save backup ZIP files locally
ipcMain.handle('save-backup', async (event, { clientName, monthName, base64ZipData }) => {
  try {
    const documentsPath = app.getPath('documents');
    const safeClientName = (clientName || 'Client').trim().replace(/[^a-z0-9_-]/gi, '_');
    const targetDir = path.join(documentsPath, 'idexo_prints', safeClientName, 'backups');

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const filePath = path.join(targetDir, `${monthName}.zip`);
    const buffer = Buffer.from(base64ZipData, 'base64');
    fs.writeFileSync(filePath, buffer);
    return { success: true, path: filePath };
  } catch (error) {
    console.error('Failed to save backup zip file:', error);
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
      const { execFile } = require('child_process');
      const { promisify } = require('util');
      const execFileAsync = promisify(execFile);
      try {
        const platform = process.platform === 'win32' ? 'win' : process.platform;
        const binaryName = platform === 'win' ? 'pdftoppm.exe' : 'pdftoppm';

        // 1. Check packaged resource path
        const packagedBinPath = path.join(process.resourcesPath, 'bin', binaryName);
        // 2. Check local project bin path
        const devBinPath = path.join(__dirname, 'bin', platform, binaryName);

        let pdftoppmPath = 'pdftoppm'; // default fallback to system path
        let useBundled = true;

        if (platform !== 'win') {
          // On Linux/macOS, check if system pdftoppm is available first
          try {
            const { execSync } = require('child_process');
            execSync('which pdftoppm', { stdio: 'ignore' });
            useBundled = false; // System pdftoppm is available, use it!
          } catch (e) {
            useBundled = true;
          }
        }

        if (useBundled) {
          if (fs.existsSync(packagedBinPath)) {
            pdftoppmPath = packagedBinPath;
            if (platform !== 'win') {
              try { fs.chmodSync(pdftoppmPath, '755'); } catch (e) {}
            }
          } else if (fs.existsSync(devBinPath)) {
            pdftoppmPath = devBinPath;
            if (platform !== 'win') {
              try { fs.chmodSync(pdftoppmPath, '755'); } catch (e) {}
            }
          }
        }

        const pdftoppmDir = path.dirname(pdftoppmPath);
        const childEnv = { ...process.env };
        if (process.platform === 'win32' && pdftoppmPath !== 'pdftoppm') {
          childEnv.PATH = `${pdftoppmDir};${childEnv.PATH || ''}`;
        }
        await execFileAsync(pdftoppmPath, [
          '-png',
          '-r',
          '600',
          '-f',
          '1',
          '-l',
          '1',
          filePath,
          pngPrefix
        ], {
          cwd: pdftoppmDir === '.' ? undefined : pdftoppmDir,
          env: childEnv
        });
        const generated = `${pngPrefix}-1.png`;
        const target = `${pngPrefix}.png`;
        if (fs.existsSync(generated)) fs.renameSync(generated, target);

        // Read the generated PNG preview as a base64 data URL
        if (fs.existsSync(target)) {
          const pngBuffer = fs.readFileSync(target);
          const pngBase64 = pngBuffer.toString('base64');
          return { success: true, url: `data:image/png;base64,${pngBase64}`, localPath: filePath };
        }
        return { success: true, url: `data:application/pdf;base64,${base64Data}`, localPath: filePath };
      } catch (convErr) {
        console.error('PDF conversion error:', convErr);
        return { success: true, url: `data:application/pdf;base64,${base64Data}`, localPath: filePath };
      }
    }

    const dataUrl = `data:${mimeType || 'image/png'};base64,${base64Data}`;
    return { success: true, url: dataUrl, localPath: filePath };
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
      const cleanFrontPath = getSystemPathFromLocalUrl(frontLocalPath);
      const ext = path.extname(cleanFrontPath);
      const targetPath = path.join(dir, `original_${templateId}_front${ext}`);
      
      if (fs.existsSync(targetPath)) {
        try { fs.unlinkSync(targetPath); } catch (e) {}
      }
      if (fs.existsSync(cleanFrontPath)) {
        fs.copyFileSync(cleanFrontPath, targetPath);
        console.log(`Finalized front template: copied ${cleanFrontPath} to ${targetPath}`);

        // If PDF, also copy the generated PNG preview file
        if (ext === '.pdf') {
          const pngSrc = cleanFrontPath.replace('.pdf', '.png');
          const pngTarget = targetPath.replace('.pdf', '.png');
          if (fs.existsSync(pngSrc)) {
            if (fs.existsSync(pngTarget)) {
              try { fs.unlinkSync(pngTarget); } catch (e) {}
            }
            fs.copyFileSync(pngSrc, pngTarget);
            console.log(`Finalized front template PNG preview: copied ${pngSrc} to ${pngTarget}`);
          }
        }
      }
    }

    if (backLocalPath) {
      const cleanBackPath = getSystemPathFromLocalUrl(backLocalPath);
      const ext = path.extname(cleanBackPath);
      const targetPath = path.join(dir, `original_${templateId}_back${ext}`);
      
      if (fs.existsSync(targetPath)) {
        try { fs.unlinkSync(targetPath); } catch (e) {}
      }
      if (fs.existsSync(cleanBackPath)) {
        fs.copyFileSync(cleanBackPath, targetPath);
        console.log(`Finalized back template: copied ${cleanBackPath} to ${targetPath}`);

        // If PDF, also copy the generated PNG preview file
        if (ext === '.pdf') {
          const pngSrc = cleanBackPath.replace('.pdf', '.png');
          const pngTarget = targetPath.replace('.pdf', '.png');
          if (fs.existsSync(pngSrc)) {
            if (fs.existsSync(pngTarget)) {
              try { fs.unlinkSync(pngTarget); } catch (e) {}
            }
            fs.copyFileSync(pngSrc, pngTarget);
            console.log(`Finalized back template PNG preview: copied ${pngSrc} to ${pngTarget}`);
          }
        }
      }
    }
    return { success: true };
  } catch (error) {
    console.error('finalize-template-originals error:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler to save original template file directly to permanent templates directory
ipcMain.handle('save-template-original', async (event, { templateId, side, base64Data, fileName }) => {
  try {
    const ext = path.extname(fileName).toLowerCase() || '.pdf';
    const dir = path.join(app.getPath('userData'), 'templates');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const filePath = path.join(dir, `original_${templateId}_${side}${ext}`);
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);
    console.log(`[Main Process] Saved template original to: ${filePath}`);

    // For PDFs: convert first page to PNG using pdftoppm so rendering preview can load it
    if (ext === '.pdf') {
      const pngPrefix = filePath.replace('.pdf', '');
      try {
        const platform = process.platform === 'win32' ? 'win' : process.platform;
        const binaryName = platform === 'win' ? 'pdftoppm.exe' : 'pdftoppm';

        const packagedBinPath = path.join(process.resourcesPath, 'bin', binaryName);
        const devBinPath = path.join(__dirname, 'bin', platform, binaryName);

        let pdftoppmPath = 'pdftoppm'; // default fallback
        let useBundled = true;

        if (platform !== 'win') {
          // On Linux/macOS, check if system pdftoppm is available first
          try {
            const { execSync } = require('child_process');
            execSync('which pdftoppm', { stdio: 'ignore' });
            useBundled = false; // System pdftoppm is available, use it!
          } catch (e) {
            useBundled = true;
          }
        }

        if (useBundled) {
          if (fs.existsSync(packagedBinPath)) {
            pdftoppmPath = packagedBinPath;
            if (platform !== 'win') {
              try { fs.chmodSync(pdftoppmPath, '755'); } catch (e) {}
            }
          } else if (fs.existsSync(devBinPath)) {
            pdftoppmPath = devBinPath;
            if (platform !== 'win') {
              try { fs.chmodSync(pdftoppmPath, '755'); } catch (e) {}
            }
          }
        }

        const { execFile } = require('child_process');
        const { promisify } = require('util');
        const execFileAsync = promisify(execFile);

        const pdftoppmDir = path.dirname(pdftoppmPath);
        const childEnv = { ...process.env };
        if (process.platform === 'win32' && pdftoppmPath !== 'pdftoppm') {
          childEnv.PATH = `${pdftoppmDir};${childEnv.PATH || ''}`;
        }
        await execFileAsync(pdftoppmPath, [
          '-png',
          '-r',
          '600',
          '-f',
          '1',
          '-l',
          '1',
          filePath,
          pngPrefix
        ], {
          cwd: pdftoppmDir === '.' ? undefined : pdftoppmDir,
          env: childEnv
        });
        const generated = `${pngPrefix}-1.png`;
        const target = `${pngPrefix}.png`;
        if (fs.existsSync(generated)) fs.renameSync(generated, target);
        console.log(`[Main Process] Generated preview PNG for template original: ${target}`);
      } catch (convErr) {
        console.error('[Main Process] PDF preview generation error during save-template-original:', convErr);
      }
    }

    return { success: true, path: filePath };
  } catch (error) {
    console.error('[Main Process] save-template-original error:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler to download and cache student photos locally
ipcMain.handle('cache-photo', async (event, { cardholderId, photoUrl }) => {
  try {
    const dir = path.join(app.getPath('userData'), 'cached_photos');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Extract file extension from URL or fallback to .jpg
    let ext = '.jpg';
    try {
      const parsedUrl = new URL(photoUrl);
      const pathname = parsedUrl.pathname;
      const dotIndex = pathname.lastIndexOf('.');
      if (dotIndex !== -1) {
        const urlExt = pathname.slice(dotIndex).toLowerCase();
        if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(urlExt)) {
          ext = urlExt;
        }
      }
    } catch (e) {
      // Ignored: fallback to .jpg
    }

    const filePath = path.join(dir, `${cardholderId}${ext}`);

    // If it's already a data URI, write it directly
    if (photoUrl.startsWith('data:')) {
      const matches = photoUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const buffer = Buffer.from(matches[2], 'base64');
        fs.writeFileSync(filePath, buffer);
        return { success: true, localUrl: getLocalUrlFromSystemPath(filePath) };
      }
    }

    // Otherwise download the file
    const response = await fetch(photoUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch photo from ${photoUrl}: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(filePath, buffer);

    return { success: true, localUrl: getLocalUrlFromSystemPath(filePath) };
  } catch (error) {
    console.error(`[Main Process] cache-photo error for cardholder ${cardholderId}:`, error);
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

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Backup_Data');

    sheet.columns = headers.map(h => ({ header: h, key: h, width: 20 }));
    rows.forEach(r => {
      sheet.addRow(r);
    });

    const excelPath = path.join(targetDir, 'backup_data.xlsx');
    await workbook.xlsx.writeFile(excelPath);

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
  }
});

// IPC handlers for secure credentials storage
ipcMain.handle('save-credentials', async (event, { email, password }) => {
  try {
    const data = JSON.stringify({ email, password });
    const dir = app.getPath('userData');
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(data);
      const hex = encrypted.toString('hex');
      const filePath = path.join(dir, 'credentials.enc');
      fs.writeFileSync(filePath, hex, 'utf8');
      // Clean up fallback file if it exists
      const fallbackPath = path.join(dir, 'credentials.json');
      if (fs.existsSync(fallbackPath)) {
        try { fs.unlinkSync(fallbackPath); } catch (e) {}
      }
      return { success: true };
    } else {
      const filePath = path.join(dir, 'credentials.json');
      fs.writeFileSync(filePath, data, 'utf8');
      // Clean up encrypted file if it exists
      const encPath = path.join(dir, 'credentials.enc');
      if (fs.existsSync(encPath)) {
        try { fs.unlinkSync(encPath); } catch (e) {}
      }
      return { success: true };
    }
  } catch (error) {
    console.error('save-credentials error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-credentials', async (event) => {
  try {
    const dir = app.getPath('userData');
    const encPath = path.join(dir, 'credentials.enc');
    const jsonPath = path.join(dir, 'credentials.json');

    if (fs.existsSync(encPath)) {
      const hex = fs.readFileSync(encPath, 'utf8');
      const buffer = Buffer.from(hex, 'hex');
      if (safeStorage && safeStorage.isEncryptionAvailable()) {
        const decrypted = safeStorage.decryptString(buffer);
        return JSON.parse(decrypted);
      }
    }
    
    if (fs.existsSync(jsonPath)) {
      const data = fs.readFileSync(jsonPath, 'utf8');
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.error('load-credentials error:', error);
    return null;
  }
});

ipcMain.handle('clear-credentials', async (event) => {
  try {
    const dir = app.getPath('userData');
    const encPath = path.join(dir, 'credentials.enc');
    const jsonPath = path.join(dir, 'credentials.json');
    if (fs.existsSync(encPath)) {
      try { fs.unlinkSync(encPath); } catch (e) {}
    }
    if (fs.existsSync(jsonPath)) {
      try { fs.unlinkSync(jsonPath); } catch (e) {}
    }
    return { success: true };
  } catch (error) {
    console.error('clear-credentials error:', error);
    return { success: false, error: error.message };
  }
});

// ── Offline Print Queue IPC Handlers ─────────────────────────────────────

// Queue a print log entry for later sync when offline
ipcMain.handle('queue-print-log', async (event, { payload }) => {
  try {
    const queueLength = enqueuePrintLog({ payload });
    return { success: true, queueLength };
  } catch (error) {
    console.error('queue-print-log error:', error);
    return { success: false, error: error.message };
  }
});

// Attempt to flush the offline queue to the server
ipcMain.handle('flush-print-queue', async (event, { authToken }) => {
  try {
    const portalUrl = getPortalUrl();
    const result = await flushQueueToServer(portalUrl, authToken);
    return { success: true, ...result };
  } catch (error) {
    console.error('flush-print-queue error:', error);
    return { success: false, error: error.message };
  }
});

// Get the current offline queue status
ipcMain.handle('get-queue-status', async (event) => {
  try {
    const queue = readQueue();
    return {
      success: true,
      queueLength: queue.length,
      entries: queue.map(e => ({
        jobId: e.payload?.jobId,
        queuedAt: e.queuedAt,
        retries: e.retries || 0,
      })),
    };
  } catch (error) {
    console.error('get-queue-status error:', error);
    return { success: false, queueLength: 0, entries: [] };
  }
});
