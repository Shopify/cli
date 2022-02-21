import path from 'pathe';

export const directories = {
  root: path.join(__dirname, '../../..'),
  packages: {
    cli: path.join(__dirname, '../../../packages/cli'),
    app: path.join(__dirname, '../../../packages/app'),
    hydrogen: path.join(__dirname, '../../../packages/hydrogen'),
  },
};

export const executables = {
  cli: path.join(__dirname, '../../../packages/cli/bin/dev.js'),
  createApp: path.join(__dirname, '../../../packages/create-app/bin/dev.js'),
  createHydrogen: path.join(
    __dirname,
    '../../../packages/create-hydrogen/bin/dev.js',
  ),
};
