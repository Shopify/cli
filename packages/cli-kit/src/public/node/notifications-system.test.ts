import {Notification, filterNotifications} from './notifications-system.js'
import {describe, expect, test} from 'vitest'

const betweenVersins1and2: Notification = {
  message: 'message',
  type: 'info',
  minVersion: '1.0',
  maxVersion: '2.0',
}

const betweenDatesIn2000: Notification = {
  message: 'message',
  type: 'info',
  minDate: '2000-01-01',
  maxDate: '2000-12-31',
}

const fromVersion1: Notification = {
  message: 'message',
  type: 'info',
  minVersion: '1.0',
}

const upToVersion2: Notification = {
  message: 'message',
  type: 'info',
  maxVersion: '2.0',
}

const fromDateJan2000: Notification = {
  message: 'message',
  type: 'info',
  minDate: '2000-01-01',
}

const upToDateDec2000: Notification = {
  message: 'message',
  type: 'info',
  maxDate: '2000-12-31',
}

const onlyForDevCommand: Notification = {
  message: 'message',
  type: 'info',
  commands: ['app:dev'],
}

const defaultInput = [
  betweenVersins1and2,
  betweenDatesIn2000,
  fromVersion1,
  upToVersion2,
  fromDateJan2000,
  upToDateDec2000,
  onlyForDevCommand,
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
  output: Notification[]
}

const testCases: TestCase[] = [
  {
    name: 'all filters pass',
    input: defaultInput,
    commandId: 'app:dev',
    version: '1.0.0',
    date: '2000-02-01',
    output: defaultInput,
  },
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
]

describe('notifications-system filter notifications', () => {
  test.each(testCases)('Filter for %name', ({input, commandId, version, date, output}) => {
    // When
    const result = filterNotifications(input, commandId, new Date(date), version)

    // Then
    expect(result).toEqual(output)
  })
})
