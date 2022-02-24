import path from 'pathe'

export const directories = {
  root: path.join(__dirname, '../../..'),
  packages: {
    cli: path.resolve(__dirname, '../../../packages/cli'),
    app: path.resolve(__dirname, '../../../packages/app'),
    cliKit: path.resolve(__dirname, '../../../packages/cli-kit'),
    hydrogen: path.resolve(__dirname, '../../../packages/hydrogen'),
  },
}

export const executables = {
  cli: path.resolve(__dirname, '../../../packages/cli/bin/dev.js'),
  createApp: path.resolve(__dirname, '../../../packages/create-app/bin/dev.js'),
  createHydrogen: path.resolve(
    __dirname,
    '../../../packages/create-hydrogen/bin/dev.js',
  ),
}
