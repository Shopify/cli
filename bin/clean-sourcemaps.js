import fs from 'fs';
import path from 'node:path';
import glob from 'fast-glob';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
  const packageFolders = glob.sync(`${__dirname}/../packages/*`, {onlyDirectories: true})

  for (const sourceDirectory of packageFolders) {
    const packageName = path.basename(sourceDirectory);

    console.log(`Cleaning sourcemaps from@shopify/${packageName}`);

    const packageDist = path.join(sourceDirectory, 'dist');
    const sourcemaps = glob.sync(`${packageDist}/**/*.map`, {onlyFiles: true});

    for (const sourcemap of sourcemaps) {
      fs.rmSync(sourcemap);
    }
  }
}
)();
