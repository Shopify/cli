#!/usr/bin/env node --experimental-vm-modules

process.removeAllListeners('warning');

import runCreateHydrogen from "@shopify/create-hydrogen";

runCreateHydrogen(false);
