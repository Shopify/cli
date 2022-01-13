import esbuild from 'rollup-plugin-esbuild';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import pkg from './package.json';
import dts from 'rollup-plugin-dts'

const entry = ['src/index.ts'];

const external = [
  ...Object.keys(pkg.dependencies),
  ...Object.keys(pkg.peerDependencies),
];

export default ({ watch }) => [
  {
    input: entry,
    output: {
      dir: 'dist',
      format: 'cjs',
      sourcemap: 'inline',
    },
    external,
    plugins: [
      resolve({
        preferBuiltins: true,
      }),
      json(),
      commonjs(),
      esbuild({
        target: 'node12',
      }),
    ],
    onwarn(message) {
      if (/Circular dependencies/.test(message)) return;
      console.error(message);
    },
  },
  {
    input: entry,
    output: {
      file: 'dist/index.d.ts',
      format: 'cjs',
    },
    external,
    plugins: [
      dts(),
    ],
  }
];
