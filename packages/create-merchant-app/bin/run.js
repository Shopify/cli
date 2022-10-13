#!/usr/bin/env node

process.removeAllListeners('warning');

import runCreateApp from "@shopify/create-merchant-app";

runCreateApp(false);
