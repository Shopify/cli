import {addESLint} from './eslint.js'
import {genericConfigurationFileNames} from '../constants.js'
import {HydrogenApp} from '../models/hydrogen.js'
import {describe, vi, it, expect} from 'vitest'
import {addNPMDependenciesWithoutVersionIfNeeded} from '@shopify/cli-kit/node/node-package-manager'
import {addRecommendedExtensions, isVSCode} from '@shopify/cli-kit/node/vscode'
import {inTemporaryDirectory, readFile, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

vi.mock('@shopify/cli-kit/node/node-package-manager', async () => {
  const actual: any = await vi.importActual('@shopify/cli-kit/node/node-package-manager')
  return {
    ...actual,
    writePackageJSON: vi.fn(),
    addNPMDependenciesWithoutVersionIfNeeded: vi.fn(),
  }
})
vi.mock('@shopify/cli-kit/node/vscode')

describe('addEslint', () => {
  const defaultOptions = {
    install: true,
    force: false,
  }

  it('adds a eslintrc file with recommended config if none exists', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const app = await createMockApp({
        directory: tmpDir,
      })

      // When
      await addESLint({app, ...defaultOptions})

      // Then
      await expect(readFile(joinPath(tmpDir, genericConfigurationFileNames.eslint))).resolves.toMatchInlineSnapshot(
        `
        "module.exports = {
          extends: ['plugin:hydrogen/recommended'],
        };
        "
      `,
      )
    })
  })

  it('adds a eslintrc file with typescript config for typescript projects', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const app = await createMockApp({
        directory: tmpDir,
        language: 'TypeScript',
      })

      // When
      await addESLint({app, ...defaultOptions})

      // Then
      await expect(readFile(joinPath(tmpDir, genericConfigurationFileNames.eslint))).resolves.toMatchInlineSnapshot(
        `
        "module.exports = {
          extends: ['plugin:hydrogen/recommended', 'plugin:hydrogen/typescript'],
        };
        "
      `,
      )
    })
  })

  it('adds eslint and prettier dependencies when install is true', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const app = await createMockApp({
        directory: tmpDir,
      })

      // When
      await addESLint({app, ...defaultOptions, install: true})

      // Then
      await expect(vi.mocked(addNPMDependenciesWithoutVersionIfNeeded)).toHaveBeenCalledWith(
        ['eslint', 'eslint-plugin-hydrogen', 'prettier', '@shopify/prettier-config'],
        expect.objectContaining({}),
      )
    })
  })

  it('does not add eslint and prettier dependencies when install is false', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const app = await createMockApp({
        directory: tmpDir,
      })

      // When
      await addESLint({app, ...defaultOptions, install: false})

      // Then
      await expect(vi.mocked(addNPMDependenciesWithoutVersionIfNeeded)).not.toHaveBeenCalled()
    })
  })

  it('adds vscode recommendations', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.mocked(isVSCode).mockResolvedValue(true)
      const app = await createMockApp({
        directory: tmpDir,
      })

      // When
      await addESLint({app, ...defaultOptions})

      // Then
      await expect(addRecommendedExtensions).toHaveBeenCalledWith(tmpDir, ['dbaeumer.vscode-eslint'])
    })
  })

  it('throws error when eslintrc already exists', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await writeFile(joinPath(tmpDir, genericConfigurationFileNames.eslint), '')
      const app = await createMockApp({
        directory: tmpDir,
      })

      // When/Then
      await expect(() => addESLint({app, ...defaultOptions})).rejects.toThrowError('ESLint config already exists.')
    })
  })
})

async function createMockApp(mockHydrogenApp: Partial<HydrogenApp> = {}) {
  const app = {
    name: 'snow-devil',
    configuration: {
      shopify: {
        ...mockHydrogenApp.configuration?.shopify,
      },
    },
    packageManager: 'npm',
    language: 'JavaScript',
    nodeDependencies: {
      ...mockHydrogenApp.configuration?.nodeDependencies,
    },
    directory: './some/path',
    ...mockHydrogenApp,
  } as const

  await writeFile(joinPath(app.directory, 'package.json'), JSON.stringify({scripts: {}}, null, 2))

  return app
}
