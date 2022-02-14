import path from 'pathe';

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
];

export default configuration;
