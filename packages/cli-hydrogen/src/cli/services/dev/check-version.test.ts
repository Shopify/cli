import {checkHydrogenVersion} from './check-version.js'
import {afterEach, beforeEach, describe, it, expect, vi} from 'vitest'
import {outputMocker} from '@shopify/cli-kit'
import {checkForNewVersion} from '@shopify/cli-kit/node/node-package-manager'
import {captureOutput} from '@shopify/cli-kit/node/system'

vi.mock('@shopify/cli-kit/node/system')
vi.mock('@shopify/cli-kit/node/node-package-manager', () => {
  return {
    checkForNewVersion: vi.fn(),
  }
})

describe('checkHydrogenVersion()', () => {
  beforeEach(() => {
    vi.mocked(captureOutput).mockResolvedValue('1.0.0')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    outputMocker.mockAndCaptureOutput().clear()
  })

  it('checks the node_modules folder for the currently installed version', async () => {
    await checkHydrogenVersion('dir')

    expect(captureOutput).toHaveBeenCalledWith(
      'node',
      ['-p', `require('./node_modules/@shopify/hydrogen/package.json').version`],
      {
        cwd: 'dir',
      },
    )
  })

  describe('when a current version is available', () => {
    it('calls checkForNewVersion', async () => {
      await checkHydrogenVersion('dir')

      expect(checkForNewVersion).toHaveBeenCalledWith('@shopify/hydrogen', '1.0.0')
    })

    describe('and it is up to date', () => {
      beforeEach(() => {
        vi.mocked(checkForNewVersion).mockResolvedValue(undefined)
      })

      it('returns undefined', async () => {
        expect(await checkHydrogenVersion('dir')).toBe(undefined)
      })

      it('does not output any text', async () => {
        const outputMock = outputMocker.mockAndCaptureOutput()

        await checkHydrogenVersion('dir')

        expect(outputMock.output()).toBe('')
      })
    })

    describe('and a new version is available', () => {
      beforeEach(() => {
        vi.mocked(checkForNewVersion).mockResolvedValue('2.0.0')
      })

      it('returns the new version number', async () => {
        expect(await checkHydrogenVersion('dir')).toBe('2.0.0')
      })

      it('outputs a message to the user', async () => {
        const outputMock = outputMocker.mockAndCaptureOutput()

        await checkHydrogenVersion('dir')

        expect(outputMock.info()).toMatchInlineSnapshot(`
          "╭─ info ───────────────────────────────────────────────────────────────────────╮
          │                                                                              │
          │  Upgrade available                                                           │
          │                                                                              │
          │  Version 2.0.0 of @shopify/hydrogen is now available.                        │
          │                                                                              │
          │  You are currently running v1.0.0.                                           │
          │                                                                              │
          │  Reference                                                                   │
          │    • Hydrogen releases ( https://github.com/Shopify/hydrogen/releases )      │
          │                                                                              │
          ╰──────────────────────────────────────────────────────────────────────────────╯
          "
        `)
      })
    })
  })

  describe('when no current version can be found', () => {
    it('returns undefined and does not call checkForNewVersion', async () => {
      vi.mocked(captureOutput).mockResolvedValue('')

      expect(await checkHydrogenVersion('dir')).toBe(undefined)

      expect(checkForNewVersion).not.toHaveBeenCalled()
    })
  })
})
