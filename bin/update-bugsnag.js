#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { node } from "@bugsnag/source-maps";
import reportBuild from 'bugsnag-build-reporter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appVersion = JSON.parse(fs.readFileSync(`${__dirname}/../packages/cli-main/package.json`)).version;
const apiKey = '9e1e6889176fd0c795d5c659225e0fae';

(async () => {
  try {
    await node.uploadMultiple({
      apiKey,
      appVersion,
      overwrite: true,
      projectRoot: `${__dirname}/../packages`,
      directory: '.'
    });
    await reportBuild({apiKey, appVersion}, {})
    console.log('Build reported!')
  } catch (err) {
    console.log('Failed to report build!', err.message)
  }
})();
