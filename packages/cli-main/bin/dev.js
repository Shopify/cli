#!/usr/bin/env node

process.removeAllListeners('warning');

process.env.SHOPIFY_ENV = process.env.SHOPIFY_ENV ?? "development"

import runCLI from "../dist/index.js";

runCLI();
