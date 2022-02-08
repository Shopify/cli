#!/usr/bin/env node

import path from 'path';
import {execSync} from 'child_process';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_PATH = path.resolve(__dirname, '..');

console.log('🔁 Checking out latest commits and setting up environment');
execSync(`git checkout main`, {stdio: 'inherit', cwd: ROOT_PATH});
execSync(`git pull --tags`, {stdio: 'inherit', cwd: ROOT_PATH});
execSync(`/opt/dev/bin/dev up`, {stdio: 'inherit', cwd: ROOT_PATH});
