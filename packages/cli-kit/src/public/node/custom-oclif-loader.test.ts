import {ShopifyConfig} from './custom-oclif-loader.js'
import {Config} from '@oclif/core'
import {describe, expect, test, vi} from 'vitest'

describe('ShopifyConfig', () => {
  test('delegates to super.runCommand when no lazy command loader is configured', async () => {
    const config = new ShopifyConfig({root: import.meta.url})
    const superRunCommandSpy = vi.spyOn(Config.prototype, 'runCommand').mockResolvedValue('super-result')

    const result = await config.runCommand('test-command', ['arg1'])

    expect(result).toBe('super-result')
    expect(superRunCommandSpy).toHaveBeenCalledWith('test-command', ['arg1'], null)
    superRunCommandSpy.mockRestore()
  })

  test('delegates to super.runCommand when command is not found', async () => {
    const config = new ShopifyConfig({root: import.meta.url})
    config.findCommand = vi.fn().mockReturnValue(undefined)
    const lazyCommandLoader = vi.fn()
    config.setLazyCommandLoader(lazyCommandLoader)

    const superRunCommandSpy = vi.spyOn(Config.prototype, 'runCommand').mockResolvedValue('super-result')

    const result = await config.runCommand('test-command', ['arg1'])

    expect(result).toBe('super-result')
    expect(config.findCommand).toHaveBeenCalledWith('test-command')
    expect(lazyCommandLoader).not.toHaveBeenCalled()
    expect(superRunCommandSpy).toHaveBeenCalledWith('test-command', ['arg1'], null)
    superRunCommandSpy.mockRestore()
  })

  test('delegates to super.runCommand when lazy command loader returns undefined', async () => {
    const config = new ShopifyConfig({root: import.meta.url})
    const mockCommand = {id: 'test-command', plugin: {}} as any
    config.findCommand = vi.fn().mockReturnValue(mockCommand)
    const lazyCommandLoader = vi.fn().mockResolvedValue(undefined)
    config.setLazyCommandLoader(lazyCommandLoader)

    const superRunCommandSpy = vi.spyOn(Config.prototype, 'runCommand').mockResolvedValue('super-result')

    const result = await config.runCommand('test-command', ['arg1'])

    expect(result).toBe('super-result')
    expect(config.findCommand).toHaveBeenCalledWith('test-command')
    expect(lazyCommandLoader).toHaveBeenCalledWith('test-command')
    expect(superRunCommandSpy).toHaveBeenCalledWith('test-command', ['arg1'], null)
    superRunCommandSpy.mockRestore()
  })

  test('loads and runs command successfully via lazy command loader', async () => {
    const config = new ShopifyConfig({root: import.meta.url})
    const mockPlugin = {name: 'mock-plugin'}
    const mockCommand = {id: 'test-command', plugin: mockPlugin} as any
    config.findCommand = vi.fn().mockReturnValue(mockCommand)

    const mockCommandClass = {
      run: vi.fn().mockResolvedValue('command-ran'),
    } as any

    const lazyCommandLoader = vi.fn().mockResolvedValue(mockCommandClass)
    config.setLazyCommandLoader(lazyCommandLoader)

    config.runHook = vi.fn().mockResolvedValue({successes: [], failures: []})

    const result = await config.runCommand('test-command', ['arg1'])

    expect(result).toBe('command-ran')
    expect(lazyCommandLoader).toHaveBeenCalledWith('test-command')
    expect(mockCommandClass.id).toBe('test-command')
    expect(mockCommandClass.plugin).toBe(mockPlugin)
    expect(config.runHook).toHaveBeenNthCalledWith(1, 'prerun', {argv: ['arg1'], Command: mockCommandClass})
    expect(mockCommandClass.run).toHaveBeenCalledWith(['arg1'], config)
    expect(config.runHook).toHaveBeenNthCalledWith(2, 'postrun', {
      argv: ['arg1'],
      Command: mockCommandClass,
      result: 'command-ran',
    })
  })

  test('loads and runs command with fallback plugin when command plugin is not set', async () => {
    const config = new ShopifyConfig({root: import.meta.url})
    const mockCommand = {id: 'test-command'} as any
    config.findCommand = vi.fn().mockReturnValue(mockCommand)
    ;(config as any).rootPlugin = {name: 'root-plugin'}

    const mockCommandClass = {
      run: vi.fn().mockResolvedValue('command-ran'),
    } as any

    const lazyCommandLoader = vi.fn().mockResolvedValue(mockCommandClass)
    config.setLazyCommandLoader(lazyCommandLoader)

    config.runHook = vi.fn().mockResolvedValue({successes: [], failures: []})

    await config.runCommand('test-command', ['arg1'])

    expect(mockCommandClass.plugin).toEqual({name: 'root-plugin'})
  })

  test('uses cachedCommand instead of calling findCommand if provided', async () => {
    const config = new ShopifyConfig({root: import.meta.url})
    config.findCommand = vi.fn()
    const mockPlugin = {name: 'mock-plugin'}
    const cachedCommand = {id: 'test-command', plugin: mockPlugin} as any

    const mockCommandClass = {
      run: vi.fn().mockResolvedValue('command-ran'),
    } as any

    const lazyCommandLoader = vi.fn().mockResolvedValue(mockCommandClass)
    config.setLazyCommandLoader(lazyCommandLoader)

    config.runHook = vi.fn().mockResolvedValue({successes: [], failures: []})

    const result = await config.runCommand('test-command', ['arg1'], cachedCommand)

    expect(result).toBe('command-ran')
    expect(config.findCommand).not.toHaveBeenCalled()
    expect(lazyCommandLoader).toHaveBeenCalledWith('test-command')
  })
})
