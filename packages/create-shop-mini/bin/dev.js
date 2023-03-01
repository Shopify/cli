#!/usr/bin/env node
process.removeAllListeners('warning');

import runCreateShopMini from "../dist/index.js";

runCreateShopMini(true);
