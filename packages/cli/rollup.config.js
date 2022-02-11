import path from 'pathe';
import fg from 'fast-glob';

import {external, plugins, distDir} from '../../configurations/rollup.config';

const cliExternal = [
  ...external,
  '@oclif/core',
  '@shopify/cli-kit',
  '@bugsnag/js',
];
const features = ['app', 'theme'];

const featureCommands = features.flatMap((feature) => {
  return fg.sync([
    path.join(__dirname, `../${feature}/src/commands/**/*.ts`),
    `!${path.join(__dirname, `../${feature}/src/commands/**/*.test.ts`)}`,
  ]);
});

const configuration = () => [
  // CLI
  {
    input: [path.join(__dirname, 'src/index.ts'), ...featureCommands],
    output: [
      {
        dir: distDir(__dirname),
        format: 'esm',
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.facadeModuleId.includes('src/commands')) {
            // Preserves the commands/... path
            return `commands/${chunkInfo.facadeModuleId
              .split('src/commands')
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
