/**
 * Lazy command registry.
 *
 * Maps each command ID to a dynamic import function that loads ONLY that command's module.
 * This avoids importing the entire index.ts (which pulls in @shopify/app, @shopify/theme,
 * @shopify/cli-hydrogen, etc.) just to run a single command.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CommandLoader = () => Promise<any>

// Internal CLI commands
const cliCommands: Record<string, CommandLoader> = {
  'version': () => import('./cli/commands/version.js'),
  'search': () => import('./cli/commands/search.js'),
  'upgrade': () => import('./cli/commands/upgrade.js'),
  'auth:logout': () => import('./cli/commands/auth/logout.js'),
  'auth:login': () => import('./cli/commands/auth/login.js'),
  'debug:command-flags': () => import('./cli/commands/debug/command-flags.js'),
  'kitchen-sink:async': () => import('./cli/commands/kitchen-sink/async.js'),
  'kitchen-sink:prompts': () => import('./cli/commands/kitchen-sink/prompts.js'),
  'kitchen-sink:static': () => import('./cli/commands/kitchen-sink/static.js'),
  'kitchen-sink': () => import('./cli/commands/kitchen-sink/index.js'),
  'doctor-release': () => import('./cli/commands/doctor-release/doctor-release.js'),
  'doctor-release:theme': () => import('./cli/commands/doctor-release/theme/index.js'),
  'docs:generate': () => import('./cli/commands/docs/generate.js'),
  'help': () => import('./cli/commands/help.js'),
  'notifications:list': () => import('./cli/commands/notifications/list.js'),
  'notifications:generate': () => import('./cli/commands/notifications/generate.js'),
  'cache:clear': () => import('./cli/commands/cache/clear.js'),
}

// App commands - loaded from @shopify/app
const appCommandIds = [
  'app:build', 'app:bulk:cancel', 'app:bulk:status', 'app:deploy', 'app:dev', 'app:dev:clean',
  'app:logs', 'app:logs:sources', 'app:import-custom-data-definitions', 'app:import-extensions',
  'app:info', 'app:init', 'app:release', 'app:config:link', 'app:config:use', 'app:config:pull',
  'app:env:pull', 'app:env:show', 'app:execute', 'app:bulk:execute', 'app:generate:schema',
  'app:function:build', 'app:function:replay', 'app:function:run', 'app:function:info',
  'app:function:schema', 'app:function:typegen', 'app:generate:extension', 'app:versions:list',
  'app:webhook:trigger', 'webhook:trigger', 'demo:watcher', 'organization:list',
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function searchForDefault(module: any): any {
  if (module.default?.run) return module.default
  for (const value of Object.values(module)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (value as any) === 'function' && typeof (value as any).run === 'function') return value
  }
  return undefined
}

/**
 * Load a command class by its ID.
 * Returns the command class, or undefined if not found.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadCommand(id: string): Promise<any | undefined> {
  // Check CLI-local commands first
  const cliLoader = cliCommands[id]
  if (cliLoader) {
    const module = await cliLoader()
    return searchForDefault(module)
  }

  // App commands
  if (appCommandIds.includes(id)) {
    const {commands} = await import('@shopify/app')
    return commands[id]
  }

  // Theme commands
  if (id.startsWith('theme:')) {
    const themeModule = await import('@shopify/theme')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (themeModule.default as any)?.[id]
  }

  // Hydrogen commands
  if (id.startsWith('hydrogen:')) {
    const {COMMANDS} = await import('@shopify/cli-hydrogen')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (COMMANDS as any)?.[id]
  }

  // Plugin commands
  if (id === 'commands') {
    const {commands} = await import('@oclif/plugin-commands')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (commands as any)[id]
  }

  if (id.startsWith('plugins')) {
    const {commands} = await import('@oclif/plugin-plugins')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (commands as any)[id]
  }

  if (id.startsWith('config:autocorrect')) {
    const {DidYouMeanCommands} = await import('@shopify/plugin-did-you-mean')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (DidYouMeanCommands as any)[id]
  }

  return undefined
}
