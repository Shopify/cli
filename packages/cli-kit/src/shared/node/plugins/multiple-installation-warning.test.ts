import {clearCache} from '../cli.js'
import {currentProcessIsGlobal} from '../is-global.js'
import {showMultipleCLIWarningIfNeeded} from '../multiple-installation-warning.js'
import {mockAndCaptureOutput} from '../testing/output.js'
import {globalCLIVersion, localCLIVersion} from '../version.js'
import {CLI_KIT_VERSION} from '../../common/version.js'
import {describe, beforeEach, test, vi, expect} from 'vitest'

vi.mock('../version.js')
vi.mock('../is-global.js')

describe('showMultipleCLIWarningIfNeeded', () => {
  beforeEach(() => {
    clearCache()
  })

  test('shows warning if using global CLI but app has local dependency', async () => {
    // Given
    vi.mocked(currentProcessIsGlobal).mockReturnValue(true)
    vi.mocked(globalCLIVersion).mockResolvedValue(CLI_KIT_VERSION)
    vi.mocked(localCLIVersion).mockResolvedValue('3.70.0')
    const mockOutput = mockAndCaptureOutput()

    // When
    await showMultipleCLIWarningIfNeeded('path', {'@shopify/cli': '3.70.0'})

    // Then
    expect(mockOutput.info()).toMatchInlineSnapshot(`
        "╭─ info ───────────────────────────────────────────────────────────────────────╮
        │                                                                              │
        │  Two Shopify CLI installations found – using global installation             │
        │                                                                              │
        │  A global installation (v${CLI_KIT_VERSION}) and a local dependency (v3.70.0) were       │
        │  detected.                                                                   │
        │  We recommend removing the @shopify/cli and @shopify/app dependencies from   │
        │  your package.json, unless you want to use different versions across         │
        │  multiple apps.                                                              │
        │                                                                              │
        │  See Shopify CLI documentation. [1]                                          │
        │                                                                              │
        ╰──────────────────────────────────────────────────────────────────────────────╯
        [1] https://shopify.dev/docs/apps/build/cli-for-apps#switch-to-a-global-executab
        le-or-local-dependency
        "
      `)
    mockOutput.clear()
  })

  test('shows warning if using local CLI but app has global dependency', async () => {
    // Given
    vi.mocked(currentProcessIsGlobal).mockReturnValue(false)
    vi.mocked(globalCLIVersion).mockResolvedValue('3.70.0')
    vi.mocked(localCLIVersion).mockResolvedValue(CLI_KIT_VERSION)
    const mockOutput = mockAndCaptureOutput()

    // When
    await showMultipleCLIWarningIfNeeded('path', {'@shopify/cli': CLI_KIT_VERSION})

    // Then
    expect(mockOutput.info()).toMatchInlineSnapshot(`
        "╭─ info ───────────────────────────────────────────────────────────────────────╮
        │                                                                              │
        │  Two Shopify CLI installations found – using local dependency                │
        │                                                                              │
        │  A global installation (v3.70.0) and a local dependency (v${CLI_KIT_VERSION}) were       │
        │  detected.                                                                   │
        │  We recommend removing the @shopify/cli and @shopify/app dependencies from   │
        │  your package.json, unless you want to use different versions across         │
        │  multiple apps.                                                              │
        │                                                                              │
        │  See Shopify CLI documentation. [1]                                          │
        │                                                                              │
        ╰──────────────────────────────────────────────────────────────────────────────╯
        [1] https://shopify.dev/docs/apps/build/cli-for-apps#switch-to-a-global-executab
        le-or-local-dependency
        "
      `)
    mockOutput.clear()
  })

  test('does not show two consecutive warnings', async () => {
    // Given
    vi.mocked(currentProcessIsGlobal).mockReturnValue(true)
    vi.mocked(globalCLIVersion).mockResolvedValue(CLI_KIT_VERSION)
    vi.mocked(localCLIVersion).mockResolvedValue('3.70.0')
    const mockOutput = mockAndCaptureOutput()

    // When
    await showMultipleCLIWarningIfNeeded('path', {'@shopify/cli': '3.70.0'})
    await showMultipleCLIWarningIfNeeded('path', {'@shopify/cli': '3.70.0'})

    // Then
    expect(mockOutput.info()).toMatchInlineSnapshot(`
        "╭─ info ───────────────────────────────────────────────────────────────────────╮
        │                                                                              │
        │  Two Shopify CLI installations found – using global installation             │
        │                                                                              │
        │  A global installation (v${CLI_KIT_VERSION}) and a local dependency (v3.70.0) were       │
        │  detected.                                                                   │
        │  We recommend removing the @shopify/cli and @shopify/app dependencies from   │
        │  your package.json, unless you want to use different versions across         │
        │  multiple apps.                                                              │
        │                                                                              │
        │  See Shopify CLI documentation. [1]                                          │
        │                                                                              │
        ╰──────────────────────────────────────────────────────────────────────────────╯
        [1] https://shopify.dev/docs/apps/build/cli-for-apps#switch-to-a-global-executab
        le-or-local-dependency
        "
      `)
  })

  test('does not show a warning if there is no local dependency', async () => {
    // Given
    vi.mocked(currentProcessIsGlobal).mockReturnValue(true)
    vi.mocked(globalCLIVersion).mockResolvedValue(CLI_KIT_VERSION)
    vi.mocked(localCLIVersion).mockResolvedValue(undefined)
    const mockOutput = mockAndCaptureOutput()

    // When
    await showMultipleCLIWarningIfNeeded('path', {})

    // Then
    expect(mockOutput.warn()).toBe('')
    mockOutput.clear()
  })

  test('does not show a warning if there is no global dependency', async () => {
    // Given
    vi.mocked(currentProcessIsGlobal).mockReturnValue(false)
    vi.mocked(globalCLIVersion).mockResolvedValue(undefined)
    vi.mocked(localCLIVersion).mockResolvedValue(CLI_KIT_VERSION)
    const mockOutput = mockAndCaptureOutput()

    // When
    await showMultipleCLIWarningIfNeeded('path', {'@shopify/cli': CLI_KIT_VERSION})

    // Then
    expect(mockOutput.warn()).toBe('')
    mockOutput.clear()
  })
})
