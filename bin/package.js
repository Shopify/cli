#!/usr/bin/env node

import {constants, file, output, path, template} from '@shopify/cli-kit';
import {homebrewVariables, copyHomebrew} from '../packaging/lib/homebrew.js';
import {packageDebian} from '../packaging/lib/debian.js';

output.initiateLogging();

const cliVersion = await constants.versions.cliKit();
const packagingDir = path.join(path.dirname(import.meta.url), '../packaging').replace(/^file:/, '')
const distDir = path.join(packagingDir, 'dist')

await file.rmdir(distDir, {force: true})
await template.recursiveDirectoryCopy(
  path.join(packagingDir, 'src'),
  distDir,
  {
    cliVersion,
    ...(await homebrewVariables(cliVersion)),
  },
);

await copyHomebrew(distDir)
await packageDebian(distDir, cliVersion)
