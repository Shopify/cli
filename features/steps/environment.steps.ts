/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import fs from 'fs';

import {Given, After, AfterAll} from '@cucumber/cucumber';
import tmp from 'tmp';
import rimraf from 'rimraf';
import shell from 'shelljs';
import path from 'pathe';

import {createAppDevPackagePath, cliPackagePath} from '../lib/constants';
import {exec} from '../lib/system';

Given('I have a working directory', function () {
  this.temporaryDirectory = tmp.dirSync().name;
});

After(async function () {
  if (this.temporaryDirectory) {
    rimraf.sync(this.temporaryDirectory);
  }
});

AfterAll(function () {
  if (cliDirectory) {
    rimraf.sync(cliDirectory);
  }
  if (createAppDirectory) {
    rimraf.sync(createAppDirectory);
  }
});

let cliDirectory: string | undefined;

Given('I install the Shopify CLI', {timeout: 60 * 1000}, async function () {
  if (cliDirectory) {
    this.cliDirectory = cliDirectory;
    this.cliExecutable = path.join(cliDirectory, 'bin/shopify-run');
    return;
  }
  cliDirectory = tmp.dirSync().name;

  await installCLI(cliPackagePath, 'shopify', cliDirectory, ['bin', 'dist']);

  this.cliDirectory = cliDirectory;
  this.cliExecutable = path.join(cliDirectory, 'bin/shopify-run');
});

let createAppDirectory: string | undefined;

Given('I install the create-app CLI', {timeout: 60 * 1000}, async function () {
  if (createAppDirectory) {
    this.createAppDirectory = createAppDirectory;
    this.createAppExecutable = path.join(
      createAppDirectory,
      'bin/create-app-run',
    );
    return;
  }
  createAppDirectory = tmp.dirSync().name;

  await installCLI(createAppDevPackagePath, 'create-app', createAppDirectory, [
    'bin',
    'templates',
    'dist',
  ]);

  this.createAppDirectory = createAppDirectory;
  this.createAppExecutable = path.join(
    createAppDirectory,
    'bin/create-app-run',
  );
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
  await exec('yarn build', packagePath);
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
  additionalFolders.forEach((folder) => {
    shell.cp('-R', path.join(packagePath, folder), path.join(into, folder));
  });
}
