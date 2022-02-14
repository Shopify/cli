import path from 'pathe';
import fg from 'fast-glob';

import {external, plugins, distDir} from '../../configurations/rollup.config';

const hydrogenExternal = [/@miniflare/, /prettier/];
const cliExternal = [
  ...external,
  ...hydrogenExternal,
  '@oclif/core',
  '@shopify/cli-kit',
  '@bugsnag/js',
];

const features = ['theme', 'hydrogen'];

const featureCommands = features
  .flatMap((feature) => {
    return fg.sync([
      path.join(__dirname, `../${feature}/src/cli/commands/*/*.ts`),
      path.join(__dirname, `../${feature}/src/cli/commands/*.ts`),
      `!${path.join(__dirname, `../${feature}/src/cli/commands/**/*.test.ts`)}`,
    ]);
  })
  .filter((commandPath) => {
    /**
     * The @shopify/create-hydrogen package was originally implemented
     * to delegate the creation flow to the @shopify/hydrogen package.
     * This filter leaves the "shopify hydrogen init" out of the final
     * set of commands.
     */
    return !commandPath.includes('/commands/hydrogen/init');
  });

const configuration = () => [
  // CLI
  {
    input: [path.join(__dirname, 'src/index.ts'), ...featureCommands],
    output: [
      {
        dir: distDir(__dirname),
        format: 'esm',
        sourcemap: true,
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.facadeModuleId.includes('src/cli/commands')) {
            // Preserves the commands/... path
            return `commands/${chunkInfo.facadeModuleId
              .split('src/cli/commands')
              .pop()
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
