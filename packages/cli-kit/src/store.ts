import Conf from 'conf';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import cliKitPackageJson from '../package.json';

import schema from './store/schema';

const migrations = {};

export const cliKit = new Conf({
  schema,
  migrations,
  projectName: 'shopify-cli-kit',
  projectVersion: cliKitPackageJson.version,
});
