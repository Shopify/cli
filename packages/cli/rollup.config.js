import esbuild from 'rollup-plugin-esbuild';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import path from 'pathe';
import fg from 'fast-glob';

const moduleType = 'cjs';

let distDir;
if (process.env.SHOPIFY_DIST_DIR) {
  distDir = process.env.SHOPIFY_DIST_DIR;
} else {
  distDir = path.join(__dirname, 'dist');
}

const plugins = [
  resolve({
    preferBuiltins: true,
  }),
  // https://www.npmjs.com/package/rollup-plugin-esbuild
  esbuild({
    target: 'node12',
    tsconfig: path.join(__dirname, 'tsconfig.json'),
  }),
  json(),
  commonjs(),
];

const external = ['@oclif/core', '@oclif/plugin-help'];
const features = ['app', 'theme'];

const configuration = () => [
  // CLI
  {
    input: path.join(__dirname, 'src/index.ts'),
    output: [{file: path.join(distDir, 'index.js'), format: moduleType}],
    plugins,
    external: [...external],
  },
  // Core
  {
    input: path.join(__dirname, '../core/src/index.ts'),
    output: [
      {
        file: path.join(distDir, '@shopify/core/index.js'),
        format: moduleType,
      },
    ],
    plugins,
    external: [...external],
  },
  ...features.flatMap((feature) => {
    const commands = fg.sync([
      path.join(__dirname, `../${feature}/src/commands/**/*.ts`),
      `!${path.join(__dirname, `../${feature}/src/commands/**/*.test.ts`)}`,
    ]);
    return commands.map((commandPath) => {
      const outputPath = path.join(
        distDir,
        'commands',
        commandPath.split('src/commands')[1].replace('.ts', '.js'),
      );
      return {
        input: commandPath,
        output: [{file: outputPath, format: moduleType, exports: 'default'}],
        plugins,
        external: [...external, '@shopify/core'],
      };
    });
  }),
];

export default configuration;
