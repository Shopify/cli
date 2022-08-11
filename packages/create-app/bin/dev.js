#!/usr/bin/env node
process.removeAllListeners('warning');

process.env.SHOPIFY_ENV = process.env.SHOPIFY_ENV ?? "development"

import runCreateApp from "../dist/index.js";

runCreateApp();
