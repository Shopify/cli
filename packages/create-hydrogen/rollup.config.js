import path from 'pathe';

import {external, plugins, distDir} from '../../configurations/rollup.config';

const hydrogenExternal = [/@miniflare/, /prettier/];

const cliExternal = [
  ...hydrogenExternal,
  ...external,
  '@oclif/core',
  '@shopify/cli-kit',
  '@bugsnag/js',
];

const configuration = () => [
  // CLI
  {
    input: [
      path.join(__dirname, 'src/index.ts'),
      path.join(__dirname, `../hydrogen/src/commands/hydrogen/init.ts`),
    ],
    output: [
      {
        dir: distDir(__dirname),
        format: 'esm',
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.facadeModuleId.includes('src/commands')) {
            // Preserves the commands/... path
            return `commands/${chunkInfo.facadeModuleId
              .split('src/commands/hydrogen')
              .slice(-1)[0]
              .replace('ts', 'js')}`;
          } else {
            return '[name].js';
          }
        },
      },
    ],
    plugins: plugins(__dirname),
    external: cliExternal,
  },
];

export default configuration;
