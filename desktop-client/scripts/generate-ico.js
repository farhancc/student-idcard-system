const fs = require('fs');
const path = require('path');

const inputPng = path.join(__dirname, '../build/icon.png');
const outputIco = path.join(__dirname, '../build/icon.ico');

console.log('Converting icon.png to icon.ico...');
import('png-to-ico')
  .then(module => {
    const pngToIco = module.default;
    return pngToIco(inputPng);
  })
  .then(buf => {
    fs.writeFileSync(outputIco, buf);
    console.log('Successfully generated icon.ico at:', outputIco);
  })
  .catch(err => {
    console.error('Error generating icon.ico:', err);
    process.exit(1);
  });
