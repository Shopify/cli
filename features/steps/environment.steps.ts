/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import fs from 'fs';

import {Given, After, BeforeAll, AfterAll} from '@cucumber/cucumber';
import tmp from 'tmp';
import rimraf from 'rimraf';
import shell from 'shelljs';
import path from 'pathe';

import {createAppDevPackagePath, cliPackagePath} from '../lib/constants';
import {exec} from '../lib/system';

Given('I have a working directory', function () {
  this.temporaryDirectory = tmp.dirSync().name;
  this.cliExecutable = cliExecutable;
  this.createAppExecutable = createAppExecutable;
});

After(async function () {
  if (this.temporaryDirectory) {
    rimraf.sync(this.temporaryDirectory);
  }
  if (this.cliDirectory) {
    rimraf.sync(this.cliDirectory);
  }
  if (this.createAppDirectory) {
    rimraf.sync(this.createAppDirectory);
  }
});

let cliDirectory: string | undefined;
let cliExecutable: string | undefined;
let createAppDirectory: string | undefined;
let createAppExecutable: string | undefined;

BeforeAll({timeout: 2 * 60 * 1000}, async function () {
  console.debug(
    'Building @shopify/cli & @shopify/create-app for running the tests',
  );
  cliDirectory = tmp.dirSync().name;
  cliExecutable = path.join(cliDirectory, 'bin/shopify-run');
  createAppDirectory = tmp.dirSync().name;
  createAppExecutable = path.join(createAppDirectory, 'bin/create-app-run');

  await installCLI(createAppDevPackagePath, 'create-app', createAppDirectory, [
    'templates',
  ]);
  await installCLI(cliPackagePath, 'shopify', cliDirectory, ['bin']);
});

AfterAll(function () {
  if (cliDirectory) {
    rimraf.sync(cliDirectory);
  }
  if (createAppDirectory) {
    rimraf.sync(createAppDirectory);
  }
});

/**
 * This function builds the CLI as if it was about to be released.
 * That way, we can ensure acceptance tests are closer to what users will get.
 * Instead of running the CLI's through ts-node, we turn it into Javascript
 * inside the dist/ directory and run that one instead.
 * @param packagePath
 * @param name
 * @param into
 * @param additionalFolders
 */
async function installCLI(
  packagePath: string,
  name: string,
  into: string,
  additionalFolders: string[] = [],
) {
  await exec('yarn build', packagePath, {
    ...process.env,
    SHOPIFY_DIST_DIR: path.join(into, 'dist'),
  });
  const packageJsonDependencies = {};
  packageJsonDependencies[`@shopify/${name}`] = `file:${packagePath}`;
  const packageJson = {
    name: 'create-app',
    private: true,
    oclif: {commands: './dist/commands', bin: name},
    dependencies: packageJsonDependencies,
  };
  const packageJsonPath = path.join(into, 'package.json');
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson));
  await exec('yarn install', into);
  ['bin', ...additionalFolders].forEach((folder) => {
    shell.cp('-R', path.join(packagePath, folder), path.join(into, folder));
  });
}
