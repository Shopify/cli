#!/usr/bin/env node
process.removeAllListeners('warning');

import runCreateApp from "../dist/index.js";

runCreateApp(true);
