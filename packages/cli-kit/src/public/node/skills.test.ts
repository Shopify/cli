import {
  promptShopifySkillInstallIfNeeded,
  shopifySkillIsInstalled,
  updateShopifySkill,
  updateShopifySkillInBackground,
} from './skills.js'
import {inTemporaryDirectory, mkdir, readFile, writeFile} from './fs.js'
import {fetch, Response} from './http.js'
import {joinPath} from './path.js'
import {exec, terminalSupportsPrompting} from './system.js'
import {renderSelectPrompt} from './ui.js'
import {LocalStorage} from './local-storage.js'
import {ConfSchema} from '../../private/node/conf-store.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'

vi.mock('./system.js')
vi.mock('./ui.js')
vi.mock('./http.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./http.js')>()
  return {...original, fetch: vi.fn()}
})

async function writeInstalledSkill(homeDir: string, content: string): Promise<string> {
  const skillDir = joinPath(homeDir, '.agents', 'skills', 'shopify')
  await mkdir(skillDir)
  const skillPath = joinPath(skillDir, 'SKILL.md')
  await writeFile(skillPath, content)
  return skillPath
}

const argv = ['/path/to/node', '/path/to/shopify', 'theme', 'list']
const env = {SHOPIFY_UNIT_TEST: 'false'}

beforeEach(() => {
  vi.mocked(terminalSupportsPrompting).mockReturnValue(true)
})

describe('shopifySkillIsInstalled', () => {
  test('returns false when the skill is not installed', async () => {
    await inTemporaryDirectory(async (homeDir) => {
      expect(shopifySkillIsInstalled(env, homeDir)).toBe(false)
    })
  })

  test('returns true when the skill is installed in the home agents directory', async () => {
    await inTemporaryDirectory(async (homeDir) => {
      await writeInstalledSkill(homeDir, '# Shopify skill')

      expect(shopifySkillIsInstalled(env, homeDir)).toBe(true)
    })
  })

  test('returns true when the skill is installed in the XDG config directory', async () => {
    await inTemporaryDirectory(async (homeDir) => {
      const xdgConfigHome = joinPath(homeDir, 'xdg-config')
      const skillDir = joinPath(xdgConfigHome, 'agents', 'skills', 'shopify')
      await mkdir(skillDir)
      await writeFile(joinPath(skillDir, 'SKILL.md'), '# Shopify skill')

      expect(shopifySkillIsInstalled({...env, XDG_CONFIG_HOME: xdgConfigHome}, homeDir)).toBe(true)
    })
  })
})

describe('updateShopifySkill', () => {
  test('returns not-installed without fetching when the skill is missing', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // When
      const result = await updateShopifySkill({env, homeDir: cwd})

      // Then
      expect(result).toBe('not-installed')
      expect(fetch).not.toHaveBeenCalled()
    })
  })

  test('writes the remote content over the installed skill when the source changed', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const skillPath = await writeInstalledSkill(cwd, '# Old skill')
      vi.mocked(fetch).mockResolvedValue(new Response('# New skill', {status: 200}))

      // When
      const result = await updateShopifySkill({env, homeDir: cwd})

      // Then
      expect(result).toBe('updated')
      await expect(readFile(skillPath)).resolves.toBe('# New skill')
    })
  })

  test('returns already-up-to-date and leaves the skill untouched when the content matches', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const skillPath = await writeInstalledSkill(cwd, '# Same skill')
      vi.mocked(fetch).mockResolvedValue(new Response('# Same skill', {status: 200}))

      // When
      const result = await updateShopifySkill({env, homeDir: cwd})

      // Then
      expect(result).toBe('already-up-to-date')
      await expect(readFile(skillPath)).resolves.toBe('# Same skill')
    })
  })

  test('throws when the source responds with an error', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      await writeInstalledSkill(cwd, '# Local skill')
      vi.mocked(fetch).mockResolvedValue(new Response(null, {status: 500, statusText: 'Internal Server Error'}))

      // When / Then
      await expect(updateShopifySkill({env, homeDir: cwd})).rejects.toThrow('Failed to check for Shopify skill updates')
    })
  })
})

describe('promptShopifySkillInstallIfNeeded', () => {
  test('spawns a background skill install when the user accepts', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})
      vi.mocked(renderSelectPrompt).mockResolvedValue('install')

      // When
      await promptShopifySkillInstallIfNeeded({currentCommand: 'theme:list', argv, env, config, homeDir: cwd})

      // Then
      expect(exec).toHaveBeenCalledWith(
        '/path/to/node',
        ['/path/to/shopify', 'skill', 'install'],
        expect.objectContaining({background: true}),
      )
      expect(config.get('skillInstallPromptDismissed')).toBeUndefined()
    })
  })

  test('re-prompts no earlier than a day later when the user asks for tomorrow', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})
      vi.mocked(renderSelectPrompt).mockResolvedValue('later')

      // When
      await promptShopifySkillInstallIfNeeded({currentCommand: 'theme:list', argv, env, config, homeDir: cwd})
      await promptShopifySkillInstallIfNeeded({currentCommand: 'theme:list', argv, env, config, homeDir: cwd})

      // Then
      expect(renderSelectPrompt).toHaveBeenCalledTimes(1)
      expect(exec).not.toHaveBeenCalled()
      expect(config.get('skillInstallPromptDismissed')).toBeUndefined()
    })
  })

  test('never prompts again when the user opts out', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})
      vi.mocked(renderSelectPrompt).mockResolvedValue('never')

      // When
      await promptShopifySkillInstallIfNeeded({currentCommand: 'theme:list', argv, env, config, homeDir: cwd})

      // Then
      expect(exec).not.toHaveBeenCalled()
      expect(config.get('skillInstallPromptDismissed')).toBe(true)
    })
  })

  test('dismisses the prompt without asking when the skill is already installed', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})
      await writeInstalledSkill(cwd, '# Shopify skill')

      // When
      await promptShopifySkillInstallIfNeeded({currentCommand: 'theme:list', argv, env, config, homeDir: cwd})

      // Then
      expect(renderSelectPrompt).not.toHaveBeenCalled()
      expect(config.get('skillInstallPromptDismissed')).toBe(true)
    })
  })

  test('does nothing once the prompt was previously dismissed', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given a dismissed prompt whose skill directory was later removed by the user
      const config = new LocalStorage<ConfSchema>({cwd})
      config.set('skillInstallPromptDismissed', true)

      // When
      await promptShopifySkillInstallIfNeeded({currentCommand: 'theme:list', argv, env, config, homeDir: cwd})

      // Then
      expect(renderSelectPrompt).not.toHaveBeenCalled()
    })
  })

  test('does nothing for skill commands', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})

      // When
      await promptShopifySkillInstallIfNeeded({currentCommand: 'skill:install', argv, env, config, homeDir: cwd})

      // Then
      expect(renderSelectPrompt).not.toHaveBeenCalled()
    })
  })

  test('does nothing when the command outputs JSON', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})

      // When
      await promptShopifySkillInstallIfNeeded({
        currentCommand: 'theme:list',
        args: ['--json'],
        argv,
        env,
        config,
        homeDir: cwd,
      })

      // Then
      expect(renderSelectPrompt).not.toHaveBeenCalled()
    })
  })

  test('does nothing when the terminal does not support prompting', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})
      vi.mocked(terminalSupportsPrompting).mockReturnValue(false)

      // When
      await promptShopifySkillInstallIfNeeded({currentCommand: 'theme:list', argv, env, config, homeDir: cwd})

      // Then
      expect(renderSelectPrompt).not.toHaveBeenCalled()
    })
  })

  test.each([
    ['CI', {...env, CI: '1'}],
    ['SHOPIFY_UNIT_TEST', {SHOPIFY_UNIT_TEST: 'true'}],
    ['SHOPIFY_CLI_NO_SKILL_INSTALL_PROMPT', {...env, SHOPIFY_CLI_NO_SKILL_INSTALL_PROMPT: '1'}],
    ['SHOPIFY_FLAG_JSON', {...env, SHOPIFY_FLAG_JSON: '1'}],
    ['SHOPIFY_CLI_ENV=development', {...env, SHOPIFY_CLI_ENV: 'development'}],
  ])('does nothing when %s is set', async (_name, skipEnv) => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})

      // When
      await promptShopifySkillInstallIfNeeded({
        currentCommand: 'theme:list',
        argv,
        env: skipEnv,
        config,
        homeDir: cwd,
      })

      // Then
      expect(renderSelectPrompt).not.toHaveBeenCalled()
    })
  })
})

describe('updateShopifySkillInBackground', () => {
  test('spawns a background skill update when the skill is installed', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})
      await writeInstalledSkill(cwd, '# Shopify skill')

      // When
      await updateShopifySkillInBackground({currentCommand: 'theme:list', argv, env, config, homeDir: cwd})

      // Then
      expect(exec).toHaveBeenCalledWith(
        '/path/to/node',
        ['/path/to/shopify', 'skill', 'update'],
        expect.objectContaining({background: true}),
      )
    })
  })

  test('spawns at most one update within the daily interval', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})
      await writeInstalledSkill(cwd, '# Shopify skill')

      // When
      await updateShopifySkillInBackground({currentCommand: 'theme:list', argv, env, config, homeDir: cwd})
      await updateShopifySkillInBackground({currentCommand: 'theme:list', argv, env, config, homeDir: cwd})

      // Then
      expect(exec).toHaveBeenCalledTimes(1)
    })
  })

  test('does nothing when the skill is not installed', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})

      // When
      await updateShopifySkillInBackground({currentCommand: 'theme:list', argv, env, config, homeDir: cwd})

      // Then
      expect(exec).not.toHaveBeenCalled()
    })
  })

  test('does nothing for skill commands', async () => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})
      await writeInstalledSkill(cwd, '# Shopify skill')

      // When
      await updateShopifySkillInBackground({currentCommand: 'skill:update', argv, env, config, homeDir: cwd})

      // Then
      expect(exec).not.toHaveBeenCalled()
    })
  })

  test.each([
    ['CI', {...env, CI: '1'}],
    ['SHOPIFY_UNIT_TEST', {SHOPIFY_UNIT_TEST: 'true'}],
    ['SHOPIFY_CLI_NO_SKILL_AUTO_UPDATE', {...env, SHOPIFY_CLI_NO_SKILL_AUTO_UPDATE: '1'}],
    ['SHOPIFY_CLI_ENV=development', {...env, SHOPIFY_CLI_ENV: 'development'}],
  ])('does nothing when %s is set', async (_name, skipEnv) => {
    await inTemporaryDirectory(async (cwd) => {
      // Given
      const config = new LocalStorage<ConfSchema>({cwd})
      await writeInstalledSkill(cwd, '# Shopify skill')

      // When
      await updateShopifySkillInBackground({currentCommand: 'theme:list', argv, env: skipEnv, config, homeDir: cwd})

      // Then
      expect(exec).not.toHaveBeenCalled()
    })
  })
})
