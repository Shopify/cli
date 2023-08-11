import * as path from 'pathe'
import {fileURLToPath} from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const directories = {
  root: path.join(__dirname, '../../..'),
  packages: {
    cli: path.resolve(__dirname, '../../../packages/cli'),
    app: path.resolve(__dirname, '../../../packages/app'),
    cliKit: path.resolve(__dirname, '../../../packages/cli-kit'),
  },
}

export const executables = {
  cli: path.resolve(__dirname, '../../../packages/cli/bin/run.js'),
  createApp: path.resolve(__dirname, '../../../packages/create-app/bin/run.js'),
}
