#!/usr/bin/env node
process.removeAllListeners('warning');

process.env.SHOPIFY_CONFIG = process.env.SHOPIFY_CONFIG ?? "debug"

import runCreateApp from "../dist/index.js";

runCreateApp();
