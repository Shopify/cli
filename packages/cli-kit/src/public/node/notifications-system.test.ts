import {
  Notification,
  fetchNotifications,
  fetchNotificationsInBackground,
  filterNotifications,
  showNotificationsIfNeeded,
  stringifyFilters,
} from './notifications-system.js'
import {renderError, renderInfo, renderWarning} from './ui.js'
import {fetch} from './http.js'
import {sniffForJson} from './path.js'
import {exec} from './system.js'
import {cacheRetrieve} from '../../private/node/conf-store.js'
import {afterEach, describe, expect, test, vi} from 'vitest'

vi.mock('./ui.js')
vi.mock('../../private/node/conf-store.js')
vi.mock('./path.js')
vi.mock('./system.js')
vi.mock('./http.js')

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

  test('calls the current Shopify entry point with the canonical Node executable', async () => {
    // Given / When
    fetchNotificationsInBackground('theme:list', ['/path/to/node', '/path/to/shopify', 'theme', 'list'], {
      SHOPIFY_UNIT_TEST: 'false',
    })

    // Then
    expect(exec).toHaveBeenCalledWith(
      process.execPath,
      ['/path/to/shopify', 'notifications', 'list', '--ignore-errors'],
      expect.anything(),
    )
  })
})

describe('fetchNotifications', () => {
  test('uses the default URL when SHOPIFY_CLI_NOTIFICATIONS_URL is not secure', async () => {
    // Given
    vi.stubEnv('SHOPIFY_CLI_NOTIFICATIONS_URL', 'http://malicious.com/notifications.json')
    vi.mocked(fetch).mockResolvedValue({
      status: 200,
      text: () => Promise.resolve(JSON.stringify({notifications: []})),
    } as any)

    // When
    await fetchNotifications()

    // Then
    expect(fetch).toHaveBeenCalledWith(
      'https://cdn.shopify.com/static/cli/notifications.json',
      undefined,
      expect.anything(),
    )
    vi.unstubAllEnvs()
  })

  test('uses the provided URL when SHOPIFY_CLI_NOTIFICATIONS_URL is secure', async () => {
    // Given
    const secureUrl = 'https://my-secure-repo.com/notifications.json'
    vi.stubEnv('SHOPIFY_CLI_NOTIFICATIONS_URL', secureUrl)
    vi.mocked(fetch).mockResolvedValue({
      status: 200,
      text: () => Promise.resolve(JSON.stringify({notifications: []})),
    } as any)

    // When
    await fetchNotifications()

    // Then
    expect(fetch).toHaveBeenCalledWith(secureUrl, undefined, expect.anything())
    vi.unstubAllEnvs()
  })
})

describe('stringifyFilters', () => {
  test('returns an empty string when notification has no filter options set', () => {
    // Given
    const notification: Notification = {
      id: 'test',
      message: 'msg',
      type: 'info',
      frequency: 'always',
      ownerChannel: 'channel',
    }

    // When
    const result = stringifyFilters(notification)

    // Then
    expect(result).toBe('')
  })

  test('stringifies dates, versions, frequencies, surface, and commands filters', () => {
    // Given
    const notification: Notification = {
      id: 'test',
      message: 'msg',
      type: 'info',
      frequency: 'once_a_day',
      ownerChannel: 'channel',
      minDate: '2023-01-01',
      maxDate: '2023-12-31',
      minVersion: '3.0.0',
      maxVersion: '4.0.0',
      surface: 'theme',
      commands: ['theme:dev', 'theme:push'],
    }

    // When
    const result = stringifyFilters(notification)

    // Then
    expect(result).toBe(
      [
        'from 2023-01-01',
        'to 2023-12-31',
        'from v3.0.0',
        'to v4.0.0',
        'show once a day',
        'surface = theme',
        'commands = theme:dev, theme:push',
      ].join('\n'),
    )
  })

  test('stringifies frequency once and once_a_week correctly', () => {
    // Given
    const onceNotification: Notification = {
      id: 'once',
      message: 'msg',
      type: 'info',
      frequency: 'once',
      ownerChannel: 'channel',
    }
    const onceAWeekNotification: Notification = {
      id: 'once_a_week',
      message: 'msg',
      type: 'info',
      frequency: 'once_a_week',
      ownerChannel: 'channel',
    }

    // When
    const onceResult = stringifyFilters(onceNotification)
    const onceAWeekResult = stringifyFilters(onceAWeekNotification)

    // Then
    expect(onceResult).toBe('show only once')
    expect(onceAWeekResult).toBe('show once a week')
  })
})
