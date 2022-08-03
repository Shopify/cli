#!/usr/bin/env node

process.removeAllListeners('warning');

import runCLI, {replaceGlobalCLIWithLocal} from "@shopify/cli";

// If we run a local CLI instead, don't run the global one again after!
const ranLocalInstead = await replaceGlobalCLIWithLocal(import.meta.url);
if (!ranLocalInstead) runCLI();
