import {ensureDownloadedExtensionFlavorExists, ensureExtensionDirectoryExists, chooseExtension} from './common.js'
import {AppInterface} from '../../models/app/app.js'
import {ExtensionFlavor} from '../../models/app/template.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {describe, expect, test, vi} from 'vitest'
import {inTemporaryDirectory, mkdir} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {renderAutocompletePrompt} from '@shopify/cli-kit/node/ui'
import {isTerminalInteractive} from '@shopify/cli-kit/node/context/local'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/context/local')

describe('ensureDownloadedExtensionFlavorExists()', () => {
  test('it returns the full path if it exists', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const extensionFlavor: ExtensionFlavor = {name: 'Javascript', value: 'vanilla-js', path: 'template-path'}
      const fullTemplatePath = joinPath(tmpDir, extensionFlavor.path!)
      await mkdir(fullTemplatePath)

      // When
      const result = await ensureDownloadedExtensionFlavorExists(extensionFlavor, tmpDir)

      // Then
      expect(result).toBe(fullTemplatePath)
    })
  })

  test('it fails if the path does not exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const extensionFlavor: ExtensionFlavor = {name: 'Javascript', value: 'vanilla-js', path: 'wrong-path'}

      // When
      const result = ensureDownloadedExtensionFlavorExists(extensionFlavor, tmpDir)

      // Then
      await expect(result).rejects.toThrow('The extension is not available for vanilla-js')
    })
  })
})

describe('ensureExtensionDirectoryExists()', () => {
  test('it creates a directory when it does not exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const name = 'my extension'
      const app: AppInterface = {directory: tmpDir} as AppInterface

      // When
      const result = await ensureExtensionDirectoryExists({app, name})

      // Then
      const expectedPath = joinPath(tmpDir, 'extensions', 'my-extension')
      expect(result).toBe(expectedPath)
    })
  })

  test('it fails if the directory already exists', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const name = 'my extension'
      const app: AppInterface = {directory: tmpDir} as AppInterface
      const extensionPath = joinPath(tmpDir, 'extensions', 'my-extension')
      await mkdir(extensionPath)

      // When
      const result = ensureExtensionDirectoryExists({app, name})

      // Then
      await expect(result).rejects.toThrow('A directory with this name (my-extension) already exists.')
    })
  })
})

describe('chooseExtension()', () => {
  const createMockExtension = (overrides: Partial<ExtensionInstance> = {}): ExtensionInstance =>
    ({
      directory: '/app/extensions/test-ext',
      localIdentifier: 'test-extension',
      isAppConfigExtension: false,
      ...overrides,
    } as ExtensionInstance)

  const createMockAppConfigExtension = (overrides: Partial<ExtensionInstance> = {}): ExtensionInstance =>
    ({
      directory: '/app',
      localIdentifier: 'app_access',
      isAppConfigExtension: true,
      ...overrides,
    } as ExtensionInstance)

  test('filters out app config extensions and throws error when no user extensions found', async () => {
    // Given
    const appConfigExt = createMockAppConfigExtension()
    const extensions = [appConfigExt]

    // When/Then
    await expect(chooseExtension(extensions, '/app/extensions/test-ext')).rejects.toThrow(
      'No user extensions found in this app.',
    )
  })

  test('returns extension that matches the provided directory path', async () => {
    // Given
    const userExt = createMockExtension({directory: '/app/extensions/matching-ext'})
    const otherExt = createMockExtension({directory: '/app/extensions/other-ext'})
    const appConfigExt = createMockAppConfigExtension()
    const extensions = [userExt, otherExt, appConfigExt]

    // When
    const result = await chooseExtension(extensions, '/app/extensions/matching-ext')

    // Then
    expect(result).toBe(userExt)
  })

  test('returns single user extension when only one exists', async () => {
    // Given
    const userExt = createMockExtension()
    const appConfigExt = createMockAppConfigExtension()
    const extensions = [userExt, appConfigExt]

    // When
    const result = await chooseExtension(extensions, '/some/other/path')

    // Then
    expect(result).toBe(userExt)
  })

  test('prompts user to choose when multiple extensions exist and terminal is interactive', async () => {
    // Given
    const userExt1 = createMockExtension({localIdentifier: 'ext1'})
    const userExt2 = createMockExtension({localIdentifier: 'ext2', directory: '/app/extensions/ext2'})
    const appConfigExt = createMockAppConfigExtension()
    const extensions = [userExt1, userExt2, appConfigExt]

    vi.mocked(isTerminalInteractive).mockReturnValue(true)
    vi.mocked(renderAutocompletePrompt).mockResolvedValue(userExt2)

    // When
    const result = await chooseExtension(extensions, '/some/other/path')

    // Then
    expect(result).toBe(userExt2)
    expect(renderAutocompletePrompt).toHaveBeenCalledWith({
      message: 'Which extension?',
      choices: [
        {label: 'ext1', value: userExt1},
        {label: 'ext2', value: userExt2},
      ],
    })
  })

  test('throws error when multiple extensions exist but terminal is not interactive', async () => {
    // Given
    const userExt1 = createMockExtension({localIdentifier: 'ext1'})
    const userExt2 = createMockExtension({localIdentifier: 'ext2'})
    const extensions = [userExt1, userExt2]

    vi.mocked(isTerminalInteractive).mockReturnValue(false)

    // When/Then
    await expect(chooseExtension(extensions, '/some/other/path')).rejects.toThrow(
      'Run this command from an extension directory or use `--path` to specify an extension directory.',
    )
  })

  test('ignores app config extensions when matching directory path', async () => {
    // Given
    const userExt = createMockExtension({directory: '/app/extensions/user-ext'})
    const appConfigExt = createMockAppConfigExtension({directory: '/app'})
    const extensions = [userExt, appConfigExt]

    // When - try to match app directory path (should not match app_access)
    const result = await chooseExtension(extensions, '/app')

    // Then - should return the single user extension since app_access is filtered out
    expect(result).toBe(userExt)
  })
})
