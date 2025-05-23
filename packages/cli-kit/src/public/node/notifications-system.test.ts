import {
  Notification,
  fetchNotificationsInBackground,
  filterNotifications,
  showNotificationsIfNeeded,
  getNotifications,
  fetchNotifications,
  stringifyFilters,
} from './notifications-system.js'
import {renderError, renderInfo, renderWarning} from './ui.js'
import {sniffForJson} from './path.js'
import {exec} from './system.js'
import {cacheRetrieve, cacheStore} from '../../private/node/conf-store.js'
import {fetch} from '@shopify/cli-kit/node/http'
import {afterEach, describe, expect, test, vi} from 'vitest'

vi.mock('./ui.js')
vi.mock('../../private/node/conf-store.js')
vi.mock('./path.js')
vi.mock('./system.js')
vi.mock('@shopify/cli-kit/node/http')

const betweenVersins1and2: Notification = {
  id: 'betweenVersins1and2',
  message: 'message',
  type: 'info',
  frequency: 'always',
  ownerChannel: 'channel',
  minVersion: '1.0',
  maxVersion: '2.0',
}

const betweenDatesIn2000: Notification = {
  id: 'betweenDatesIn2000',
  message: 'message',
  type: 'info',
  frequency: 'always',
  ownerChannel: 'channel',
  minDate: '2000-01-01',
  maxDate: '2000-12-31',
}

const fromVersion1: Notification = {
  id: 'fromVersion1',
  message: 'message',
  type: 'info',
  frequency: 'always',
  ownerChannel: 'channel',
  minVersion: '1.0',
}

const upToVersion2: Notification = {
  id: 'upToVersion2',
  message: 'message',
  type: 'info',
  frequency: 'always',
  ownerChannel: 'channel',
  maxVersion: '2.0',
}

const fromDateJan2000: Notification = {
  id: 'fromDateJan2000',
  message: 'message',
  type: 'info',
  frequency: 'always',
  ownerChannel: 'channel',
  minDate: '2000-01-01',
}

const upToDateDec2000: Notification = {
  id: 'upToDateDec2000',
  message: 'message',
  type: 'info',
  frequency: 'always',
  ownerChannel: 'channel',
  maxDate: '2000-12-31',
}

const onlyForDevCommand: Notification = {
  id: 'onlyForDevCommand',
  message: 'message',
  type: 'info',
  frequency: 'always',
  ownerChannel: 'channel',
  commands: ['app:dev'],
}

const onlyForThemeSurface: Notification = {
  id: 'onlyForThemeSurface',
  message: 'message',
  type: 'info',
  frequency: 'always',
  ownerChannel: 'channel',
  surface: 'theme',
}

const unknownSurface: Notification = {
  id: 'unknownSurface',
  message: 'message',
  type: 'info',
  frequency: 'always',
  ownerChannel: 'channel',
  surface: 'unknown',
}

const extensionSurface: Notification = {
  id: 'extensionSurface',
  message: 'message',
  type: 'info',
  frequency: 'always',
  ownerChannel: 'channel',
  surface: 'ui-extension',
}

const showOnce: Notification = {
  id: 'showOnce',
  message: 'message',
  type: 'info',
  frequency: 'once',
  ownerChannel: 'channel',
}

const showOnceADay: Notification = {
  id: 'showOnceADay',
  message: 'message',
  type: 'info',
  frequency: 'once_a_day',
  ownerChannel: 'channel',
}

const showOnceAWeek: Notification = {
  id: 'showOnceAWeek',
  message: 'message',
  type: 'info',
  frequency: 'once_a_week',
  ownerChannel: 'channel',
}

const showAlways: Notification = {
  id: 'showAlways',
  message: 'message',
  type: 'info',
  frequency: 'always',
  ownerChannel: 'channel',
}

const infoNotification: Notification = {
  id: 'infoNotification',
  message: 'message',
  type: 'info',
  frequency: 'always',
  ownerChannel: 'channel',
}

const errorNotification: Notification = {
  id: 'errorNotification',
  message: 'message',
  type: 'error',
  frequency: 'always',
  ownerChannel: 'channel',
}

const warningNotification: Notification = {
  id: 'warningNotification',
  message: 'message',
  type: 'warning',
  frequency: 'always',
  ownerChannel: 'channel',
}

const defaultInput = [
  betweenVersins1and2,
  betweenDatesIn2000,
  fromVersion1,
  upToVersion2,
  fromDateJan2000,
  upToDateDec2000,
  onlyForDevCommand,
  onlyForThemeSurface,
  unknownSurface,
  extensionSurface,
]

/**
 * Represents a test case
 * @param input - the initial notifications received from remote
 * @param comamndId - The current command being executed
 * @param veresion - The current version of the CLI
 * @param date - The current date for the user
 * @param output - The expected filtered notifications
 */
interface TestCase {
  name: string
  input: Notification[]
  commandId: string
  version: string
  date: string
  surfaces?: string[]
  output: Notification[]
}

const testCases: TestCase[] = [
  {
    name: 'Only for app:info command, excludes notifications for explicit commands',
    input: defaultInput,
    commandId: 'app:info',
    version: '1.0.0',
    date: '2000-02-01',
    output: [betweenVersins1and2, betweenDatesIn2000, fromVersion1, upToVersion2, fromDateJan2000, upToDateDec2000],
  },
  {
    name: 'Notifications for version 2.1.0',
    input: defaultInput,
    commandId: 'app:info',
    version: '2.1.0',
    date: '2000-02-01',
    output: [betweenDatesIn2000, fromVersion1, fromDateJan2000, upToDateDec2000],
  },
  {
    name: 'Notifications for year 9999',
    input: defaultInput,
    commandId: 'app:info',
    version: '1.0.0',
    date: '9999-02-01',
    output: [betweenVersins1and2, fromVersion1, upToVersion2, fromDateJan2000],
  },
  {
    name: 'Notifications for version 1.5, in year 1990',
    input: defaultInput,
    commandId: 'app:info',
    version: '1.5.0',
    date: '1990-02-01',
    output: [betweenVersins1and2, fromVersion1, upToVersion2, upToDateDec2000],
  },
  {
    name: 'Notifications for version 2.1, and year 2024 and dev command',
    input: defaultInput,
    commandId: 'app:dev',
    version: '2.1.0',
    date: '2024-02-01',
    output: [fromVersion1, fromDateJan2000, onlyForDevCommand],
  },
  {
    name: 'Notifications for theme surface',
    input: defaultInput,
    commandId: 'theme:dev',
    version: '2.1.0',
    date: '2024-02-01',
    output: [fromVersion1, fromDateJan2000, onlyForThemeSurface],
  },
  {
    name: 'Notifications for unknown surface is never shown',
    input: defaultInput,
    commandId: 'version',
    version: '2.1.0',
    date: '2024-02-01',
    output: [fromVersion1, fromDateJan2000],
  },
  {
    name: 'Notifications for extension type surface is shown',
    input: defaultInput,
    commandId: 'version',
    version: '2.1.0',
    date: '2024-02-01',
    surfaces: ['ui-extension', 'function'],
    output: [extensionSurface],
  },
]

afterEach(() => {
  // Restore Date mock
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('filterNotifications', () => {
  test.each(testCases)('Filter for %name', ({input, commandId, version, date, surfaces, output}) => {
    // When
    const result = filterNotifications(input, commandId, surfaces, new Date(date), version)

    // Then
    expect(result).toEqual(output)
  })

  test('Filter for frequency with always', async () => {
    // Given
    const current = new Date('2020-01-15T00:00:00.000Z')
    const yesterday = new Date('2020-01-14T08:00:00.000Z')
    vi.setSystemTime(current)
    vi.mocked(cacheRetrieve).mockReturnValue({value: yesterday.getTime().toString(), timestamp: 0})

    // When
    const result = filterNotifications([showAlways], 'version')

    // Then
    expect(result).toEqual([showAlways])
  })

  test('Filter for frequency with once', async () => {
    // Given
    const current = new Date('2020-01-15T00:00:00.000Z')
    vi.setSystemTime(current)
    vi.mocked(cacheRetrieve).mockReturnValueOnce(undefined)
    vi.mocked(cacheRetrieve).mockReturnValueOnce({value: current.getTime().toString(), timestamp: 0})

    // When/Then
    const result = filterNotifications([showOnce], 'version')
    expect(result).toEqual([showOnce])
    const result2 = filterNotifications([showOnce], 'version')
    expect(result2).toEqual([])
  })

  test('Filter for frequency with once_a_day', async () => {
    // Given
    const current = new Date('2020-01-15T08:00:00.000Z')
    const yesterday = new Date('2020-01-14T00:00:00.000Z')
    vi.setSystemTime(current)
    vi.mocked(cacheRetrieve).mockReturnValueOnce({value: yesterday.getTime().toString(), timestamp: 0})
    vi.mocked(cacheRetrieve).mockReturnValueOnce({value: current.getTime().toString(), timestamp: 0})

    // When/Then
    const result = filterNotifications([showOnceADay], 'version')
    expect(result).toEqual([showOnceADay])
    const result2 = filterNotifications([showOnceADay], 'version')
    expect(result2).toEqual([])
  })

  test('Filter for frequency with once_a_week', async () => {
    // Given
    const current = new Date('2020-01-15T08:00:00.000Z')
    const yesterday = new Date('2020-01-14T08:00:00.000Z')
    const lastWeek = new Date('2020-01-03T00:00:00.000Z')
    vi.setSystemTime(current)
    vi.mocked(cacheRetrieve).mockReturnValueOnce({value: lastWeek.getTime().toString(), timestamp: 0})
    vi.mocked(cacheRetrieve).mockReturnValueOnce({value: yesterday.getTime().toString(), timestamp: 0})

    // When/Then
    const result = filterNotifications([showOnceAWeek], 'version')
    expect(result).toEqual([showOnceAWeek])
    const result2 = filterNotifications([showOnceAWeek], 'version')
    expect(result2).toEqual([])
  })
})

describe('showNotificationsIfNeeded', () => {
  test('an info notification triggers a renderInfo call', async () => {
    // Given
    const notifications = [infoNotification]
    vi.mocked(cacheRetrieve).mockReturnValue({value: JSON.stringify({notifications}), timestamp: 0})

    // When
    await showNotificationsIfNeeded(undefined, {SHOPIFY_UNIT_TEST: 'false'})

    // Then
    expect(renderInfo).toHaveBeenCalled()
  })

  test('a warning notification triggers a renderWarning call', async () => {
    // Given
    const notifications = [warningNotification]
    vi.mocked(cacheRetrieve).mockReturnValue({value: JSON.stringify({notifications}), timestamp: 0})

    // When
    await showNotificationsIfNeeded(undefined, {SHOPIFY_UNIT_TEST: 'false'})

    // Then
    expect(renderWarning).toHaveBeenCalled()
  })

  test('an error notification triggers a renderError call and throws an error', async () => {
    // Given
    const notifications = [errorNotification]
    vi.mocked(cacheRetrieve).mockReturnValue({value: JSON.stringify({notifications}), timestamp: 0})

    // When
    await expect(showNotificationsIfNeeded(undefined, {SHOPIFY_UNIT_TEST: 'false'})).rejects.toThrowError()

    // Then
    expect(renderError).toHaveBeenCalled()
  })

  test('notifications are skipped on CI', async () => {
    // Given
    const notifications = [infoNotification]
    vi.mocked(cacheRetrieve).mockReturnValue({value: JSON.stringify({notifications}), timestamp: 0})

    // When
    await showNotificationsIfNeeded(undefined, {SHOPIFY_UNIT_TEST: 'false', CI: 'true'})

    // Then
    expect(renderInfo).not.toHaveBeenCalled()
  })

  test('notifications are skipped on tests', async () => {
    // Given
    const notifications = [infoNotification]
    vi.mocked(cacheRetrieve).mockReturnValue({value: JSON.stringify({notifications}), timestamp: 0})

    // When
    await showNotificationsIfNeeded(undefined, {SHOPIFY_UNIT_TEST: 'true'})

    // Then
    expect(renderInfo).not.toHaveBeenCalled()
  })

  test('notifications are skipped when using --json flag', async () => {
    // Given
    const notifications = [infoNotification]
    vi.mocked(cacheRetrieve).mockReturnValue({value: JSON.stringify({notifications}), timestamp: 0})
    vi.mocked(sniffForJson).mockReturnValue(true)

    // When
    await showNotificationsIfNeeded(undefined, {SHOPIFY_UNIT_TEST: 'false'})

    // Then
    expect(renderInfo).not.toHaveBeenCalled()
  })

  test('notifications are skipped when using SHOPIFY_FLAG_JSON', async () => {
    // Given
    const notifications = [infoNotification]
    vi.mocked(cacheRetrieve).mockReturnValue({value: JSON.stringify({notifications}), timestamp: 0})

    // When
    await showNotificationsIfNeeded(undefined, {SHOPIFY_UNIT_TEST: 'false', SHOPIFY_FLAG_JSON: 'true'})

    // Then
    expect(renderInfo).not.toHaveBeenCalled()
  })
})

describe('fetchNotificationsInBackground', () => {
  test('does nothing for the init command', async () => {
    // Given / When
    fetchNotificationsInBackground('init', ['shopify', 'create-app'], {SHOPIFY_UNIT_TEST: 'false'})

    // Then
    expect(exec).not.toHaveBeenCalled()
  })

  test('does nothing for the notifications list command', async () => {
    // Given / When
    fetchNotificationsInBackground('notifications:list', ['shopify', 'notifications', 'list'], {
      SHOPIFY_UNIT_TEST: 'false',
    })

    // Then
    expect(exec).not.toHaveBeenCalled()
  })

  test('calls the expected Shopify binary', async () => {
    // Given / When
    fetchNotificationsInBackground('theme:list', ['/path/to/node', '/path/to/shopify', 'theme', 'list'], {
      SHOPIFY_UNIT_TEST: 'false',
    })

    // Then
    expect(exec).toHaveBeenCalledWith(
      '/path/to/node',
      ['/path/to/shopify', 'notifications', 'list', '--ignore-errors'],
      expect.anything(),
    )
  })
})

describe('getNotifications', () => {
  test('returns cached notifications when available', async () => {
    // Given
    const notifications = {notifications: [infoNotification]}
    vi.mocked(cacheRetrieve).mockReturnValue({
      value: JSON.stringify(notifications),
      timestamp: 0,
    })

    // When
    const result = await getNotifications()

    // Then
    expect(result).toEqual(notifications)
  })

  test('throws error when cache is empty', async () => {
    // Given
    vi.mocked(cacheRetrieve).mockReturnValue(undefined)

    // When / Then
    await expect(getNotifications()).rejects.toThrow('Cache is empty')
  })

  test('throws error when cached data is invalid JSON', async () => {
    // Given
    vi.mocked(cacheRetrieve).mockReturnValue({
      value: 'invalid json',
      timestamp: 0,
    })

    // When / Then
    await expect(getNotifications()).rejects.toThrow()
  })

  test('throws error when cached data does not match schema', async () => {
    // Given
    vi.mocked(cacheRetrieve).mockReturnValue({
      value: JSON.stringify({invalid: 'data'}),
      timestamp: 0,
    })

    // When / Then
    await expect(getNotifications()).rejects.toThrow()
  })
})

describe('fetchNotifications', () => {
  test('fetches and caches notifications successfully', async () => {
    // Given
    const notifications = {notifications: [infoNotification]}
    const mockResponse = {
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify(notifications)),
    }
    vi.mocked(fetch).mockResolvedValue(mockResponse as any)

    // When
    const result = await fetchNotifications()

    // Then
    expect(result).toEqual(notifications)
    expect(fetch).toHaveBeenCalledWith('https://cdn.shopify.com/static/cli/notifications.json', undefined, {
      useNetworkLevelRetry: false,
      useAbortSignal: true,
      timeoutMs: 3000,
    })
    expect(cacheStore).toHaveBeenCalledWith(
      'notifications-https://cdn.shopify.com/static/cli/notifications.json',
      JSON.stringify(notifications),
    )
  })

  test('throws error when fetch fails with non-200 status', async () => {
    // Given
    const mockResponse = {
      status: 404,
      statusText: 'Not Found',
    }
    vi.mocked(fetch).mockResolvedValue(mockResponse as any)

    // When / Then
    await expect(fetchNotifications()).rejects.toThrow('Failed to fetch notifications: Not Found')
  })

  test('throws error when response is invalid JSON', async () => {
    // Given
    const mockResponse = {
      status: 200,
      text: vi.fn().mockResolvedValue('invalid json'),
    }
    vi.mocked(fetch).mockResolvedValue(mockResponse as any)

    // When / Then
    await expect(fetchNotifications()).rejects.toThrow()
  })

  test('throws error when response does not match schema', async () => {
    // Given
    const mockResponse = {
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify({invalid: 'data'})),
    }
    vi.mocked(fetch).mockResolvedValue(mockResponse as any)

    // When / Then
    await expect(fetchNotifications()).rejects.toThrow()
  })

  test('uses custom URL from environment variable', async () => {
    // Given
    const customUrl = 'https://custom.url/notifications.json'
    vi.stubEnv('SHOPIFY_CLI_NOTIFICATIONS_URL', customUrl)
    const notifications = {notifications: [infoNotification]}
    const mockResponse = {
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify(notifications)),
    }
    vi.mocked(fetch).mockResolvedValue(mockResponse as any)

    // When
    await fetchNotifications()

    // Then
    expect(fetch).toHaveBeenCalledWith(customUrl, undefined, expect.any(Object))

    vi.unstubAllEnvs()
  })
})

describe('stringifyFilters', () => {
  test('returns empty string for notification with no filters', () => {
    // Given
    const notification: Notification = {
      id: 'simple',
      message: 'message',
      type: 'info',
      frequency: 'always',
      ownerChannel: 'channel',
    }

    // When
    const result = stringifyFilters(notification)

    // Then
    expect(result).toBe('')
  })

  test('formats date filters correctly', () => {
    // Given
    const notification: Notification = {
      id: 'dateFilters',
      message: 'message',
      type: 'info',
      frequency: 'always',
      ownerChannel: 'channel',
      minDate: '2023-01-01',
      maxDate: '2023-12-31',
    }

    // When
    const result = stringifyFilters(notification)

    // Then
    expect(result).toBe('from 2023-01-01\nto 2023-12-31')
  })

  test('formats version filters correctly', () => {
    // Given
    const notification: Notification = {
      id: 'versionFilters',
      message: 'message',
      type: 'info',
      frequency: 'always',
      ownerChannel: 'channel',
      minVersion: '1.0.0',
      maxVersion: '2.0.0',
    }

    // When
    const result = stringifyFilters(notification)

    // Then
    expect(result).toBe('from v1.0.0\nto v2.0.0')
  })

  test('formats frequency filters correctly', () => {
    // Given
    const onceNotification: Notification = {
      id: 'once',
      message: 'message',
      type: 'info',
      frequency: 'once',
      ownerChannel: 'channel',
    }
    const dailyNotification: Notification = {
      id: 'daily',
      message: 'message',
      type: 'info',
      frequency: 'once_a_day',
      ownerChannel: 'channel',
    }
    const weeklyNotification: Notification = {
      id: 'weekly',
      message: 'message',
      type: 'info',
      frequency: 'once_a_week',
      ownerChannel: 'channel',
    }

    // When / Then
    expect(stringifyFilters(onceNotification)).toBe('show only once')
    expect(stringifyFilters(dailyNotification)).toBe('show once a day')
    expect(stringifyFilters(weeklyNotification)).toBe('show once a week')
  })

  test('formats surface and command filters correctly', () => {
    // Given
    const notification: Notification = {
      id: 'surfaceCommands',
      message: 'message',
      type: 'info',
      frequency: 'always',
      ownerChannel: 'channel',
      surface: 'theme',
      commands: ['theme:dev', 'theme:push'],
    }

    // When
    const result = stringifyFilters(notification)

    // Then
    expect(result).toBe('surface = theme\ncommands = theme:dev, theme:push')
  })

  test('formats all filters together correctly', () => {
    // Given
    const notification: Notification = {
      id: 'allFilters',
      message: 'message',
      type: 'info',
      frequency: 'once_a_day',
      ownerChannel: 'channel',
      minDate: '2023-01-01',
      maxDate: '2023-12-31',
      minVersion: '1.0.0',
      maxVersion: '2.0.0',
      surface: 'app',
      commands: ['app:dev'],
    }

    // When
    const result = stringifyFilters(notification)

    // Then
    expect(result).toBe(
      'from 2023-01-01\nto 2023-12-31\nfrom v1.0.0\nto v2.0.0\nshow once a day\nsurface = app\ncommands = app:dev',
    )
  })
})

describe('showNotificationsIfNeeded - additional error scenarios', () => {
  test('handles empty cache error gracefully', async () => {
    // Given
    vi.mocked(cacheRetrieve).mockReturnValue(undefined)

    // When / Then (should not throw)
    await expect(showNotificationsIfNeeded(undefined, {SHOPIFY_UNIT_TEST: 'false'})).resolves.toBeUndefined()
  })

  test('handles generic errors and sends to bugsnag', async () => {
    // Given
    const error = new Error('Something went wrong')
    vi.mocked(cacheRetrieve).mockImplementation(() => {
      throw error
    })

    // When / Then (should not throw)
    await expect(showNotificationsIfNeeded(undefined, {SHOPIFY_UNIT_TEST: 'false'})).resolves.toBeUndefined()
  })

  test('limits notifications to first 2', async () => {
    // Given
    const notifications = [infoNotification, warningNotification, errorNotification]
    vi.mocked(cacheRetrieve).mockReturnValue({value: JSON.stringify({notifications}), timestamp: 0})

    // When
    await showNotificationsIfNeeded(undefined, {SHOPIFY_UNIT_TEST: 'false'})

    // Then
    expect(renderInfo).toHaveBeenCalledTimes(1)
    expect(renderWarning).toHaveBeenCalledTimes(1)
    expect(renderError).not.toHaveBeenCalled()
    expect(cacheStore).toHaveBeenCalledTimes(2)
  })

  test('processes notification message with newlines correctly', async () => {
    // Given
    const notificationWithNewlines: Notification = {
      id: 'newlines',
      message: 'Line 1\\nLine 2\\nLine 3',
      type: 'info',
      frequency: 'always',
      ownerChannel: 'channel',
    }
    vi.mocked(cacheRetrieve).mockReturnValue({
      value: JSON.stringify({notifications: [notificationWithNewlines]}),
      timestamp: 0,
    })

    // When
    await showNotificationsIfNeeded(undefined, {SHOPIFY_UNIT_TEST: 'false'})

    // Then
    expect(renderInfo).toHaveBeenCalledWith({
      headline: undefined,
      body: 'Line 1\nLine 2\nLine 3',
      link: undefined,
    })
  })

  test('includes CTA link in notification', async () => {
    // Given
    const notificationWithCTA: Notification = {
      id: 'withCTA',
      message: 'Check this out!',
      type: 'info',
      frequency: 'always',
      ownerChannel: 'channel',
      title: 'Important Update',
      cta: {
        label: 'Learn More',
        url: 'https://shopify.dev',
      },
    }
    vi.mocked(cacheRetrieve).mockReturnValue({
      value: JSON.stringify({notifications: [notificationWithCTA]}),
      timestamp: 0,
    })

    // When
    await showNotificationsIfNeeded(undefined, {SHOPIFY_UNIT_TEST: 'false'})

    // Then
    expect(renderInfo).toHaveBeenCalledWith({
      headline: 'Important Update',
      body: 'Check this out!',
      link: {
        label: 'Learn More',
        url: 'https://shopify.dev',
      },
    })
  })
})

describe('fetchNotificationsInBackground - additional scenarios', () => {
  test('does nothing when argv is incomplete', () => {
    // Given / When
    fetchNotificationsInBackground('app:dev', [], {SHOPIFY_UNIT_TEST: 'false'})

    // Then
    expect(exec).not.toHaveBeenCalled()
  })

  test('does nothing when argv[0] is missing', () => {
    // Given / When
    fetchNotificationsInBackground('app:dev', [undefined as any, '/path/to/shopify'], {SHOPIFY_UNIT_TEST: 'false'})

    // Then
    expect(exec).not.toHaveBeenCalled()
  })

  test('does nothing when argv[1] is missing', () => {
    // Given / When
    fetchNotificationsInBackground('app:dev', ['/path/to/node'], {SHOPIFY_UNIT_TEST: 'false'})

    // Then
    expect(exec).not.toHaveBeenCalled()
  })

  test('skips all commands in COMMANDS_TO_SKIP', () => {
    const commandsToSkip = [
      'notifications:list',
      'notifications:generate',
      'init',
      'app:init',
      'theme:init',
      'hydrogen:init',
      'cache:clear',
    ]

    commandsToSkip.forEach((command) => {
      fetchNotificationsInBackground(command, ['/path/to/node', '/path/to/shopify'], {SHOPIFY_UNIT_TEST: 'false'})
      expect(exec).not.toHaveBeenCalled()
    })
  })
})
