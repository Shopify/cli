import path from 'pathe';
import alias from '@rollup/plugin-alias';

import {external, plugins, distDir} from '../../configurations/rollup.config';

const additionalExternal = ['@oclif/core'];

const configuration = () => [
  {
    input: path.join(__dirname, 'src/commands/init.ts'),
    output: [
      {
        file: path.join(distDir(__dirname), 'commands/init.js'),
        format: 'esm',
        exports: 'auto',
      },
    ],
    plugins: [
      alias({
        entries: [
          {
            find: '@shopify/core',
            replacement: path.join(__dirname, '../core/src/index.ts'),
          },
        ],
      }),
      ...plugins(__dirname),
    ],
    external: [...external, ...additionalExternal],
  },
];

export default configuration;
