import {findAlternativeCommand, shouldRunCommand} from './index.js'
import {isAutocorrectEnabled} from './services/conf.js'
import {describe, it, expect, vi} from 'vitest'
import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'

interface Config {
  commandIDs: string[]
  commands: {
    id: string
    hidden: boolean
    aliases: string[]
  }[]
}

function buildConfig(commands: {id: string; hidden: boolean; aliases: string[]}[]): Config {
  return {
    commandIDs: commands.map((cmd) => cmd.id),
    commands,
  }
}

vi.mock('./services/conf.js')
vi.mock('@shopify/cli-kit/node/ui')

describe('commandNotFound hook', () => {
  it('returns a probable match', () => {
    // Given
    const config: Config = buildConfig([
      {
        id: 'version',
        hidden: false,
        aliases: [],
      },
    ])

    // When
    const got = findAlternativeCommand({
      id: 'vesion',
      argv: [],
      config: config as any,
    })

    // Then
    expect(got).toBe('version')
  })

  it('gives up if nothing matches', () => {
    // Given
    const config: Config = buildConfig([
      {
        id: 'version',
        hidden: false,
        aliases: [],
      },
    ])

    // When
    const got = findAlternativeCommand({
      id: 'i-like-to-move-it-move-it',
      argv: [],
      config: config as any,
    })

    // Then
    expect(got).toBeUndefined()
  })

  it('returns a match when the command is made of multiple words', () => {
    // Given
    const config: Config = buildConfig([
      {
        id: 'app:generate:extension',
        hidden: false,
        aliases: [],
      },
    ])

    // When
    const got = findAlternativeCommand({
      id: 'app:generate:xtension',
      argv: [],
      config: config as any,
    })

    // Then
    expect(got).toBe('app:generate:extension')
  })

  it('returns a match when the command in the wrong order', () => {
    // Given
    const config: Config = buildConfig([
      {
        id: 'app:generate:extension',
        hidden: false,
        aliases: [],
      },
    ])

    // When
    const got = findAlternativeCommand({
      id: 'app:extension:generate',
      argv: [],
      config: config as any,
    })

    // Then
    expect(got).toBe('app:generate:extension')
  })

  it('gives up if command is too short', () => {
    // Given
    const config: Config = buildConfig([
      {
        id: 'version',
        hidden: false,
        aliases: [],
      },
    ])

    // When
    const got = findAlternativeCommand({
      id: 'v',
      argv: [],
      config: config as any,
    })

    // Then
    expect(got).toBeUndefined()
  })

  it('gives up if command does not share any bigram with available commands', () => {
    // Given
    const config: Config = buildConfig([
      {
        id: 'help',
        hidden: false,
        aliases: [],
      },
    ])

    // When
    const got = findAlternativeCommand({
      id: 'vers',
      argv: [],
      config: config as any,
    })

    // Then
    expect(got).toBeUndefined()
  })

  it('should run command if isActive is true', async () => {
    // Given
    vi.mocked(isAutocorrectEnabled).mockReturnValue(true)

    // When
    const got = await shouldRunCommand('version', 'vers')

    // Then
    expect(got).toBeTruthy()
    expect(renderConfirmationPrompt).not.toBeCalled()
  })

  it('should call renderConfirmationPrompt if isActive is false', async () => {
    // Given
    vi.mocked(isAutocorrectEnabled).mockReturnValue(false)
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)

    // When
    const got = await shouldRunCommand('version', 'vers')

    // Then
    expect(got).toBeTruthy()
    expect(renderConfirmationPrompt).toBeCalled()
  })

  it('prefers commands that have more in common with the user command', () => {
    // Given
    const config: Config = buildConfig([
      {
        id: 'app:generate:extension',
        hidden: false,
        aliases: [],
      },
      {
        id: 'extension',
        hidden: false,
        aliases: [],
      },
    ])

    // When
    const got = findAlternativeCommand({
      id: 'extension:generate',
      argv: [],
      config: config as any,
    })

    // Then
    expect(got).toBe('app:generate:extension')
  })

  it('when score is equal, prefers shorter commands', () => {
    // Given
    const config: Config = buildConfig([
      {
        id: 'app:function:build',
        hidden: false,
        aliases: [],
      },
      {
        id: 'app:build',
        hidden: false,
        aliases: [],
      },
      {
        id: 'guild',
        hidden: false,
        aliases: [],
      },
    ])

    // When
    const got = findAlternativeCommand({
      id: 'build',
      argv: [],
      config: config as any,
    })

    // Then
    expect(got).toBe('app:build')
  })
})
