import {ShopifyConfig} from './custom-oclif-loader.js'
import {settings as oclifSettings} from '@oclif/core'
import {fileURLToPath} from 'node:url'
import type {LazyCommandLoader} from './custom-oclif-loader.js'

interface Options {
  moduleURL: string
  argv?: string[]
  lazyCommandLoader?: LazyCommandLoader
}

/**
 * Normalize argv for space-separated topic commands.
 *
 * E.g., ['app', 'deploy', '--force'] becomes ['app:deploy', '--force'].
 * Inlined from oclif to avoid loading the heavy help module.
 *
 * @param argv - The arguments to normalize.
 * @param commandIDs - All registered command IDs.
 * @param findCommand - Function to look up a command by ID.
 * @returns The normalized argv array with space-separated topics joined by colons.
 */
function normalizeArgv(argv: string[], commandIDs: string[], findCommand: (id: string) => unknown): string[] {
  if (argv.length <= 1) return argv

  const ids = new Set(commandIDs.flatMap((id) => id.split(':').map((_, idx, arr) => arr.slice(0, idx + 1).join(':'))))
  const final: string[] = []
  const idPresent = (id: string) => ids.has(id)
  const finalizeId = (segment?: string) => (segment ? [...final, segment] : final).filter(Boolean).join(':')
  const hasArgs = () => {
    const id = finalizeId()
    if (!id) return false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cmd = findCommand(id) as any
    return Boolean(cmd && (cmd.strict === false || Object.keys(cmd.args ?? {}).length > 0))
  }

  for (const arg of argv) {
    if (idPresent(finalizeId(arg))) final.push(arg)
    else if (arg.includes('=') || arg.startsWith('-') || hasArgs()) break
    else final.push(arg)
  }

  const id = finalizeId()
  if (id) {
    const argvSlice = argv.slice(id.split(':').length)
    return [id, ...argvSlice]
  }
  return argv
}

/**
 * Launches the CLI through our custom OCLIF loader.
 * Uses a lightweight dispatcher that avoids loading oclif's help module
 * unless help is actually requested. This saves ~50ms for non-help commands.
 *
 * @param options - Launch options including moduleURL and optional lazy command loader.
 * @returns A promise that resolves when the CLI has completed.
 */
export async function launchCLI(options: Options): Promise<void> {
  if (process.env.SHOPIFY_CLI_ENV === 'development') {
    oclifSettings.debug = true
  }

  try {
    const config = new ShopifyConfig({root: fileURLToPath(options.moduleURL)})
    await config.load()

    if (options.lazyCommandLoader) {
      config.setLazyCommandLoader(options.lazyCommandLoader)
    }

    const argv = options.argv ?? process.argv.slice(2)

    // eslint-disable-next-line no-void
    void config.runHook('init', {argv, id: argv[0] ?? ''})

    const versionFlags = ['--version', ...(config.pjson.oclif?.additionalVersionFlags ?? [])]
    if (versionFlags.includes(argv[0] ?? '')) {
      process.stdout.write(`${config.userAgent}\n`)
      return
    }

    const helpFlags = ['--help', '-h', ...(config.pjson.oclif?.additionalHelpFlags ?? [])]
    const needsHelp =
      argv.length === 0 ||
      argv.some((arg: string) => {
        if (arg === '--') return false
        return helpFlags.includes(arg)
      })

    if (needsHelp) {
      const oclif = await import('@oclif/core')
      await oclif.default.run(argv, config)
      await oclif.default.flush()
      return
    }

    const normalized =
      config.pjson.oclif?.topicSeparator === ' '
        ? normalizeArgv(argv, config.commandIDs, (id: string) => config.findCommand(id))
        : argv
    const [id, ...argvSlice] = normalized

    if (!id) {
      const oclif = await import('@oclif/core')
      await oclif.default.run(argv, config)
      return
    }

    const cmd = config.findCommand(id)
    if (!cmd) {
      const topic = config.findTopic(id)
      if (topic) {
        const oclif = await import('@oclif/core')
        await oclif.default.run(argv, config)
        return
      }
      const oclif = await import('@oclif/core')
      await oclif.default.run(argv, config)
      return
    }

    await config.runCommand(id, argvSlice, cmd)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    const {errorHandler} = await import('./error-handler.js')
    await errorHandler(error as Error)
    const oclif = await import('@oclif/core')
    return oclif.default.Errors.handle(error as Error)
  }
}
