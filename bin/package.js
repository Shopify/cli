#!/usr/bin/env node

import {constants, output, path, template} from '@shopify/cli-kit';
import {homebrewVariables, copyHomebrew} from '../packaging/lib/homebrew.js';

output.initiateLogging();

const cliVersion = await constants.versions.cliKit();
const packagingDir = path.join(path.dirname(import.meta.url), '../packaging').replace(/^file:/, '')

await template.recursiveDirectoryCopy(
  path.join(packagingDir, 'src'),
  path.join(packagingDir, 'dist'),
  {
    ...(await homebrewVariables(cliVersion)),
  },
);

await copyHomebrew(packagingDir)
