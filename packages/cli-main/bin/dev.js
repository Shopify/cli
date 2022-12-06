#!/usr/bin/env node --experimental-vm-modules

process.removeAllListeners('warning');

import runCLI from "../dist/index.js";

runCLI({development: true});
