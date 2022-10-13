#!/usr/bin/env node

process.removeAllListeners('warning');

import runCreateApp from "@shopify/create-headless-app";

runCreateApp(false);
