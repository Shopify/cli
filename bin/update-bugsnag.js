#!/usr/bin/env node

import fs from 'fs';
import fsPromise from 'fs/promises'
import path from 'node:path';
import { fileURLToPath } from 'url';
import { node } from "@bugsnag/source-maps";
import reportBuild from 'bugsnag-build-reporter';
import glob from 'fast-glob';
import tmp from 'tmp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appVersion = JSON.parse(fs.readFileSync(`${__dirname}/../packages/cli/package.json`)).version;
const apiKey = '9e1e6889176fd0c795d5c659225e0fae';

(async () => {
  try {
    const packageFolders = glob.sync(`${__dirname}/../packages/*`, {onlyDirectories: true})

    // Process each package, and upload to Bugsnag as `@shopify/package-name/dist/file.js`
    for (const sourceDirectory of packageFolders) {
      const packageName = path.basename(sourceDirectory);

      console.log(`Preparing @shopify/${packageName}`);

      await new Promise((resolve, reject) => {
        tmp.dir({unsafeCleanup: true}, async (err, temporaryDirectory) => {
          if (err) {
            reject(err);
          }
          try {
            const temporaryShopifyPackage = await fsPromise.mkdir(path.join(temporaryDirectory, '@shopify'), { recursive: true});
            const temporaryPackageCopy = await fsPromise.mkdir(path.join(temporaryShopifyPackage, `${packageName}`), { recursive: true });

            console.log('Copying to temporary directory');
            fs.cpSync(sourceDirectory, temporaryPackageCopy, {recursive: true});

            console.log('Uploading to Bugsnag');
            process.chdir(temporaryDirectory);
            await node.uploadMultiple({
              apiKey,
              appVersion,
              overwrite: true,
              directory: '.',
            });

            resolve();
          } catch (e) {
            reject(e);
          }
        });
      });
    }

    await reportBuild({apiKey, appVersion}, {})
    console.log('Build reported!')
  } catch (err) {
    console.log('Failed to report build!', err.message)
  }
})();
