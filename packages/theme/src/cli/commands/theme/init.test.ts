import Init, {DEFAULT_THEME_REPO_URL, FRAMEWORK_THEME_REPO_URL} from './init.js'
import {cloneRepo, cloneRepoAndCheckoutLatestTag} from '../../services/init.js'
import {describe, expect, vi, test} from 'vitest'
import {Config} from '@oclif/core'

vi.mock('../../services/init.js')
vi.mock('@shopify/cli-kit/node/ui')

const CommandConfig = new Config({root: './'})

describe('Init', () => {
  const path = '.'

  async function run(argv: string[]) {
    await CommandConfig.load()
    const init = new Init([`--path=${path}`, ...argv], CommandConfig)
    return init.run()
  }

  describe('dev-preview flag', () => {
    test('uses framework theme when dev-preview flag is true and default clone-url is not provided', async () => {
      // Given
      const flags = ['--dev-preview']

      // When
      await run(flags)

      // Then
      expect(cloneRepo).toHaveBeenCalledWith(FRAMEWORK_THEME_REPO_URL, expect.any(String))
    })

    test('uses provided clone-url when custom url is provided, regardless of dev-preview flag', async () => {
      // Given
      const flags = ['--dev-preview', '--clone-url=https://github.com/org/theme.git']

      // When
      await run(flags)

      // Then
      expect(cloneRepo).toHaveBeenCalledWith('https://github.com/org/theme.git', expect.any(String))
    })
  })

  describe('latest flag', () => {
    test('uses cloneRepoAndCheckoutLatestTag when latest flag is true', async () => {
      // Given
      const flags = ['--latest']

      // When
      await run(flags)

      // Then
      expect(cloneRepoAndCheckoutLatestTag).toHaveBeenCalledWith(DEFAULT_THEME_REPO_URL, expect.any(String))
    })
  })
})
