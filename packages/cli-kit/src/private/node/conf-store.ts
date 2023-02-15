import {LocalStorage} from '../../public/node/local-storage.js'
import {outputContent, outputDebug} from '@shopify/cli-kit/node/output'

export interface ConfSchema {
  sessionStore: string
}

let _instance: LocalStorage<ConfSchema> | undefined

/**
 * CLIKIT Store.
 *
 * @returns CLIKitStore.
 */
function cliKitStore() {
  if (!_instance) {
    _instance = new LocalStorage<ConfSchema>({projectName: 'shopify-cli-kit'})
  }
  return _instance
}

/**
 * Get session.
 *
 * @returns Session.
 */
export function getSession(config: LocalStorage<ConfSchema> = cliKitStore()): string | undefined {
  outputDebug(outputContent`Getting session store...`)
  return config.get('sessionStore')
}

/**
 * Set session.
 *
 * @param session - Session.
 */
export function setSession(session: string, config: LocalStorage<ConfSchema> = cliKitStore()): void {
  outputDebug(outputContent`Setting session store...`)
  config.set('sessionStore', session)
}

/**
 * Remove session.
 */
export function removeSession(config: LocalStorage<ConfSchema> = cliKitStore()): void {
  outputDebug(outputContent`Removing session store...`)
  config.delete('sessionStore')
}
