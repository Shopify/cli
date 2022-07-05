#!/usr/bin/env node

process.removeAllListeners('warning');

import runCreateHydrogenApp from "@shopify/create-hydrogen-app";

runCreateHydrogenApp();
