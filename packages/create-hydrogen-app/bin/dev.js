#!/usr/bin/env node
process.removeAllListeners('warning');

process.env.SHOPIFY_CONFIG = "debug"

import runCreateHydrogenApp from "../dist/index.js";

runCreateHydrogenApp();
