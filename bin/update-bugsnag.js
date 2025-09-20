#!/usr/bin/env node

// This script is deprecated. It now just calls the centralized upload script.
// Kept for backwards compatibility in case it's referenced elsewhere.

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Note: update-bugsnag.js is deprecated. Using centralized upload-sourcemaps-all.js instead.');

const child = spawn('node', [path.join(__dirname, 'upload-sourcemaps-all.js')], {
  stdio: 'inherit',
  shell: true
});

child.on('exit', (code) => {
  process.exit(code || 0);
});