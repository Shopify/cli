import esbuild from 'rollup-plugin-esbuild';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import path from 'pathe';
import stripShebang from 'rollup-plugin-strip-shebang';

const moduleType = 'cjs';

const plugins = [
  stripShebang(),
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

const configuration = () => [
  // create-app
  {
    input: path.join(__dirname, 'src/commands/init.ts'),
    output: [
      {
        file: path.join(__dirname, 'dist/commands/init.js'),
        format: moduleType,
        exports: 'auto',
      },
    ],
    plugins,
    external: [...external],
  },
];

export default configuration;
