import {ensureDevEnvironment} from './dev/environment'
import {generateURL, updateURLs} from './dev/urls'
import {installAppDependencies} from './dependencies'
import {serveExtension} from './build/extension'
import {App, AppConfiguration, Identifiers, Web, WebType} from '../models/app/app'
import {output, path, port, session, system} from '@shopify/cli-kit'
import {Plugin} from '@oclif/core/lib/interfaces'
import {Writable} from 'node:stream'

export interface DevOptions {
  app: App
  apiKey?: string
  store?: string
  reset: boolean
  tunnel: boolean
  update: boolean
  plugins: Plugin[]
  skipDependenciesInstallation: boolean
}

interface DevWebOptions {
  frontendPort: number
  backendPort: number
  apiKey: string
  apiSecret: string
  hostname: string
  scopes: AppConfiguration['scopes']
}

async function dev(options: DevOptions) {
  if (!options.skipDependenciesInstallation) {
    await installAppDependencies(options.app)
  }
  const {identifiers, store} = await ensureDevEnvironment(options)

  const frontendPort = await port.getRandomPort()
  const backendPort = await port.getRandomPort()
  const url: string = await generateURL(options, frontendPort)
  if (options.update) await updateURLs(identifiers.app.apiKey, url)

  const storeAppUrl = `${url}/api/auth?shop=${store}`

  output.info(output.content`
  Your app is up and running! ✨
  View it at: ${output.token.link(storeAppUrl, storeAppUrl)}
  `)

  const devWebs = devWeb(options.app.webs, {
    apiKey: identifiers.app.apiKey,
    frontendPort,
    backendPort,
    scopes: options.app.configuration.scopes,
    apiSecret: identifiers.app.apiSecret ?? '',
    hostname: url,
  })

  console.log('READY TO DEV')

  const devExt = await devExtensions(options.app, identifiers, url)

  await output.concurrent([...devWebs, ...devExt])
}

function devWeb(webs: Web[], options: DevWebOptions) {
  // eslint-disable-next-line @shopify/prefer-module-scope-constants
  const SHOPIFY_API_KEY = options.apiKey

  // eslint-disable-next-line @shopify/prefer-module-scope-constants
  const SHOPIFY_API_SECRET = options.apiSecret

  // eslint-disable-next-line @shopify/prefer-module-scope-constants
  const HOST = options.hostname

  // eslint-disable-next-line @shopify/prefer-module-scope-constants
  const SCOPES = options.scopes

  // eslint-disable-next-line @shopify/prefer-module-scope-constants
  const FRONTEND_PORT = `${options.frontendPort}`

  // eslint-disable-next-line @shopify/prefer-module-scope-constants
  const BACKEND_PORT = `${options.backendPort}`

  const webActions = webs.map(({configuration, directory}: Web, _index) => {
    const {commands, type} = configuration
    const [cmd, ...args] = commands.dev.split(' ')
    const env =
      type === WebType.Backend
        ? {
            SHOPIFY_API_KEY,
            SHOPIFY_API_SECRET,
            HOST,
            BACKEND_PORT,
            SCOPES,
          }
        : {
            SHOPIFY_API_KEY,
            BACKEND_PORT,
            FRONTEND_PORT,
          }

    return {
      prefix: configuration.type,
      action: async (stdout: any, stderr: any) => {
        await system.exec(cmd, args, {
          cwd: directory,
          stdout,
          stderr,
          env: {
            ...process.env,
            ...env,
            NODE_ENV: `development`,
          },
        })
      },
    }
  })
  return webActions
}

async function devExtensions(app: App, identifiers: Identifiers, url: string) {
  console.log(app)
  const token = await session.ensureAuthenticatedPartners()
  return app.extensions.ui.map((extension) => ({
    prefix: path.basename(extension.directory),
    action: async (stdout: Writable, stderr: Writable, signal: AbortSignal) => {
      if (!(extension.configuration.name in identifiers.extensions)) {
        // const ext = await createExtension(
        //   identifiers.app.apiKey,
        //   extension.configuration.type,
        //   extension.configuration.name,
        //   token,
        // )
        // console.log(ext)
        return
      }
      const uuid = identifiers.extensions[extension.configuration.name]
      console.log('SERVING: ', extension.configuration, uuid)
      await serveExtension({app, extension, stdout, stderr, signal}, uuid, url)
    },
  }))
}

export default dev
