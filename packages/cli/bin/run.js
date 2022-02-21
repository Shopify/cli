#!/usr/bin/env node

process.removeAllListeners('warning');

import runCLI from "@shopify/cli";

runCLI();
