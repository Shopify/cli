#!/usr/bin/env node

if (!process.argv.includes("init")) {
  process.argv.push('init');
}

import { run, flush, Errors } from '@oclif/core';
import Bugsnag from "@bugsnag/js";

// Set up error tracking
Bugsnag.start({apiKey: "9e1e6889176fd0c795d5c659225e0fae", logger: null})

// Start the CLI
run(void 0, import.meta.url).then(flush).catch((error) => {
  return new Promise((resolve, reject) => {
    Bugsnag.notify(error, null, resolve);
  }).then(Errors.handle(error));
})
