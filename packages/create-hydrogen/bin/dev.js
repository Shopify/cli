#!/usr/bin/env node

process.removeAllListeners('warning');

import runCreateHydrogen from "../dist/index.js";

runCreateHydrogen();
