#!/usr/bin/env node --experimental-vm-modules

process.removeAllListeners('warning');

import runCreateHydrogen from "../dist/index.js";

runCreateHydrogen(true);
