import fs from 'fs';

import {findPathUp, BugError} from '@shopify/support';

export async function cliVersion(): Promise<string> {
  const path =
    (await findPathUp('@shopify/cli/package.json', __dirname, 'file')) ??
    (await findPathUp('packages/cli/package.json', __dirname, 'file'));
  if (!path) {
    throw new BugError("Couldn't determine the version of the CLI");
  }
  const packageJson = JSON.parse(fs.readFileSync(path, 'utf-8'));
  return packageJson.version;
}
