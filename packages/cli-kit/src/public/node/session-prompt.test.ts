import {promptSessionSelect, promptSessionSelectWithDetails} from './session-prompt.js'
import {renderSelectPrompt, renderTextPrompt} from './ui.js'
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
      },
      applications: {},
    },
  },
}

describe('promptSessionSelect', () => {
  beforeEach(() => {
    vi.mocked(identityFqdn).mockResolvedValue('identity.fqdn.com')
    vi.mocked(ensureAuthenticatedUser).mockResolvedValue({userId: 'new-user-id'})
    vi.mocked(sessionStore.getSessionAccount).mockResolvedValue({userId: 'new-user-id', alias: 'new-alias'})
    vi.mocked(sessionStore.findSessionAccountByAlias).mockResolvedValue(undefined)
  })

  test('prompts user to create new session when no existing sessions', async () => {
    // Given
    vi.mocked(sessionStore.fetch).mockResolvedValue(undefined)

    // When
    const result = await promptSessionSelect()

    // Then
    expect(renderSelectPrompt).not.toHaveBeenCalled()
    expect(ensureAuthenticatedUser).toHaveBeenCalledWith({}, {forceNewSession: true})
    expect(sessionStore.getSessionAccount).toHaveBeenCalledWith('new-user-id')
    expect(result).toEqual('new-alias')
  })

  test('prompts for alias when no alias is stored', async () => {
    // Given
    vi.mocked(sessionStore.fetch).mockResolvedValue(undefined)
    vi.mocked(sessionStore.getSessionAccount).mockResolvedValue(undefined)
    vi.mocked(renderTextPrompt).mockResolvedValue('typed-alias')

    // When
    const result = await promptSessionSelect()

    // Then
    expect(renderTextPrompt).toHaveBeenCalled()
    expect(sessionStore.setSessionAlias).toHaveBeenCalledWith('new-user-id', 'typed-alias')
    expect(result).toEqual('typed-alias')
  })

  test('prompts user to create new session with alias when no existing sessions', async () => {
    // Given
    vi.mocked(sessionStore.fetch).mockResolvedValue(undefined)
    vi.mocked(sessionStore.getSessionAccount).mockResolvedValue({userId: 'new-user-id', alias: 'custom-alias'})

    // When
    const result = await promptSessionSelect('my-alias')

    // Then
    expect(renderSelectPrompt).not.toHaveBeenCalled()
    expect(ensureAuthenticatedUser).toHaveBeenCalledWith({}, {forceNewSession: true})
    expect(sessionStore.getSessionAccount).toHaveBeenCalledWith('new-user-id')
    expect(result).toEqual('custom-alias')
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
        {label: 'Log in with a different account', value: 'NEW_LOGIN'},
      ],
    })
    expect(setCurrentSessionId).toHaveBeenCalledWith('user1')
    expect(result).toEqual('Work Account')
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
        {label: 'Log in with a different account', value: 'NEW_LOGIN'},
      ],
    })
    expect(setCurrentSessionId).toHaveBeenCalledWith('user3')
    expect(result).toEqual('user3')
  })

  test('creates new session when user selects "Log in with a different account"', async () => {
    // Given
    vi.mocked(sessionStore.fetch).mockResolvedValue(mockSessions)
    vi.mocked(renderSelectPrompt).mockResolvedValue('NEW_LOGIN')

    // When
    const result = await promptSessionSelect()

    // Then
    expect(ensureAuthenticatedUser).toHaveBeenCalledWith({}, {forceNewSession: true})
    expect(sessionStore.getSessionAccount).toHaveBeenCalledWith('new-user-id')
    expect(result).toEqual('new-alias')
  })

  test('creates new session with alias when user selects "Log in with a different account"', async () => {
    // Given
    vi.mocked(sessionStore.fetch).mockResolvedValue(mockSessions)
    vi.mocked(renderSelectPrompt).mockResolvedValue('NEW_LOGIN')
    vi.mocked(sessionStore.getSessionAccount).mockResolvedValue({userId: 'new-user-id', alias: 'custom-alias'})

    // When
    const result = await promptSessionSelect('work-alias')

    // Then
    expect(ensureAuthenticatedUser).toHaveBeenCalledWith({}, {forceNewSession: true})
    expect(sessionStore.getSessionAccount).toHaveBeenCalledWith('new-user-id')
    expect(result).toEqual('custom-alias')
  })

  test('prompts for alias when selecting "Log in with a different account" and no alias is stored', async () => {
    // Given
    vi.mocked(sessionStore.fetch).mockResolvedValue(mockSessions)
    vi.mocked(renderSelectPrompt).mockResolvedValue('NEW_LOGIN')
    vi.mocked(sessionStore.getSessionAccount).mockResolvedValue(undefined)
    vi.mocked(renderTextPrompt).mockResolvedValue('my-work-account')

    // When
    const result = await promptSessionSelect()

    // Then
    expect(ensureAuthenticatedUser).toHaveBeenCalledWith({}, {forceNewSession: true})
    expect(renderTextPrompt).toHaveBeenCalledWith({
      message: 'Enter an alias for this account (e.g. your email or a nickname)',
    })
    expect(sessionStore.setSessionAlias).toHaveBeenCalledWith('new-user-id', 'my-work-account')
    expect(result).toEqual('my-work-account')
  })

  test('does not update alias for existing session when not provided', async () => {
    // Given
    vi.mocked(sessionStore.fetch).mockResolvedValue(mockSessions)
    vi.mocked(renderSelectPrompt).mockResolvedValue('user1')

    // When
    const result = await promptSessionSelect()

    // Then
    expect(setCurrentSessionId).toHaveBeenCalledWith('user1')
    expect(result).toEqual('Work Account')
  })

  test('switches to existing session when alias is provided and found', async () => {
    // Given
    vi.mocked(sessionStore.fetch).mockResolvedValue(mockSessions)
    vi.mocked(sessionStore.findSessionAccountByAlias).mockResolvedValue({userId: 'user1', alias: 'Work Account'})

    // When
    const result = await promptSessionSelect('Work Account')

    // Then
    expect(sessionStore.findSessionAccountByAlias).toHaveBeenCalledWith('Work Account')
    expect(setCurrentSessionId).toHaveBeenCalledWith('user1')
    expect(renderSelectPrompt).not.toHaveBeenCalled()
    expect(ensureAuthenticatedUser).not.toHaveBeenCalled()
    expect(result).toEqual('Work Account')
  })

  test('shows session selection when alias is not found', async () => {
    // Given
    vi.mocked(sessionStore.fetch).mockResolvedValue(mockSessions)
    vi.mocked(sessionStore.findSessionAccountByAlias).mockResolvedValue(undefined)
    vi.mocked(renderSelectPrompt).mockResolvedValue('user2')

    // When
    const result = await promptSessionSelect('Non-existent Alias')

    // Then
    expect(sessionStore.findSessionAccountByAlias).toHaveBeenCalledWith('Non-existent Alias')
    expect(renderSelectPrompt).toHaveBeenCalled()
    expect(setCurrentSessionId).toHaveBeenCalledWith('user2')
    expect(result).toEqual('user2')
  })
})

describe('promptSessionSelectWithDetails', () => {
  beforeEach(() => {
    vi.mocked(identityFqdn).mockResolvedValue('identity.fqdn.com')
  })

  test('returns the new account ID and stored email without credentials', async () => {
    vi.mocked(sessionStore.fetch).mockResolvedValue(undefined)
    vi.mocked(ensureAuthenticatedUser).mockResolvedValue({userId: 'new-user-id'})
    vi.mocked(sessionStore.getSessionAccount).mockResolvedValue({
      userId: 'new-user-id',
      alias: 'Work Account',
      email: 'new@example.com',
    })

    await expect(promptSessionSelectWithDetails()).resolves.toEqual({
      userId: 'new-user-id',
      alias: 'Work Account',
      email: 'new@example.com',
    })
    expect(sessionStore.getSessionAccount).toHaveBeenCalledWith('new-user-id')
  })

  test('returns null for an email-looking legacy alias without a stored email', async () => {
    vi.mocked(sessionStore.findSessionAccountByAlias).mockResolvedValue({userId: 'user1', alias: 'legacy@example.com'})

    await expect(promptSessionSelectWithDetails('legacy@example.com')).resolves.toEqual({
      userId: 'user1',
      alias: 'legacy@example.com',
      email: null,
    })
    expect(ensureAuthenticatedUser).not.toHaveBeenCalled()
  })

  test('returns null when the stored email is empty', async () => {
    vi.mocked(sessionStore.findSessionAccountByAlias).mockResolvedValue({
      userId: 'user1',
      alias: 'Work Account',
      email: '',
    })

    await expect(promptSessionSelectWithDetails('Work Account')).resolves.toEqual({
      userId: 'user1',
      alias: 'Work Account',
      email: null,
    })
  })

  test('keeps user-ID selection compatible while returning its verified email', async () => {
    vi.mocked(sessionStore.findSessionAccountByAlias).mockResolvedValue({
      userId: 'user1',
      alias: 'Work Account',
      email: 'work@example.com',
    })

    await expect(promptSessionSelectWithDetails('user1')).resolves.toEqual({
      userId: 'user1',
      alias: 'user1',
      email: 'work@example.com',
    })
    expect(setCurrentSessionId).toHaveBeenCalledWith('user1')
  })

  test('returns the selected account when aliases are duplicated', async () => {
    const sessions: Sessions = {
      'identity.fqdn.com': {
        user1: {
          ...mockSessions['identity.fqdn.com']!.user1!,
          identity: {
            ...mockSessions['identity.fqdn.com']!.user1!.identity,
            alias: 'Shared',
            email: 'first@example.com',
          },
        },
        user2: {
          ...mockSessions['identity.fqdn.com']!.user2!,
          identity: {
            ...mockSessions['identity.fqdn.com']!.user2!.identity,
            alias: 'Shared',
            email: 'second@example.com',
          },
        },
      },
    }
    vi.mocked(sessionStore.fetch).mockResolvedValue(sessions)
    vi.mocked(renderSelectPrompt).mockResolvedValue('user2')

    await expect(promptSessionSelectWithDetails()).resolves.toEqual({
      userId: 'user2',
      alias: 'Shared',
      email: 'second@example.com',
    })
    expect(renderSelectPrompt).toHaveBeenCalledWith({
      message: 'Which account would you like to use?',
      choices: [
        {label: 'Shared', value: 'user1'},
        {label: 'Shared', value: 'user2'},
        {label: 'Log in with a different account', value: 'NEW_LOGIN'},
      ],
    })
    expect(setCurrentSessionId).toHaveBeenCalledWith('user2')
  })

  test('returns the typed alias and null email when a new account has no stored details', async () => {
    vi.mocked(sessionStore.fetch).mockResolvedValue(undefined)
    vi.mocked(ensureAuthenticatedUser).mockResolvedValue({userId: 'new-user-id'})
    vi.mocked(sessionStore.getSessionAccount).mockResolvedValue(undefined)
    vi.mocked(renderTextPrompt).mockResolvedValue('New account')

    await expect(promptSessionSelectWithDetails()).resolves.toEqual({
      userId: 'new-user-id',
      alias: 'New account',
      email: null,
    })
    expect(sessionStore.setSessionAlias).toHaveBeenCalledWith('new-user-id', 'New account')
  })
})
