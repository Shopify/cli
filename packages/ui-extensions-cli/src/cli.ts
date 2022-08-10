#!/usr/bin/env node

import {build} from './build';

run();

async function run() {
  const command = process.argv.slice(2)[0];
  switch (command) {
    case 'build': {
      build({mode: 'production'});
      break;
    }
    case 'develop': {
      build({mode: 'development'});
      break;
    }
  }
}
