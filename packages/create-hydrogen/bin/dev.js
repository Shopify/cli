#!/usr/bin/env node

process.removeAllListeners('warning');

process.env.SHOPIFY_CONFIG = "debug"

import runCreateHydrogen from "../dist/index.js";

runCreateHydrogen();
