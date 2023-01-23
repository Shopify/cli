import {content, debug} from '../../output.js'
import Conf, {Schema} from 'conf'

export {Conf, Schema}

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
  debug(content`Getting session store...`)
  return config.get('sessionStore')
}

/**
 * Set session.
 *
 * @param session - Session.
 */
export function setSession(session: string, config: Conf<ConfSchema> = cliKitStore()): void {
  debug(content`Setting session store...`)
  config.set('sessionStore', session)
}

/**
 * Remove session.
 */
export function removeSession(config: Conf<ConfSchema> = cliKitStore()): void {
  debug(content`Removing session store...`)
  config.delete('sessionStore')
}
