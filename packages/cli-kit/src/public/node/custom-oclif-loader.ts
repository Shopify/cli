import {Command, Config} from '@oclif/core'
import os from 'os'

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
   * Override load to protect oclif's shell detection from a failing OS user lookup.
   *
   * @returns A promise that resolves once the config is loaded.
   */
  async load(): Promise<void> {
    setShellVariableWhenUserLookupFails()
    return super.load()
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
}

// oclif reads SHELL and falls back to os.userInfo(), which throws when the OS can't resolve the current
// user, killing the CLI during load. Remove once oclif guards that call; 4.8 and 4.11 both don't.
function setShellVariableWhenUserLookupFails(): void {
  if (process.env.SHELL !== undefined) return

  try {
    os.userInfo()
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    process.env.SHELL = 'unknown'
  }
}
