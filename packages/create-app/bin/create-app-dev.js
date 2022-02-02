#!/usr/bin/env node

import { run, flush, Errors, settings } from '@oclif/core';
import { exec, execSync } from "child_process";
import path from 'path';
import { fileURLToPath } from 'url';

if (!process.argv.includes("init")) {
    process.argv.push('init');
}

console.log("Bundling @shopify/core and @shopify/create-app");
execSync("yarn build", {cwd: path.join(path.dirname(fileURLToPath(import.meta.url)), "../../core"), stdio: 'ignore'})
execSync("yarn build", {cwd: path.join(path.dirname(fileURLToPath(import.meta.url)), ".."), stdio: 'ignore'})

settings.debug = true;

// Start the CLI
run(void 0, import.meta.url).then(flush).catch(Errors.handle)
