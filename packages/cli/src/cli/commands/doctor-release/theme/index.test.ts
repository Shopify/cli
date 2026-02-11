import DoctorReleaseTheme from './index.js'
import {runThemeDoctor} from '../../../services/doctor-release/theme/runner.js'
import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'
import {afterEach, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('../../../services/doctor-release/theme/runner.js')

afterEach(() => {
  vi.unstubAllEnvs()
})

test('does not run theme doctor when user cancels', async () => {
  // Given
  vi.stubEnv('SHOPIFY_CLI_DOCTOR', '1')
  vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)

  // When
  await DoctorReleaseTheme.run(['--environment', 'test'])

  // Then
  expect(runThemeDoctor).not.toHaveBeenCalled()
})

test('runs theme doctor when user confirms', async () => {
  // Given
  vi.stubEnv('SHOPIFY_CLI_DOCTOR', '1')
  vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
  vi.mocked(runThemeDoctor).mockResolvedValue([])

  // When
  await DoctorReleaseTheme.run(['--environment', 'test'])

  // Then
  expect(runThemeDoctor).toHaveBeenCalled()
})

test('does not run theme doctor when environment variable is not set', async () => {
  // Given - no SHOPIFY_CLI_DOCTOR env var set

  // When
  await DoctorReleaseTheme.run(['--environment', 'test'])

  // Then - neither prompt nor doctor should be called
  expect(renderConfirmationPrompt).not.toHaveBeenCalled()
  expect(runThemeDoctor).not.toHaveBeenCalled()
})
