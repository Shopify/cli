import path from 'pathe';
import dts from 'rollup-plugin-dts';

import {external, plugins, distDir} from '../../configurations/rollup.config';

const configuration = () => [
  {
    input: path.join(__dirname, 'src/index.ts'),
    output: [
      {
        file: path.join(distDir(__dirname), 'index.js'),
        format: 'esm',
      },
    ],
    plugins: plugins(__dirname),
    external: [...external],
  },
  {
    input: path.join(__dirname, 'src/index.ts'),
    output: [
      {
        file: path.join(distDir(__dirname), 'index.d.ts'),
        format: 'esm',
      },
    ],
    plugins: [
      dts({
        respectExternal: true,
        compilerOptions: {
          composite: false,
        },
      }),
    ],
    external: [...external],
  },
];

export default configuration;
