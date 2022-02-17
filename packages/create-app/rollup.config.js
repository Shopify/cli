import path from 'pathe';
import alias from '@rollup/plugin-alias';

import {external, plugins, distDir} from '../../configurations/rollup.config';

const createAppExternal = [...external, '@oclif/core'];
const createAppPlugins = [
  alias({
    entries: [
      {
        find: '@shopify/cli-kit',
        replacement: path.join(__dirname, '../cli-kit/src/index.ts'),
      },
    ],
  }),
  ...plugins(__dirname),
];

const configuration = () => [
  {
    input: path.join(__dirname, 'src/index.ts'),
    output: [
      {
        file: path.join(distDir(__dirname), 'index.js'),
        format: 'esm',
        sourcemap: true,
      },
    ],
    plugins: createAppPlugins,
    external: createAppExternal,
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
    plugins: createAppPlugins,
    external: createAppExternal,
  },
];

export default configuration;
