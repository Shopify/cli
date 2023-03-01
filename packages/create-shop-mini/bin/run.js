#!/usr/bin/env node

process.removeAllListeners('warning');

import runCreateShopMini from "@shopify/create-shop-mini";

runCreateShopMini(false);
