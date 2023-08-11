#!/usr/bin/env node

/**
 * The output from this script is used by Nx to determine whether the cache should be invalidated
 * or not at the workspace level. This file is referenced from the nx.json file.
 */
process.removeAllListeners('warning');

import {dirname, join} from 'pathe'
import {createRequire} from 'module'
import {fileURLToPath} from 'url'
import crypto from "crypto"
import {execa} from 'execa'

const require = createRequire(import.meta.url)
const {readFile} = require('fs-extra')

// Paths
const binDirectory = dirname(fileURLToPath(import.meta.url))
const rootDirectory = dirname(binDirectory)

// Hashable inputs
const nodeVersion = process.version;

const {stdout: typescriptCompilerVersion} = await execa(join(rootDirectory, "node_modules/.bin/tsc"), ['--version'], {cwd: rootDirectory});
const {stdout: gitSha} = await execa("git", ['rev-parse', '--short', 'HEAD'], {cwd: rootDirectory});
const pnpmLockfileContent = (await readFile(join(rootDirectory, "pnpm-lock.yaml"))).toString();

const hashableInputs = [
  nodeVersion.trim(),
  typescriptCompilerVersion.trim(),
  gitSha.trim(),
  crypto.createHash('md5').update(pnpmLockfileContent).digest("hex")
]

console.log(hashableInputs.join("\n"))
