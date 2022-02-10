// @ts-check
import fs from 'fs';
import path from 'path';

export function copyDir(srcDir, destDir, skipFiles = []) {
  fs.mkdirSync(destDir, {recursive: true});
  for (const file of fs.readdirSync(srcDir)) {
    const srcFile = path.resolve(srcDir, file);
    const destFile = path.resolve(destDir, file);
    copy(srcFile, destFile, skipFiles);
  }
}

export function copy(src, dest, skipFiles = []) {
  if (skipFiles.some((file) => src.includes(file))) return;

  const stat = fs.statSync(src);

  if (stat.isDirectory()) {
    copyDir(src, dest, skipFiles);
  } else {
    fs.copyFileSync(src, dest);
  }
}
