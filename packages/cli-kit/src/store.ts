import Conf from 'conf';

import cliKitPackageJson from '../package.json';

import schema from './store/schema';

const migrations = {};

export const cliKit = new Conf({
  schema,
  migrations,
  projectName: 'shopify-cli-kit',
});
