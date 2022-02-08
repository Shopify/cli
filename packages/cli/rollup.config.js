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

const configuration = () => [
  // CLI
  {
    input: path.join(__dirname, 'src/index.ts'),
    output: [{file: path.join(distDir(__dirname), 'index.js'), format: 'esm'}],
    plugins: plugins(__dirname),
    external: cliExternal,
  },
  ...features.flatMap((feature) => {
    const commands = fg.sync([
      path.join(__dirname, `../${feature}/src/commands/**/*.ts`),
      `!${path.join(__dirname, `../${feature}/src/commands/**/*.test.ts`)}`,
    ]);
    return commands.map((commandPath) => {
      const outputPath = path.join(
        distDir(__dirname),
        'commands',
        commandPath.split('src/commands')[1].replace('.ts', '.js'),
      );
      return {
        input: commandPath,
        output: [{file: outputPath, format: 'esm', exports: 'default'}],
        plugins: plugins(__dirname),
        external: cliExternal,
      };
    });
  }),
];

export default configuration;
