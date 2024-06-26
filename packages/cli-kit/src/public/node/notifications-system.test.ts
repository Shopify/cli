import {Notification, filterNotifications} from './notifications-system.js'
import {describe, expect, test} from 'vitest'

const notification1: Notification = {
  title: 'title',
  message: 'message',
  type: 'info',
  minVersion: '1.0.0',
  maxVersion: '2.0.0',
  minDate: '2021-01-01',
  maxDate: '2021-01-02',
  commands: ['commandId'],
}

interface TestCase {
  input: Notification[]
  commandId: string
  version: string
  date: Date
  output: Notification[]
}

const testCases: TestCase[] = [
  {
    input: [],
    commandId: '',
    version: '',
    date: new Date(),
    output: [],
  },
]

describe('notifications-system filter notifications', () => {
  test.each(testCases)('Filters', ({input, commandId, version, date, output}) => {
    // When
    const result = filterNotifications(input, commandId, date, version)

    // Then
    expect(result).toEqual(output)
  })
})
