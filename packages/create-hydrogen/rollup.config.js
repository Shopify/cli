import path from 'pathe';
import alias from '@rollup/plugin-alias';

import {external, plugins, distDir} from '../../configurations/rollup.config';

const hydrogenExternal = [/@miniflare/, /prettier/];

const cliExternal = [
  ...hydrogenExternal,
  ...external,
  '@oclif/core',
  '@bugsnag/js',
];
const createHydrogenPlugins = [
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
  // CLI
  {
    input: [
      path.join(__dirname, 'src/index.ts'),
      path.join(__dirname, `../cli-hydrogen/src/cli/commands/hydrogen/init.ts`),
    ],
    output: [
      {
        dir: distDir(__dirname),
        format: 'esm',
        sourcemap: true,
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.facadeModuleId.includes('src/cli/commands')) {
            // Preserves the commands/... path
            return `commands/${chunkInfo.facadeModuleId
              .split('src/cli/commands/hydrogen')
              .slice(-1)[0]
              .replace('ts', 'js')}`;
          } else {
            return '[name].js';
          }
        },
      },
    ],
    plugins: createHydrogenPlugins,
    external: cliExternal,
  },
];

export default configuration;
