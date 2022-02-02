import fs from 'fs';
import {fileURLToPath} from 'url';

import {path, error} from '@shopify/core';

export async function cliVersion(): Promise<string> {
  const cliPackageJsonpath =
    (await path.findUp('@shopify/cli/package.json', {
      cwd: path.dirname(fileURLToPath(import.meta.url)),
      type: 'file',
    })) ??
    (await path.findUp('packages/cli/package.json', {
      cwd: path.dirname(fileURLToPath(import.meta.url)),
      type: 'file',
    }));
  if (!cliPackageJsonpath) {
    throw new error.Bug("Couldn't determine the version of the CLI");
  }
  const packageJson = JSON.parse(fs.readFileSync(cliPackageJsonpath, 'utf-8'));
  return packageJson.version;
}
