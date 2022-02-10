/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import fs from 'fs';

import {
  Given,
  After,
  BeforeAll,
  AfterAll,
  setDefaultTimeout,
} from '@cucumber/cucumber';
import tmp from 'tmp';
import rimraf from 'rimraf';
import path from 'pathe';

import pack from '../../../bin/pack.cjs';
import {exec} from '../lib/system';

let sharedTemporaryDirectory: string | undefined;
let createAppExecutable: string | undefined;
let cliExecutable: string | undefined;

// In the case of debug we want to disable
// the timeouts to be able to sleep the
// execution and debug things.
if (process.env.DEBUG === '1') {
  setDefaultTimeout(-1);
}

Given('I have a working directory', function () {
  this.temporaryDirectory = tmp.dirSync().name;
  this.cliExecutable = cliExecutable;
  this.createAppExecutable = createAppExecutable;
});

After(async function () {
  if (this.temporaryDirectory) {
    rimraf.sync(this.temporaryDirectory, {force: true});
  }
});

/**
 * Before running the acceptance tests, we
 */
BeforeAll({timeout: 2 * 60 * 1000}, async function () {
  sharedTemporaryDirectory = tmp.dirSync().name;
  console.log('Building CLIs before running tests...');
  await exec(path.join(__dirname, '../../../bin/pack.js'), [
    sharedTemporaryDirectory,
  ]);
  cliExecutable = path.join(sharedTemporaryDirectory, 'clis/cli/bin/run.js');
  createAppExecutable = path.join(
    sharedTemporaryDirectory,
    'clis/create-app/bin/run.js',
  );
});

AfterAll(function () {
  if (sharedTemporaryDirectory) {
    rimraf.sync(sharedTemporaryDirectory);
  }
});
