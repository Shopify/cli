import {Command, Config} from '@oclif/core'

/**
 * Optional lazy command loader function.
 * If set, ShopifyConfig will use it to load individual commands on demand
 * instead of importing the entire COMMANDS module (which triggers loading all packages).
 */
export type LazyCommandLoader = (id: string) => Promise<typeof Command | undefined>

/**
 * Subclass of oclif's Config that loads command classes on demand for faster CLI startup.
 */
export class ShopifyConfig extends Config {
  private lazyCommandLoader?: LazyCommandLoader

  /**
   * Set a lazy command loader that will be used to load individual command classes on demand,
   * bypassing the default oclif behavior of importing the entire COMMANDS module.
   *
   * @param loader - The lazy command loader function.
   */
  setLazyCommandLoader(loader: LazyCommandLoader): void {
    this.lazyCommandLoader = loader
  }

  /**
   * Override runCommand to use lazy loading when available.
   * Instead of calling cmd.load() which triggers loading ALL commands via index.js,
   * we directly import only the needed command module.
   *
   * @param id - The command ID to run.
   * @param argv - The arguments to pass to the command.
   * @param cachedCommand - An optional cached command loadable.
   * @returns The command result.
   */
  async runCommand<T = unknown>(
    id: string,
    argv: string[] = [],
    cachedCommand: Command.Loadable | null = null,
  ): Promise<T> {
    if (!this.lazyCommandLoader) {
      return super.runCommand<T>(id, argv, cachedCommand)
    }

    const cmd = cachedCommand ?? this.findCommand(id)
    if (!cmd) {
      return super.runCommand<T>(id, argv, cachedCommand)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const commandClass = (await this.lazyCommandLoader(id)) as any
    if (!commandClass) {
      return super.runCommand<T>(id, argv, cachedCommand)
    }

    commandClass.id = id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    commandClass.plugin = cmd.plugin ?? (this as any).rootPlugin
    await this.runHook('prerun', {argv, Command: commandClass})
    const result = (await commandClass.run(argv, this)) as T
    await this.runHook('postrun', {argv, Command: commandClass, result})
    return result
  }

  /**
   * Guard oclif's shell detection, which otherwise crashes the CLI when the OS can't resolve the current user.
   *
   * Oclif populates `config.shell` during `Config.load()`. When the SHELL environment variable is unset it
   * falls back to Node's `userInfo()`, which throws a SystemError whenever the OS passwd lookup fails —
   * ENOMEM on Windows profiles where the lookup is broken, ENOENT for a container UID with no passwd entry.
   * The call is unguarded, so it kills the CLI before it can run any command.
   *
   * Note when bumping the oclif dependency: 4.11 drops `_shell` from `Config` and moves the logic into a
   * module-level `getShell()`, so this override stops compiling. The call is still unguarded upstream, so
   * reinstate the guard at whatever seam replaces it rather than dropping it.
   *
   * @returns The name of the active shell, or oclif's own 'unknown' sentinel when detection fails.
   */
  protected _shell(): string {
    try {
      return super._shell()
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      return 'unknown'
    }
  }
}
