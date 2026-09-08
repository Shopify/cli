import {ShopifyConfig} from './custom-oclif-loader.js'
import {Config} from '@oclif/core'
import {afterEach, describe, expect, test, vi} from 'vitest'
import os from 'node:os'
import {fileURLToPath} from 'node:url'

describe('ShopifyConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

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

  test('loads successfully when the OS user lookup fails during shell detection', async () => {
    // oclif and the guard both only reach os.userInfo() when SHELL is unset.
    vi.stubEnv('SHELL', undefined)
    vi.spyOn(os, 'userInfo').mockImplementation(() => {
      throw osUserLookupError()
    })
    const config = new ShopifyConfig({root: fileURLToPath(import.meta.url)})

    await config.load()

    expect(config.shell).toBe('unknown')
  })

  test('reports the shell oclif detected when the OS user lookup succeeds', async () => {
    vi.stubEnv('SHELL', undefined)
    vi.spyOn(os, 'userInfo').mockReturnValue({
      username: 'test-user',
      uid: 1000,
      gid: 1000,
      homedir: '/home/test-user',
      shell: '/bin/fish',
    })
    const config = new ShopifyConfig({root: fileURLToPath(import.meta.url)})

    await config.load()

    expect(config.shell).toBe('fish')
  })
})

function osUserLookupError(): Error {
  return Object.assign(new Error('A system error occurred: uv_os_get_passwd returned ENOMEM (not enough memory)'), {
    code: 'ERR_SYSTEM_ERROR',
    info: {code: 'ENOMEM', errno: -4057, syscall: 'uv_os_get_passwd'},
  })
}
