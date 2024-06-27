import {Notification, filterNotifications} from './notifications-system.js'
import {getCache} from '../../private/node/conf-store.js'
import {afterEach, describe, expect, test, vi} from 'vitest'

vi.mock('../../private/node/conf-store.js')

const betweenVersins1and2: Notification = {
  id: 'betweenVersins1and2',
  message: 'message',
  type: 'info',
  minVersion: '1.0',
  maxVersion: '2.0',
}

const betweenDatesIn2000: Notification = {
  id: 'betweenDatesIn2000',
  message: 'message',
  type: 'info',
  minDate: '2000-01-01',
  maxDate: '2000-12-31',
}

const fromVersion1: Notification = {
  id: 'fromVersion1',
  message: 'message',
  type: 'info',
  minVersion: '1.0',
}

const upToVersion2: Notification = {
  id: 'upToVersion2',
  message: 'message',
  type: 'info',
  maxVersion: '2.0',
}

const fromDateJan2000: Notification = {
  id: 'fromDateJan2000',
  message: 'message',
  type: 'info',
  minDate: '2000-01-01',
}

const upToDateDec2000: Notification = {
  id: 'upToDateDec2000',
  message: 'message',
  type: 'info',
  maxDate: '2000-12-31',
}

const onlyForDevCommand: Notification = {
  id: 'onlyForDevCommand',
  message: 'message',
  type: 'info',
  commands: ['app:dev'],
}

const onlyForThemeSurface: Notification = {
  id: 'onlyForThemeSurface',
  message: 'message',
  type: 'info',
  surface: 'theme',
}

const unknownSurface: Notification = {
  id: 'unknownSurface',
  message: 'message',
  type: 'info',
  surface: 'unknown',
}

const extensionSurface: Notification = {
  id: 'extensionSurface',
  message: 'message',
  type: 'info',
  surface: 'ui-extension',
}

const showOnce: Notification = {
  id: 'showOnce',
  message: 'message',
  type: 'info',
  frequency: 'once',
}

const showOnceADay: Notification = {
  id: 'showOnceADay',
  message: 'message',
  type: 'info',
  frequency: 'once_a_day',
}

const showOnceAWeek: Notification = {
  id: 'showOnceAWeek',
  message: 'message',
  type: 'info',
  frequency: 'once_a_week',
}

const showAlways: Notification = {
  id: 'showAlways',
  message: 'message',
  type: 'info',
  frequency: 'always',
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

const defaultSurfaces = ['app', 'theme', 'hydrogen']

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

describe('notifications-system filter notifications', () => {
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
    vi.mocked(getCache).mockReturnValue(yesterday.getTime().toString())

    // When
    const result = filterNotifications([showAlways], 'version')

    // Then
    expect(result).toEqual([showAlways])
  })

  test('Filter for frequency with once', async () => {
    // Given
    const current = new Date('2020-01-15T00:00:00.000Z')
    vi.setSystemTime(current)
    vi.mocked(getCache).mockReturnValueOnce(undefined)
    vi.mocked(getCache).mockReturnValueOnce(current.getTime().toString())

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
    vi.mocked(getCache).mockReturnValueOnce(yesterday.getTime().toString())
    vi.mocked(getCache).mockReturnValueOnce(current.getTime().toString())

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
    vi.mocked(getCache).mockReturnValueOnce(lastWeek.getTime().toString())
    vi.mocked(getCache).mockReturnValueOnce(yesterday.getTime().toString())

    // When/Then
    const result = filterNotifications([showOnceAWeek], 'version')
    expect(result).toEqual([showOnceAWeek])
    const result2 = filterNotifications([showOnceAWeek], 'version')
    expect(result2).toEqual([])
  })
})
