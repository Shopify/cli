import {promptSessionSelect} from './session-prompt.js'
import {renderSelectPrompt} from './ui.js'
import {ensureAuthenticatedUser} from './session.js'
import {identityFqdn} from './context/fqdn.js'
import {setCurrentSessionId} from '../../private/node/conf-store.js'
import * as sessionStore from '../../private/node/session/store.js'
import {Sessions} from '../../private/node/session/schema.js'
import {describe, expect, vi, test, beforeEach} from 'vitest'

vi.mock('./ui.js')
vi.mock('./session.js')
vi.mock('./context/fqdn.js')
vi.mock('../../private/node/conf-store.js')
vi.mock('../../private/node/session/store.js')

const mockSessions: Sessions = {
  'identity.fqdn.com': {
    user1: {
      identity: {
        accessToken: 'token1',
        refreshToken: 'refresh1',
        expiresAt: new Date(),
        scopes: ['scope1'],
        userId: 'user1',
        alias: 'Work Account',
      },
      applications: {},
    },
    user2: {
      identity: {
        accessToken: 'token2',
        refreshToken: 'refresh2',
        expiresAt: new Date(),
        scopes: ['scope2'],
        userId: 'user2',
        // Default alias is same as userId
        alias: 'user2',
      },
      applications: {},
    },
  },
}

describe('promptSessionSelect', () => {
  beforeEach(() => {
    vi.mocked(identityFqdn).mockResolvedValue('identity.fqdn.com')
    vi.mocked(ensureAuthenticatedUser).mockResolvedValue({userId: 'new-user-id'})
    vi.mocked(sessionStore.updateSessionAlias).mockResolvedValue()
  })

  test('prompts user to create new session when no existing sessions', async () => {
    // Given
    vi.mocked(sessionStore.fetch).mockResolvedValue(undefined)

    // When
    const result = await promptSessionSelect()

    // Then
    expect(renderSelectPrompt).not.toHaveBeenCalled()
    expect(ensureAuthenticatedUser).toHaveBeenCalledWith({}, {forceNewSession: true, alias: undefined})
    expect(result).toEqual({userId: 'new-user-id'})
  })

  test('prompts user to create new session with alias when no existing sessions', async () => {
    // Given
    vi.mocked(sessionStore.fetch).mockResolvedValue(undefined)

    // When
    const result = await promptSessionSelect('my-alias')

    // Then
    expect(renderSelectPrompt).not.toHaveBeenCalled()
    expect(ensureAuthenticatedUser).toHaveBeenCalledWith({}, {forceNewSession: true, alias: 'my-alias'})
    expect(result).toEqual({userId: 'new-user-id'})
  })

  test('shows existing sessions and allows selection', async () => {
    // Given
    vi.mocked(sessionStore.fetch).mockResolvedValue(mockSessions)
    vi.mocked(renderSelectPrompt).mockResolvedValue('user1')

    // When
    const result = await promptSessionSelect()

    // Then
    expect(renderSelectPrompt).toHaveBeenCalledWith({
      message: 'Which account would you like to use?',
      choices: [
        {label: 'Work Account', value: 'user1'},
        {label: 'user2', value: 'user2'},
        {label: 'Log in with a new account', value: 'NEW_LOGIN'},
      ],
    })
    expect(setCurrentSessionId).toHaveBeenCalledWith('user1')
    expect(result).toEqual({userId: 'user1'})
  })

  test('handles missing alias in existing session gracefully', async () => {
    // Given
    const sessionsWithMissingAlias: Sessions = {
      'identity.fqdn.com': {
        user3: {
          identity: {
            accessToken: 'token3',
            refreshToken: 'refresh3',
            expiresAt: new Date(),
            scopes: ['scope3'],
            userId: 'user3',
            // Missing alias
            alias: undefined as any,
          },
          applications: {},
        },
      },
    }
    vi.mocked(sessionStore.fetch).mockResolvedValue(sessionsWithMissingAlias)
    vi.mocked(renderSelectPrompt).mockResolvedValue('user3')

    // When
    const result = await promptSessionSelect()

    // Then
    expect(renderSelectPrompt).toHaveBeenCalledWith({
      message: 'Which account would you like to use?',
      choices: [
        // Falls back to userId when alias is missing
        {label: 'user3', value: 'user3'},
        {label: 'Log in with a new account', value: 'NEW_LOGIN'},
      ],
    })
    expect(setCurrentSessionId).toHaveBeenCalledWith('user3')
    expect(result).toEqual({userId: 'user3'})
  })

  test('creates new session when user selects "Log in with a new account"', async () => {
    // Given
    vi.mocked(sessionStore.fetch).mockResolvedValue(mockSessions)
    vi.mocked(renderSelectPrompt).mockResolvedValue('NEW_LOGIN')

    // When
    const result = await promptSessionSelect()

    // Then
    expect(ensureAuthenticatedUser).toHaveBeenCalledWith({}, {forceNewSession: true, alias: undefined})
    expect(result).toEqual({userId: 'new-user-id'})
  })

  test('creates new session with alias when user selects "Log in with a new account"', async () => {
    // Given
    vi.mocked(sessionStore.fetch).mockResolvedValue(mockSessions)
    vi.mocked(renderSelectPrompt).mockResolvedValue('NEW_LOGIN')

    // When
    const result = await promptSessionSelect('work-alias')

    // Then
    expect(ensureAuthenticatedUser).toHaveBeenCalledWith({}, {forceNewSession: true, alias: 'work-alias'})
    expect(result).toEqual({userId: 'new-user-id'})
  })

  test('updates alias for existing session when provided', async () => {
    // Given
    vi.mocked(sessionStore.fetch).mockResolvedValue(mockSessions)
    vi.mocked(renderSelectPrompt).mockResolvedValue('user1')

    // When
    const result = await promptSessionSelect('updated-alias')

    // Then
    expect(setCurrentSessionId).toHaveBeenCalledWith('user1')
    expect(sessionStore.updateSessionAlias).toHaveBeenCalledWith('user1', 'updated-alias')
    expect(result).toEqual({userId: 'user1'})
  })

  test('does not update alias for existing session when not provided', async () => {
    // Given
    vi.mocked(sessionStore.fetch).mockResolvedValue(mockSessions)
    vi.mocked(renderSelectPrompt).mockResolvedValue('user1')

    // When
    const result = await promptSessionSelect()

    // Then
    expect(setCurrentSessionId).toHaveBeenCalledWith('user1')
    expect(sessionStore.updateSessionAlias).not.toHaveBeenCalled()
    expect(result).toEqual({userId: 'user1'})
  })
})
