import {fileURLToPath} from 'node:url'
import {ShopifyConfig} from './custom-oclif-loader.js'
import {settings as oclifSettings} from '@oclif/core'
import type {LazyCommandLoader} from './custom-oclif-loader.js'

interface Options {
  moduleURL: string
  argv?: string[]
  lazyCommandLoader?: LazyCommandLoader
}

/**
 * Normalize argv for space-separated topic commands.
 * e.g., ['app', 'deploy', '--force'] → ['app:deploy', '--force']
 * Inlined from oclif to avoid loading the heavy help module.
 */
function normalizeArgv(argv: string[], commandIDs: string[], findCommand: (id: string) => unknown): string[] {
  if (argv.length <= 1) return argv

  const ids = new Set(commandIDs.flatMap((id) => id.split(':').map((_, i, a) => a.slice(0, i + 1).join(':'))))
  const final: string[] = []
  const idPresent = (id: string) => ids.has(id)
  const finalizeId = (s?: string) => (s ? [...final, s] : final).filter(Boolean).join(':')
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
 */
export async function launchCLI(options: Options): Promise<void> {
  // Set oclif debug mode for development. settings is from @oclif/core which
  // is already loaded via ShopifyConfig → Config (no additional import cost).
  if (process.env.SHOPIFY_CLI_ENV === 'development') {
    oclifSettings.debug = true
  }

  try {
    // Use a custom OCLIF config to customize the behavior of the CLI
    const config = new ShopifyConfig({root: fileURLToPath(options.moduleURL)})
    await config.load()

    // Enable lazy command loading if a loader is provided
    if (options.lazyCommandLoader) {
      config.setLazyCommandLoader(options.lazyCommandLoader)
    }

    const argv = options.argv ?? process.argv.slice(2)

    // Fire init hooks in background (non-blocking via ShopifyConfig.runHook override)
    // eslint-disable-next-line no-void
    void config.runHook('init', {argv, id: argv[0] ?? ''})

    // Handle --version flag (instant path)
    const versionFlags = ['--version', ...(config.pjson.oclif?.additionalVersionFlags ?? [])]
    if (versionFlags.includes(argv[0] ?? '')) {
      process.stdout.write(config.userAgent + '\n')
      return
    }

    // Handle help: no args or --help flag → load help system lazily
    const helpFlags = ['--help', '-h', ...(config.pjson.oclif?.additionalHelpFlags ?? [])]
    const needsHelp = argv.length === 0 || argv.some((arg: string) => {
      if (arg === '--') return false
      return helpFlags.includes(arg)
    })

    if (needsHelp) {
      // Fall back to oclif.run() for help — it needs the full help rendering system
      const oclif = await import('@oclif/core')
      await oclif.default.run(argv, config)
      await oclif.default.flush()
      return
    }

    // Normalize argv for space-separated topics (e.g., 'app deploy' → 'app:deploy')
    const normalized = config.pjson.oclif?.topicSeparator === ' '
      ? normalizeArgv(argv, config.commandIDs, (id: string) => config.findCommand(id))
      : argv
    const [id, ...argvSlice] = normalized

    if (!id) {
      // No command — show help
      const oclif = await import('@oclif/core')
      await oclif.default.run(argv, config)
      return
    }

    // Find command or topic
    const cmd = config.findCommand(id)
    if (!cmd) {
      // Check if it's a topic → show help for it
      const topic = config.findTopic(id)
      if (topic) {
        const oclif = await import('@oclif/core')
        await oclif.default.run(argv, config)
        return
      }
      // Unknown command — let oclif handle it (did-you-mean, etc.)
      const oclif = await import('@oclif/core')
      await oclif.default.run(argv, config)
      return
    }

    // Run the command directly through our optimized path
    await config.runCommand(id, argvSlice, cmd)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    // Defer error-handler import to the error path (saves ~380ms on happy path)
    const {errorHandler} = await import('./error-handler.js')
    await errorHandler(error as Error)
    const oclif = await import('@oclif/core')
    return oclif.default.Errors.handle(error as Error)
  }
}
