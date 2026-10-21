import {setImmediate} from 'node:timers/promises'

import {readDevInstance} from '@shopify/cli-kit/node/dev-instance'
import {outputInfo} from '@shopify/cli-kit/node/output'

export const hasRequiredThemeDirectories = async () => true
export const ensureDirectoryConfirmed = async () => true
export const mountThemeFileSystem = () => ({})
export const emptyThemeExtFileSystem = () => ({})
export const isStorefrontPasswordProtected = async () => false
export const ensureValidPassword = async () => undefined
export const initializeDevServerSession = async () => ({storeFqdn: 'fixture.myshopify.com', token: 'fixture'})
export const fetchOrCreateCrawlerSignatureHeaders = async () => undefined
export const ensureListingExists = async () => {}

export function setupDevServer(theme, ctx) {
  return {
    workPromise: Promise.resolve(),
    renderDevSetupProgress: async () => {},
    backgroundJobPromise: new Promise(() => {}),
    serverStart: async () => {
      // Keep a handle alive, as the real HTTP server and watchers do.
      setInterval(() => {}, 1000)
      const startupDeadline = setTimeout(() => process.exit(2), 20000)
      const sendSignal = async () => {
        const identity = {command: 'theme dev', directory: ctx.directory, key: `${ctx.session.storeFqdn}:${theme.id}`}
        while ((await readDevInstance(identity))?.status !== 'running') await setImmediate()
        clearTimeout(startupDeadline)
        for (let index = 0; index < 1000; index++) outputInfo(`line ${index}`)
        setTimeout(() => process.exit(2), 20000)
        process.kill(process.pid, process.env.THEME_DEV_TEST_SIGNAL)
      }
      sendSignal().catch((error) => {
        process.stderr.write(String(error))
        process.exit(2)
      })
    },
    serverStop: async () => {
      if (!ctx.signal.aborted) throw new Error('Server stopped before cancellation')
      outputInfo('Stopped')
    },
  }
}
