import {installShopifySkillInBackground, shopifySkillIsInstalled} from './skills.js'
import {inTemporaryDirectory, mkdir} from './fs.js'
import {joinPath} from './path.js'
import {exec} from './system.js'
import {LocalStorage} from './local-storage.js'
import {ConfSchema} from '../../private/node/conf-store.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('./system.js')

const argv = ['/path/to/node', '/path/to/shopify', 'theme', 'list']
const env = {SHOPIFY_UNIT_TEST: 'false'}

describe('shopifySkillIsInstalled', () => {
  test('returns false when the skill is not installed', async () => {
    await inTemporaryDirectory(async (homeDir) => {
      expect(shopifySkillIsInstalled(env, homeDir)).toBe(false)
    })
  })

  test('returns true when the skill is installed in the home agents directory', async () => {
    await inTemporaryDirectory(async (homeDir) => {
      await mkdir(joinPath(homeDir, '.agents', 'skills', 'shopify'))

      expect(shopifySkillIsInstalled(env, homeDir)).toBe(true)
    })
  })

  test('returns true when the skill is installed in the XDG config directory', async () => {
    await inTemporaryDirectory(async (homeDir) => {
      const xdgConfigHome = joinPath(homeDir, 'xdg-config')
      await mkdir(joinPath(xdgConfigHome, 'agents', 'skills', 'shopify'))

      expect(shopifySkillIsInstalled({...env, XDG_CONFIG_HOME: xdgConfigHome}, homeDir)).toBe(true)
    })
  })
})

describe('installShopifySkillInBackground', () => {
  test('spawns a background skill install when the skill is missing', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})

      // When
      await installShopifySkillInBackground({currentCommand: 'theme:list', argv, env, config, homeDir: cwd})

      // Then
      expect(exec).toHaveBeenCalledWith(
        '/path/to/node',
        ['/path/to/shopify', 'skill', 'install'],
        expect.objectContaining({background: true}),
      )
    })
  })

  test('spawns at most one install within the daily interval', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})

      // When
      await installShopifySkillInBackground({currentCommand: 'theme:list', argv, env, config, homeDir: cwd})
      await installShopifySkillInBackground({currentCommand: 'theme:list', argv, env, config, homeDir: cwd})

      // Then
      expect(exec).toHaveBeenCalledTimes(1)
    })
  })

  test('marks the install as completed and does nothing when the skill is already installed', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})
      await mkdir(joinPath(cwd, '.agents', 'skills', 'shopify'))

      // When
      await installShopifySkillInBackground({currentCommand: 'theme:list', argv, env, config, homeDir: cwd})

      // Then
      expect(exec).not.toHaveBeenCalled()
      expect(config.get('skillAutoInstallCompleted')).toBe(true)
    })
  })

  test('does nothing once the install was previously marked as completed', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given a completed install whose skill directory was later removed by the user
      const config = new LocalStorage<ConfSchema>({cwd})
      config.set('skillAutoInstallCompleted', true)

      // When
      await installShopifySkillInBackground({currentCommand: 'theme:list', argv, env, config, homeDir: cwd})

      // Then
      expect(exec).not.toHaveBeenCalled()
    })
  })

  test('does nothing for skill commands', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})

      // When
      await installShopifySkillInBackground({currentCommand: 'skill:install', argv, env, config, homeDir: cwd})

      // Then
      expect(exec).not.toHaveBeenCalled()
    })
  })

  test.each([
    ['CI', {...env, CI: '1'}],
    ['SHOPIFY_UNIT_TEST', {SHOPIFY_UNIT_TEST: 'true'}],
    ['SHOPIFY_CLI_NO_SKILL_AUTO_INSTALL', {...env, SHOPIFY_CLI_NO_SKILL_AUTO_INSTALL: '1'}],
    ['SHOPIFY_CLI_ENV=development', {...env, SHOPIFY_CLI_ENV: 'development'}],
  ])('does nothing when %s is set', async (_name, skipEnv) => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})

      // When
      await installShopifySkillInBackground({currentCommand: 'theme:list', argv, env: skipEnv, config, homeDir: cwd})

      // Then
      expect(exec).not.toHaveBeenCalled()
    })
  })
})
