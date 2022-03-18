import schema from './store/schema'
import cliKitPackageJson from '../package.json'
import Conf from 'conf'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore

const migrations = {}

export const cliKit = new Conf({
  schema,
  migrations,
  projectName: 'shopify-cli-kit',
  projectVersion: cliKitPackageJson.version,
})
