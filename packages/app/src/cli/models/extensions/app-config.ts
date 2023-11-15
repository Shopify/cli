import {AppInterface} from '../app/app.js'
import type {ExtensionSpecification} from './specification.js'

export const APP_ACCESS_IDENTIFIER = 'app_access'

export function getAppConfiguration(configObject: unknown, specification: ExtensionSpecification) {
  return {
    ...(configObject as object),
    type: specification.identifier,
    name: specification.externalName,
  }
}

export function isAppConfigSpecification(app: AppInterface, identifier: string) {
  const specification = app.specificationForIdentifier(identifier)
  return specification?.appModuleFeatures().includes('app_config')
}
