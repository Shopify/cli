import {bootstrapThemeAirlock, interactiveBootstrapUI} from './bootstrap.js'
import {ThemeAirlockError} from './types.js'
import {configurationFileName} from '../../constants.js'
import {describe, expect, test, vi} from 'vitest'
import {fileExists, inTemporaryDirectory, mkdir, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {renderSelectPrompt, renderTextPrompt} from '@shopify/cli-kit/node/ui'

vi.mock('@shopify/cli-kit/node/ui')

interface Session {
  token: string
}

async function createTheme(tmpDir: string): Promise<string> {
  const themePath = joinPath(tmpDir, 'theme')
  await mkdir(themePath)
  return themePath
}

async function captureError(operation: () => Promise<unknown>): Promise<ThemeAirlockError | Error> {
  try {
    await operation()
  } catch (error) {
    if (error instanceof Error) return error
    throw error
  }
  throw new Error('Expected operation to throw')
}

function optionsFor(themePath: string, overrides: Partial<Parameters<typeof bootstrapThemeAirlock<Session>>[0]> = {}) {
  return {
    themePath,
    confirmStore: async () => 'trust' as const,
    promptStore: async () => 'prompted-store',
    promptEnvironment: async () => 'prompted-environment',
    authenticate: async (_store: string) => ({token: 'session'}) satisfies Session,
    ...overrides,
  }
}

describe('interactiveBootstrapUI', () => {
  test('presents the untrusted store choices', async () => {
    vi.mocked(renderSelectPrompt).mockResolvedValue('trust')

    await interactiveBootstrapUI().confirmStore('example-store')

    expect(renderSelectPrompt).toHaveBeenCalledWith({
      message: 'The store example-store is untrusted. Choose how to continue.',
      choices: [
        {label: 'Trust example-store', value: 'trust'},
        {label: 'Choose a different store', value: 'choose'},
        {label: 'Cancel', value: 'cancel'},
      ],
    })
  })

  test.each([
    {
      name: 'store',
      prompt: 'promptStore' as const,
      message: 'Enter the Shopify store to trust',
    },
    {
      name: 'environment',
      prompt: 'promptEnvironment' as const,
      message: 'Enter a name for this theme environment',
    },
  ])('presents the $name prompt and returns trimmed non-empty input', async ({prompt, message}) => {
    const input = '  response  '
    vi.mocked(renderTextPrompt).mockResolvedValue(input)

    const result = await interactiveBootstrapUI()[prompt]()

    expect(renderTextPrompt).toHaveBeenCalledWith({message})
    expect(result).toBe('response')
  })

  test.each([
    {name: 'empty store', prompt: 'promptStore' as const, input: ''},
    {name: 'whitespace-only store', prompt: 'promptStore' as const, input: '   '},
    {name: 'empty environment', prompt: 'promptEnvironment' as const, input: ''},
    {name: 'whitespace-only environment', prompt: 'promptEnvironment' as const, input: '   '},
  ])('returns undefined for $name input', async ({prompt, input}) => {
    vi.mocked(renderTextPrompt).mockResolvedValue(input)

    await expect(interactiveBootstrapUI()[prompt]()).resolves.toBeUndefined()
  })
})

describe('bootstrapThemeAirlock', () => {
  test('uses an explicit candidate instead of an unrelated remembered store', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = await createTheme(tmpDir)
      const confirmed: string[] = []
      const remembered = async () => 'remembered-store'
      const result = await bootstrapThemeAirlock(
        optionsFor(themePath, {
          candidate: 'candidate-store',
          rememberedStore: 'remembered-store',
          confirmStore: async (store) => {
            confirmed.push(store)
            return 'trust'
          },
          promptStore: remembered,
        }),
      )

      expect(confirmed).toEqual(['candidate-store'])
      expect(result.target).toEqual({
        environment: 'prompted-environment',
        store: 'candidate-store.myshopify.com',
        source: 'bootstrap',
        implicit: false,
      })
    })
  })

  test('continues with a candidate when confirmation trusts it', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = await createTheme(tmpDir)
      const authenticatedStores: string[] = []

      await bootstrapThemeAirlock(
        optionsFor(themePath, {
          candidate: 'candidate-store',
          confirmStore: async (store) => {
            expect(store).toBe('candidate-store')
            return 'trust'
          },
          authenticate: async (store) => {
            authenticatedStores.push(store)
            return {token: 'trusted'}
          },
        }),
      )

      expect(authenticatedStores).toEqual(['candidate-store.myshopify.com'])
    })
  })

  test('chooses a new store after declining to trust a candidate', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = await createTheme(tmpDir)
      const result = await bootstrapThemeAirlock(
        optionsFor(themePath, {
          candidate: 'candidate-store',
          confirmStore: async () => 'choose',
          promptStore: async () => 'chosen-store',
        }),
      )

      expect(result.target.store).toBe('chosen-store.myshopify.com')
    })
  })

  test('presents a remembered store only when explicitly supplied', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = await createTheme(tmpDir)
      const confirmed: string[] = []
      await bootstrapThemeAirlock(
        optionsFor(themePath, {
          rememberedStore: 'remembered-store',
          confirmStore: async (store) => {
            confirmed.push(store)
            return 'trust'
          },
        }),
      )

      expect(confirmed).toEqual(['remembered-store'])
    })
  })

  test('prompts for a store when no candidate is supplied', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = await createTheme(tmpDir)
      const prompted: string[] = []
      const result = await bootstrapThemeAirlock(
        optionsFor(themePath, {
          promptStore: async () => {
            prompted.push('store')
            return 'prompted-store'
          },
        }),
      )

      expect(prompted).toEqual(['store'])
      expect(result.target.store).toBe('prompted-store.myshopify.com')
    })
  })

  test.each([
    {name: 'confirmation', overrides: {candidate: 'candidate-store', confirmStore: async () => 'cancel' as const}},
    {name: 'store prompt', overrides: {promptStore: async () => undefined}},
    {name: 'environment prompt', overrides: {promptEnvironment: async () => undefined}},
  ])('cancelling at the $name stage does not authenticate or write', async ({overrides}) => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = await createTheme(tmpDir)
      let authenticated = false
      const error = await captureError(() =>
        bootstrapThemeAirlock(
          optionsFor(themePath, {
            ...overrides,
            authenticate: async () => {
              authenticated = true
              return {token: 'never'}
            },
          }),
        ),
      )

      expect(error).toBeInstanceOf(ThemeAirlockError)
      expect((error as ThemeAirlockError).reason).toBe('bootstrap-cancelled')
      expect(authenticated).toBe(false)
      await expect(readFile(joinPath(themePath, configurationFileName))).rejects.toThrow()
    })
  })

  test('rejects an invalid selected store before authentication or writing', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = await createTheme(tmpDir)
      let authenticated = false
      const error = await captureError(() =>
        bootstrapThemeAirlock(
          optionsFor(themePath, {
            candidate: 'not a store',
            authenticate: async () => {
              authenticated = true
              return {token: 'never'}
            },
          }),
        ),
      )

      expect(error).toBeInstanceOf(ThemeAirlockError)
      expect((error as ThemeAirlockError).reason).toBe('invalid-store')
      expect(authenticated).toBe(false)
      await expect(readFile(joinPath(themePath, configurationFileName))).rejects.toThrow()
    })
  })

  test('authentication failure does not write configuration', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = await createTheme(tmpDir)

      await expect(
        bootstrapThemeAirlock(
          optionsFor(themePath, {
            authenticate: async () => {
              throw new Error('authentication failed')
            },
          }),
        ),
      ).rejects.toThrow('authentication failed')
      await expect(readFile(joinPath(themePath, configurationFileName))).rejects.toThrow()
    })
  })

  test('authenticates before writing and returns the same session', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = await createTheme(tmpDir)
      const session = {token: 'same-session'}
      let configurationDuringAuthentication: string | undefined
      const result = await bootstrapThemeAirlock(
        optionsFor(themePath, {
          authenticate: async () => {
            await expect(fileExists(joinPath(themePath, configurationFileName))).resolves.toBe(false)
            configurationDuringAuthentication = undefined
            return session
          },
        }),
      )

      expect(configurationDuringAuthentication).toBeUndefined()
      expect(result.session).toBe(session)
      expect(result.configurationPath).toBe(joinPath(themePath, configurationFileName))
      await expect(readFile(result.configurationPath)).resolves.toContain('[environments.prompted-environment]')
    })
  })

  test('preserves an existing configuration while authenticating', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = await createTheme(tmpDir)
      const configurationPath = joinPath(themePath, configurationFileName)
      const original = '[environments.default]\nstore = "existing-store"\n'
      await writeFile(configurationPath, original)

      await bootstrapThemeAirlock(
        optionsFor(themePath, {
          candidate: 'new-store',
          authenticate: async () => {
            await expect(readFile(configurationPath)).resolves.toBe(original)
            return {token: 'session'}
          },
          promptEnvironment: async () => 'preview',
        }),
      )

      await expect(readFile(configurationPath)).resolves.toContain('preview.store = "new-store.myshopify.com"')
    })
  })

  test('does not prompt for environment when a proposed environment is supplied', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = await createTheme(tmpDir)
      let promptedForStore = false
      let promptedForEnvironment = false
      const result = await bootstrapThemeAirlock(
        optionsFor(themePath, {
          proposedEnvironment: 'explicit-environment',
          promptStore: async () => {
            promptedForStore = true
            return 'explicit-store'
          },
          promptEnvironment: async () => {
            promptedForEnvironment = true
            return 'wrong-environment'
          },
        }),
      )

      expect(promptedForStore).toBe(true)
      expect(promptedForEnvironment).toBe(false)
      expect(result.target.environment).toBe('explicit-environment')
    })
  })

  test('propagates writer conflicts after authentication without changing configuration', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const themePath = await createTheme(tmpDir)
      const configurationPath = joinPath(themePath, configurationFileName)
      const original = '[environments.preview]\nstore = "existing-store"\n'
      await writeFile(configurationPath, original)
      let authenticated = false

      const error = await captureError(() =>
        bootstrapThemeAirlock(
          optionsFor(themePath, {
            candidate: 'new-store',
            proposedEnvironment: 'preview',
            authenticate: async () => {
              authenticated = true
              return {token: 'session'}
            },
          }),
        ),
      )

      expect(authenticated).toBe(true)
      expect(error).toBeInstanceOf(ThemeAirlockError)
      expect((error as ThemeAirlockError).reason).toBe('environment-conflict')
      await expect(readFile(configurationPath)).resolves.toBe(original)
    })
  })
})
