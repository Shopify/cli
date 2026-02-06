import DoctorTheme from './index.js'
import {runThemeDoctor} from '../../../services/doctor/theme/runner.js'
import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'
import {test, expect, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('../../../services/doctor/theme/runner.js')

test('does not run theme doctor when user cancels', async () => {
  // Given
  vi.mocked(renderConfirmationPrompt).mockResolvedValue(false)

  // When
  await DoctorTheme.run(['--environment', 'test'])

  // Then
  expect(runThemeDoctor).not.toHaveBeenCalled()
})

test('runs theme doctor when user confirms', async () => {
  // Given
  vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
  vi.mocked(runThemeDoctor).mockResolvedValue([])

  // When
  await DoctorTheme.run(['--environment', 'test'])

  // Then
  expect(runThemeDoctor).toHaveBeenCalled()
})
