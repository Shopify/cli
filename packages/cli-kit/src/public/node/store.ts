import {content, debug} from '../../output.js'
import {CLI_KIT_VERSION} from '../common/version.js'
import Conf, {Schema} from 'conf'

export {Conf, Schema}

interface ConfSchema {
  themeStore: string
  session: string
}

const schema = {
  appInfo: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        appId: {
          type: 'string',
        },
        orgId: {
          type: 'string',
        },
        storeFqdn: {
          type: 'string',
        },
      },
    },
  },
} as unknown as Schema<ConfSchema>

let _instance: CLIKitStore | undefined

/**
 * CLIKIT Store.
 *
 * @returns CLIKitStore.
 */
function cliKitStore() {
  if (!_instance) {
    _instance = new CLIKitStore({
      schema,
      projectName: 'shopify-cli-kit',
      projectVersion: CLI_KIT_VERSION,
    })
  }
  return _instance
}

/**
 * Get theme store.
 *
 * @returns Theme store.
 */
export function getThemeStore(): string | undefined {
  const store = cliKitStore()
  return store.getThemeStore()
}

/**
 * Set theme store.
 *
 * @param themeStore - ThemeStore.
 */
export function setThemeStore(themeStore: string): void {
  const store = cliKitStore()
  store.setThemeStore(themeStore)
}

/**
 * Get session.
 *
 * @returns Session.
 */
export function getSession(): string | undefined {
  const store = cliKitStore()
  return store.getSession()
}

/**
 * Set session.
 *
 * @param session - Session.
 */
export function setSession(session: string): void {
  const store = cliKitStore()
  store.setSession(session)
}

/**
 * Remove session.
 */
export function removeSession(): void {
  const store = cliKitStore()
  store.removeSession()
}

export class CLIKitStore extends Conf<ConfSchema> {
  getThemeStore(): string | undefined {
    debug(content`Getting theme store...`)
    return this.get('themeStore')
  }

  setThemeStore(themeStore: string): void {
    debug(content`Setting theme store...`)
    this.set('themeStore', themeStore)
  }

  getSession(): string | undefined {
    debug(content`Getting session store...`)
    return this.get('sessionStore')
  }

  setSession(session: string): void {
    debug(content`Setting session store...`)
    this.set('sessionStore', session)
  }

  removeSession(): void {
    debug(content`Removing session store...`)
    this.set('sessionStore', '')
  }
}
