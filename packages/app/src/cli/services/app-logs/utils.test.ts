import {subscribeToAppLogs} from './utils.js'
import {testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {expect, test} from 'vitest'

test('does not write the subscription JWT to debug output', async () => {
  // Given
  const jwtToken = 'super-secret-jwt-token'
  const outputMock = mockAndCaptureOutput()
  outputMock.clear()
  const developerPlatformClient = testDeveloperPlatformClient({
    subscribeToAppLogs: () => Promise.resolve({appLogsSubscribe: {success: true, jwtToken}}),
  })

  // When
  const result = await subscribeToAppLogs(developerPlatformClient, {apiKey: 'api-key', shopIds: [1]}, 'org-id')

  // Then
  expect(result).toEqual(jwtToken)
  expect(outputMock.debug()).not.toContain(jwtToken)
})
