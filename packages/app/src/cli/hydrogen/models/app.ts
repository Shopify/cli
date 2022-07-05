import {Configuration} from './configuration.js'
import {dependency} from '@shopify/cli-kit'

export interface HydrogenApp {
  directory: string
  name: string
  configuration: Configuration
  dependencyManager: dependency.DependencyManager
}
