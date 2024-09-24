import {LocalStorage} from '@shopify/cli-kit/node/local-storage'

export function isAutocorrectEnabled(conf: LocalStorage<ConfigSchema> = getConfig()): boolean {
  return Boolean(conf.get('autocorrectEnabled'))
}

export function setAutocorrect(value: boolean, conf: LocalStorage<ConfigSchema> = getConfig()) {
  conf.set('autocorrectEnabled', value)
}

function getConfig() {
  if (!configInstance) {
    configInstance = new LocalStorage<ConfigSchema>({projectName: 'did-you-mean'})
  }
  return configInstance
}

let configInstance: LocalStorage<ConfigSchema> | undefined

export interface ConfigSchema {
  autocorrectEnabled: boolean
}
