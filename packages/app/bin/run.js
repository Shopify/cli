#!/usr/bin/env node

import {moduleDirectory} from '@shopify/cli-kit/node/path'
import {joinPath} from '@shopify/cli-kit/node/path'
import {findPathUp} from '@shopify/cli-kit/node/fs'

const cliPackageRoot = await findPathUp('node_modules/@shopify/cli', {
  cwd: moduleDirectory(import.meta.url),
  type: 'directory',
})
const cliPackageBin = joinPath(cliPackageRoot, 'bin/run.js')
import(cliPackageBin)
