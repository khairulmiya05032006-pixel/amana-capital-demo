import fs from 'fs';
import path from 'path';

function getFiles(dir, files = []) {
  const fileList = fs.readdirSync(dir);
  for (const file of fileList) {
    const name = path.join(dir, file);
    if (fs.statSync(name).isDirectory()) {
      getFiles(name, files);
    } else {
      files.push(name);
    }
  }
  return files;
}

const adminFiles = [...getFiles('views/admin'), ...getFiles('public/css')];
const colorRegex = /(#[0-9A-Fa-f]{3,8}|rgba?\([^)]+\))/g;
const foundColors = new Set();

for (const file of adminFiles) {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = colorRegex.exec(content)) !== null) {
    foundColors.add(match[0].toLowerCase());
  }
}

console.log('=== UNIQUE COLORS FOUND IN ADMIN FILES & CSS ===');
console.log(Array.from(foundColors).sort());
