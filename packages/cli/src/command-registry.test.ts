import {loadCommand} from './command-registry.js'
import {describe, expect, test} from 'vitest'

describe('loadCommand', () => {
  test('returns undefined for a command id that is not in the manifest', async () => {
    await expect(loadCommand('definitely:not:a:command')).resolves.toBeUndefined()
  })

  test('loads an external oclif plugin command from its package command table', async () => {
    // `commands` is owned by @oclif/plugin-commands, which is loaded through
    // the full-package fallback rather than per-file loading.
    const command = await loadCommand('commands')

    expect(command).toBeTypeOf('function')
  })

  test('loads the plugins command from @oclif/plugin-plugins', async () => {
    const command = await loadCommand('plugins')

    expect(command).toBeTypeOf('function')
  })
})
