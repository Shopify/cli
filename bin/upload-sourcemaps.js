#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { node } from "@bugsnag/source-maps";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appVersion = JSON.parse(fs.readFileSync(`${__dirname}/../packages/cli/package.json`)).version;

node.uploadMultiple({
  apiKey: '9e1e6889176fd0c795d5c659225e0fae',
  appVersion,
  overwrite: true,
  projectRoot: `${__dirname}/..`,
  directory: '.'
});
