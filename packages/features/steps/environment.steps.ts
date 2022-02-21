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
import tempy from 'tempy';
import rimraf from 'rimraf';
import path from 'pathe';

import {directories} from '../lib/constants';
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
  this.temporaryDirectory = tempy.directory();
  this.cliExecutable = cliExecutable;
  this.createAppExecutable = createAppExecutable;
});

After(function () {
  if (this.temporaryDirectory) {
    rimraf.sync(this.temporaryDirectory, {force: true});
  }
});

/**
 * Before running the acceptance tests, we
 */
BeforeAll({timeout: 2 * 60 * 1000}, async function () {
  sharedTemporaryDirectory = tempy.directory();
  console.log('Building CLIs before running tests...');
  await exec('yarn', ['build'], {cwd: directories.root});
  cliExecutable = path.join(directories.root, 'packages/cli/bin/dev.js');
  createAppExecutable = path.join(
    directories.root,
    'packages/create-app/bin/dev.js',
  );
});

AfterAll(function () {
  if (sharedTemporaryDirectory) {
    rimraf.sync(sharedTemporaryDirectory);
  }
});
