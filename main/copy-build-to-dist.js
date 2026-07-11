const fs = require('fs');
const path = require('path');

const sourceDir = path.resolve(__dirname, '../build');
const targetDir = path.resolve(__dirname, 'dist');

if (!fs.existsSync(sourceDir)) {
  throw new Error(`Source build directory not found: ${sourceDir}`);
}

fs.rmSync(targetDir, { recursive: true, force: true });
fs.cpSync(sourceDir, targetDir, { recursive: true });
console.log(`Copied ${sourceDir} to ${targetDir}`);