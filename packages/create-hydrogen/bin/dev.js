#!/usr/bin/env node

process.removeAllListeners('warning');

process.env.SHOPIFY_ENV = process.env.SHOPIFY_ENV ?? "development"

import runCreateHydrogen from "../dist/index.js";

runCreateHydrogen();
