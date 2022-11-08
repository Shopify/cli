#!/usr/bin/env node

process.removeAllListeners('warning');

import runCreateApp from "@shopify/create-integration-app";

runCreateApp(false);
