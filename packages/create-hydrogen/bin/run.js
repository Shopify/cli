#!/usr/bin/env node

process.removeAllListeners('warning');

import runCreateHydrogen from "@shopify/create-hydrogen";

runCreateHydrogen();
