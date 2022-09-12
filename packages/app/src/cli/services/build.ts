import {buildThemeExtensions, buildFunctionExtension, buildUIExtension} from './build/extension.js'
import buildWeb from './web.js'
import {installAppDependencies} from './dependencies.js'
import {AppInterface, Web} from '../models/app/app.js'
import {extensionConfig} from '../utilities/extensions/configuration.js'
import {runGoExtensionsCLI} from '../utilities/extensions/cli.js'
import {output, abort, yaml, environment} from '@shopify/cli-kit'
import {Writable} from 'node:stream'

interface BuildOptions {
  app: AppInterface
  skipDependenciesInstallation: boolean
  apiKey?: string
}

async function build(options: BuildOptions) {
  if (!options.skipDependenciesInstallation) {
    await installAppDependencies(options.app)
  }

  const env: {SHOPIFY_API_KEY?: string} = {}
  if (options.apiKey) {
    env.SHOPIFY_API_KEY = options.apiKey
  }

  await output.concurrent([
    ...options.app.webs.map((web: Web) => {
      return {
        prefix: web.configuration.type,
        action: async (stdout: Writable, stderr: Writable, signal: abort.Signal) => {
          await buildWeb('build', {web, stdout, stderr, signal, env})
        },
      }
    }),
    {
      prefix: 'theme_extensions',
      action: async (stdout: Writable, stderr: Writable, signal: abort.Signal) => {
        await buildThemeExtensions({
          app: options.app,
          extensions: options.app.extensions.theme,
          stdout,
          stderr,
          signal,
        })
      },
    },
    ...buildUIExtensions(options),
    ...options.app.extensions.function.map((functionExtension) => {
      return {
        prefix: functionExtension.localIdentifier,
        action: async (stdout: Writable, stderr: Writable, signal: abort.Signal) => {
          await buildFunctionExtension(functionExtension, {stdout, stderr, signal, app: options.app})
        },
      }
    }),
  ])

  output.newline()
  output.success(`${options.app.name} built`)
}

function buildUIExtensions(options: BuildOptions): output.OutputProcess[] {
  if (options.app.extensions.ui.length === 0) {
    return []
  }
  if (environment.utilities.isTruthy(process.env.SHOPIFY_CLI_UI_EXTENSIONS_USE_NODE)) {
    return options.app.extensions.ui.map((uiExtension) => {
      return {
        prefix: uiExtension.localIdentifier,
        action: async (stdout: Writable, stderr: Writable, signal: abort.Signal) => {
          await buildUIExtension(uiExtension, {stdout, stderr, signal, app: options.app})
        },
      }
    })
  } else {
    return [
      {
        prefix: 'ui-extensions',
        action: async (stdout: Writable, stderr: Writable, signal: abort.Signal) => {
          stdout.write(`Building UI extensions...`)
          const fullOptions = {...options, extensions: options.app.extensions.ui, includeResourceURL: false}
          const configuration = await extensionConfig(fullOptions)
          output.debug(output.content`Dev'ing extension with configuration:
${output.token.json(configuration)}
`)
          const input = yaml.encode(configuration)
          await runGoExtensionsCLI(['build', '-'], {
            cwd: options.app.directory,
            stdout,
            stderr,
            input,
          })
        },
      },
    ]
  }
}

export default build
