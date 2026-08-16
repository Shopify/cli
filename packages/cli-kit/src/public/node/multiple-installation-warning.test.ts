import {showMultipleCLIWarningIfNeeded} from './multiple-installation-warning.js'
import {jsonOutputEnabled} from './environment.js'
import {currentProcessIsGlobal} from './is-global.js'
import {renderInfo} from './ui.js'
import {globalCLIVersion, localCLIVersion} from './version.js'
import {runAtMinimumInterval} from '../../private/node/conf-store.js'
import {describe, expect, test, vi, beforeEach} from 'vitest'

vi.mock('./environment.js')
vi.mock('./is-global.js')
vi.mock('./ui.js')
vi.mock('./version.js')
vi.mock('../../private/node/conf-store.js')

describe('showMultipleCLIWarningIfNeeded', () => {
  beforeEach(() => {
    vi.mocked(runAtMinimumInterval).mockImplementation(async (_key, _interval, task) => {
      await task()
      return true
    })
    vi.mocked(jsonOutputEnabled).mockReturnValue(false)
    vi.mocked(currentProcessIsGlobal).mockReturnValue(false)
    vi.mocked(globalCLIVersion).mockResolvedValue('3.68.0')
    vi.mocked(localCLIVersion).mockResolvedValue('3.68.0')
  })

  test('does not run if @shopify/cli is missing from dependencies', async () => {
    // Given
    const dependencies = {}

    // When
    await showMultipleCLIWarningIfNeeded('dir', dependencies)

    // Then
    expect(renderInfo).not.toHaveBeenCalled()
  })

  test('does not run if json output is enabled', async () => {
    // Given
    vi.mocked(jsonOutputEnabled).mockReturnValue(true)
    const dependencies = {'@shopify/cli': '3.68.0'}

    // When
    await showMultipleCLIWarningIfNeeded('dir', dependencies)

    // Then
    expect(renderInfo).not.toHaveBeenCalled()
  })

  test('does not run if global CLIVersion is not available and not in global process', async () => {
    // Given
    vi.mocked(globalCLIVersion).mockResolvedValue(undefined)
    const dependencies = {'@shopify/cli': '3.68.0'}

    // When
    await showMultipleCLIWarningIfNeeded('dir', dependencies)

    // Then
    expect(renderInfo).not.toHaveBeenCalled()
  })

  test('does not run if local CLIVersion is not available and in global process', async () => {
    // Given
    vi.mocked(currentProcessIsGlobal).mockReturnValue(true)
    vi.mocked(localCLIVersion).mockResolvedValue(undefined)
    const dependencies = {'@shopify/cli': '3.68.0'}

    // When
    await showMultipleCLIWarningIfNeeded('dir', dependencies)

    // Then
    expect(renderInfo).not.toHaveBeenCalled()
  })

  test('renders warning warning with local dependency message when process is not global', async () => {
    // Given
    const dependencies = {'@shopify/cli': '3.68.0'}

    // When
    await showMultipleCLIWarningIfNeeded('dir', dependencies)

    // Then
    expect(renderInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: expect.stringContaining('using local dependency'),
        body: expect.arrayContaining([
          expect.stringContaining('A global installation (v3.68.0) and a local dependency (v'),
        ]),
      }),
    )
  })

  test('renders warning with global installation message when process is global', async () => {
    // Given
    vi.mocked(currentProcessIsGlobal).mockReturnValue(true)
    const dependencies = {'@shopify/cli': '3.68.0'}

    // When
    await showMultipleCLIWarningIfNeeded('dir', dependencies)

    // Then
    expect(renderInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: expect.stringContaining('using global installation'),
      }),
    )
  })

  test('uses runAtMinimumInterval with correct interval options', async () => {
    // Given
    const dependencies = {'@shopify/cli': '3.68.0'}

    // When
    await showMultipleCLIWarningIfNeeded('dir', dependencies)

    // Then
    expect(runAtMinimumInterval).toHaveBeenCalledWith('warn-on-multiple-versions', {days: 1}, expect.any(Function))
  })
})
