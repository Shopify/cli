import {ShopifyConfig} from './custom-oclif-loader.js'
import {Config, Command} from '@oclif/core'
import {describe, expect, test, vi} from 'vitest'

describe('ShopifyConfig', () => {
  test('falls back to super.runCommand if no lazyCommandLoader is set', async () => {
    const config = new ShopifyConfig({root: import.meta.url})
    const superRunCommandSpy = vi.spyOn(Config.prototype, 'runCommand').mockResolvedValue('fallback-result')

    const result = await config.runCommand('test-command', ['arg1'])

    expect(result).toBe('fallback-result')
    expect(superRunCommandSpy).toHaveBeenCalledWith('test-command', ['arg1'], null)
    superRunCommandSpy.mockRestore()
  })

  test('falls back to super.runCommand if lazyCommandLoader is set but findCommand and cachedCommand return null/undefined', async () => {
    const config = new ShopifyConfig({root: import.meta.url})
    const lazyCommandLoader = vi.fn().mockResolvedValue(undefined)
    config.setLazyCommandLoader(lazyCommandLoader)
    config.findCommand = vi.fn().mockReturnValue(undefined)

    const superRunCommandSpy = vi.spyOn(Config.prototype, 'runCommand').mockResolvedValue('fallback-result')

    const result = await config.runCommand('test-command', ['arg1'])

    expect(result).toBe('fallback-result')
    expect(superRunCommandSpy).toHaveBeenCalledWith('test-command', ['arg1'], null)
    expect(lazyCommandLoader).not.toHaveBeenCalled()
    superRunCommandSpy.mockRestore()
  })

  test('falls back to super.runCommand if lazyCommandLoader is set and cachedCommand exists, but lazyCommandLoader returns undefined', async () => {
    const config = new ShopifyConfig({root: import.meta.url})
    const lazyCommandLoader = vi.fn().mockResolvedValue(undefined)
    config.setLazyCommandLoader(lazyCommandLoader)

    const cachedCommand = {id: 'test-command'} as Command.Loadable
    const superRunCommandSpy = vi.spyOn(Config.prototype, 'runCommand').mockResolvedValue('fallback-result')

    const result = await config.runCommand('test-command', ['arg1'], cachedCommand)

    expect(result).toBe('fallback-result')
    expect(superRunCommandSpy).toHaveBeenCalledWith('test-command', ['arg1'], cachedCommand)
    expect(lazyCommandLoader).toHaveBeenCalledWith('test-command')
    superRunCommandSpy.mockRestore()
  })

  test('successfully runs command lazily and returns result', async () => {
    const config = new ShopifyConfig({root: import.meta.url})
    const runMock = vi.fn().mockResolvedValue('command-result')
    const commandClass = {
      run: runMock,
    } as any

    const lazyCommandLoader = vi.fn().mockResolvedValue(commandClass)
    config.setLazyCommandLoader(lazyCommandLoader)

    const cmdPlugin = {name: 'test-plugin'} as any
    const cachedCommand = {id: 'test-command', plugin: cmdPlugin} as any

    config.runHook = vi.fn().mockResolvedValue({successes: [], failures: []})

    const result = await config.runCommand('test-command', ['arg1'], cachedCommand)

    expect(result).toBe('command-result')
    expect(lazyCommandLoader).toHaveBeenCalledWith('test-command')
    expect(commandClass.id).toBe('test-command')
    expect(commandClass.plugin).toBe(cmdPlugin)
    expect(config.runHook).toHaveBeenCalledWith('prerun', {argv: ['arg1'], Command: commandClass})
    expect(runMock).toHaveBeenCalledWith(['arg1'], config)
    expect(config.runHook).toHaveBeenCalledWith('postrun', {
      argv: ['arg1'],
      Command: commandClass,
      result: 'command-result',
    })
  })

  test('successfully runs command lazily with plugin fallback to rootPlugin', async () => {
    const config = new ShopifyConfig({root: import.meta.url})
    const runMock = vi.fn().mockResolvedValue('command-result')
    const commandClass = {
      run: runMock,
    } as any

    const lazyCommandLoader = vi.fn().mockResolvedValue(commandClass)
    config.setLazyCommandLoader(lazyCommandLoader)

    const rootPlugin = {name: 'root-plugin'} as any
    ;(config as any).rootPlugin = rootPlugin
    const cachedCommand = {id: 'test-command'} as any

    config.runHook = vi.fn().mockResolvedValue({successes: [], failures: []})

    const result = await config.runCommand('test-command', ['arg1'], cachedCommand)

    expect(result).toBe('command-result')
    expect(commandClass.plugin).toBe(rootPlugin)
  })
})
