const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');
const AdmZip = require('adm-zip');

const BIN_DIR = path.join(__dirname, '..', 'bin');
const WIN_DIR = path.join(BIN_DIR, 'win');
const LINUX_DIR = path.join(BIN_DIR, 'linux');

// Ensure directories exist
fs.mkdirSync(WIN_DIR, { recursive: true });
fs.mkdirSync(LINUX_DIR, { recursive: true });

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${url}...`);
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: status ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlinkSync(dest);
      reject(err);
    });
  });
}

async function setupWindows() {
  const zipUrl = 'https://github.com/oschwartz10612/poppler-windows/releases/download/v24.02.0-0/Release-24.02.0-0.zip';
  const tmpZipPath = path.join(BIN_DIR, 'poppler-win.zip');

  try {
    // Download zip if not already downloaded
    if (!fs.existsSync(tmpZipPath)) {
      await downloadFile(zipUrl, tmpZipPath);
    }

    console.log('Extracting Windows binaries...');
    const zip = new AdmZip(tmpZipPath);
    const zipEntries = zip.getEntries();

    let extractedCount = 0;
    // We only need the files in poppler-24.02.0/Library/bin/
    for (const entry of zipEntries) {
      if (entry.entryName.includes('Library/bin/') && !entry.isDirectory) {
        const fileName = path.basename(entry.entryName);
        const destPath = path.join(WIN_DIR, fileName);
        
        // Extract file content
        const content = zip.readFile(entry);
        fs.writeFileSync(destPath, content);
        extractedCount++;
      }
    }

    console.log(`Successfully extracted ${extractedCount} Windows binaries/DLLs to bin/win.`);
    
    // Clean up zip
    if (fs.existsSync(tmpZipPath)) {
      fs.unlinkSync(tmpZipPath);
    }
  } catch (err) {
    console.error('Failed to set up Windows binaries:', err);
  }
}

function setupLinux() {
  console.log('Checking for local Linux pdftoppm...');
  try {
    const localPath = execSync('which pdftoppm').toString().trim();
    if (localPath && fs.existsSync(localPath)) {
      const destPath = path.join(LINUX_DIR, 'pdftoppm');
      fs.copyFileSync(localPath, destPath);
      fs.chmodSync(destPath, '755');
      console.log(`Copied local pdftoppm from ${localPath} to bin/linux/pdftoppm`);
    } else {
      console.warn('pdftoppm was not found in system path. Please run "sudo apt-get install poppler-utils" to install it.');
    }
  } catch (err) {
    console.warn('pdftoppm not found in system PATH. Ensure poppler-utils is installed on your Linux build machine.');
  }
}

async function main() {
  console.log('Starting static binary configuration...');
  setupLinux();
  await setupWindows();
  console.log('Binary configuration complete!');
}

main().catch(console.error);
