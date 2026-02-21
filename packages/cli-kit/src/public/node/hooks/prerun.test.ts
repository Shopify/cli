import {parseCommandContent} from './prerun.js'
import {describe, expect, test} from 'vitest'

describe('parseCommandContent', () => {
  test('when a create command is used should return the correct command content', async () => {
    // Given
    const cmdInfo = {
      id: 'init',
      aliases: [],
      pluginAlias: '@shopify/create-app',
    }

    // When
    const got = parseCommandContent(cmdInfo)

    // Then
    expect(got).not.toBeUndefined()
    expect(got.command).toBe('create-app')
    expect(got.topic).toBeUndefined()
    expect(got.alias).toBeUndefined()
  })

  test('when a normal command is used without topic should return the correct command content', async () => {
    // Given
    const cmdInfo = {
      id: 'upgrade',
      aliases: [],
      pluginAlias: '@shopify/cli',
    }

    // When
    const got = parseCommandContent(cmdInfo)

    // Then
    expect(got).not.toBeUndefined()
    expect(got.command).toBe('upgrade')
    expect(got.topic).toBeUndefined()
    expect(got.alias).toBeUndefined()
  })

  test('when a normal command is with topic should return the correct command content', async () => {
    // Given
    const cmdInfo = {
      id: 'app:dev',
      aliases: [],
      pluginAlias: '@shopify/cli',
    }

    // When
    const got = parseCommandContent(cmdInfo)

    // Then
    expect(got).not.toBeUndefined()
    expect(got.command).toBe('app dev')
    expect(got.topic).toBe('app')
    expect(got.alias).toBeUndefined()
  })

  test('when a normal command is with alias should return the correct command content', async () => {
    // Given
    const cmdInfo = {
      id: 'upgrade',
      aliases: ['upgradeAlias'],
      pluginAlias: '@shopify/cli',
    }
    process.argv = ['upgradeAlias']

    // When
    const got = parseCommandContent(cmdInfo)

    // Then
    expect(got).not.toBeUndefined()
    expect(got.command).toBe('upgrade')
    expect(got.topic).toBeUndefined()
    expect(got.alias).toBe('upgradeAlias')
  })
})
