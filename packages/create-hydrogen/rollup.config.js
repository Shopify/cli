import path from 'pathe';

import {external, plugins, distDir} from '../../configurations/rollup.config';

const createHydrogenExternal = [
  ...external,
  '@oclif/core',
  '@shopify/cli-hydrogen/commands/init',
];
const createHydrogenPlugins = [...plugins(__dirname)];

const configuration = () => [
  // CLI
  {
    input: path.join(__dirname, 'src/index.ts'),
    output: [
      {
        file: path.join(distDir(__dirname), 'index.js'),
        format: 'esm',
        sourcemap: true,
      },
    ],
    plugins: createHydrogenPlugins,
    external: createHydrogenExternal,
  },
  {
    input: path.join(__dirname, 'src/commands/init.ts'),
    output: [
      {
        file: path.join(distDir(__dirname), 'commands/init.js'),
        format: 'esm',
        sourcemap: true,
      },
    ],
    plugins: createHydrogenPlugins,
    external: createHydrogenExternal,
  },
];

export default configuration;
