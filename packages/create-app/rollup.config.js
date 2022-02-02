import path from 'pathe';

import {external, plugins, distDir} from '../../configurations/rollup.config';

const additionalExternal = ['@oclif/core', '@shopify/core'];

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
    plugins: plugins(__dirname),
    external: [...external, ...additionalExternal],
  },
];

export default configuration;
