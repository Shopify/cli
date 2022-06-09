#!/usr/bin/env node

process.removeAllListeners('warning');

process.env.SHOPIFY_CONFIG = "debug"

import runCLI from "../dist/index.js";

runCLI();
