import * as path from 'pathe'

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
  cli: path.resolve(__dirname, '../../../packages/cli/bin/run.js'),
  createApp: path.resolve(__dirname, '../../../packages/create-app/bin/run.js'),
  createHydrogen: path.resolve(__dirname, '../../../packages/create-hydrogen/bin/run.js'),
}
