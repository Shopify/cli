import {Configuration} from './configuration.js'
import {PackageManager} from '@shopify/cli-kit/node/node-package-manager'

export interface HydrogenApp {
  directory: string
  name: string
  configuration: Configuration
  dependencyManager: PackageManager
}
