import {Conf} from '../../public/node/conf.js'
import {outputContent, outputDebug} from '@shopify/cli-kit/node/output'

export interface ConfSchema {
  sessionStore: string
}

let _instance: Conf<ConfSchema> | undefined

/**
 * CLIKIT Store.
 *
 * @returns CLIKitStore.
 */
function cliKitStore() {
  if (!_instance) {
    _instance = new Conf<ConfSchema>({projectName: 'shopify-cli-kit'})
  }
  return _instance
}

/**
 * Get session.
 *
 * @returns Session.
 */
export function getSession(config: Conf<ConfSchema> = cliKitStore()): string | undefined {
  outputDebug(outputContent`Getting session store...`)
  return config.get('sessionStore')
}

/**
 * Set session.
 *
 * @param session - Session.
 */
export function setSession(session: string, config: Conf<ConfSchema> = cliKitStore()): void {
  outputDebug(outputContent`Setting session store...`)
  config.set('sessionStore', session)
}

/**
 * Remove session.
 */
export function removeSession(config: Conf<ConfSchema> = cliKitStore()): void {
  outputDebug(outputContent`Removing session store...`)
  config.delete('sessionStore')
}
