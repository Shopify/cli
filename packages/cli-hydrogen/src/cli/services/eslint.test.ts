import {addESLint} from './eslint.js'
import {genericConfigurationFileNames} from '../constants.js'
import {HydrogenApp} from '../models/hydrogen.js'
import {describe, vi, it, expect} from 'vitest'
import {file, dependency, vscode, path} from '@shopify/cli-kit'

vi.mock('@shopify/cli-kit', async () => {
  const cliKit: any = await vi.importActual('@shopify/cli-kit')
  return {
    ...cliKit,
    dependency: {
      addNPMDependenciesWithoutVersionIfNeeded: vi.fn(),
    },
    vscode: {
      isVSCode: vi.fn(),
      addRecommendedExtensions: vi.fn(),
    },
  }
})

describe('addEslint', () => {
  const defaultOptions = {
    install: true,
    force: false,
  }

  it('adds a eslintrc file with recommended config if none exists', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const app = await createMockApp({
        directory: tmpDir,
      })

      // When
      await addESLint({app, ...defaultOptions})

      // Then
      await expect(file.read(path.join(tmpDir, genericConfigurationFileNames.eslint))).resolves.toMatchInlineSnapshot(
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
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const app = await createMockApp({
        directory: tmpDir,
        language: 'TypeScript',
      })

      // When
      await addESLint({app, ...defaultOptions})

      // Then
      await expect(file.read(path.join(tmpDir, genericConfigurationFileNames.eslint))).resolves.toMatchInlineSnapshot(
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
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const app = await createMockApp({
        directory: tmpDir,
      })

      // When
      await addESLint({app, ...defaultOptions, install: true})

      // Then
      await expect(dependency.addNPMDependenciesWithoutVersionIfNeeded).toHaveBeenCalledWith(
        ['eslint', 'eslint-plugin-hydrogen', 'prettier', '@shopify/prettier-config'],
        expect.objectContaining({}),
      )
    })
  })

  it('does not add eslint and prettier dependencies when install is false', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      const app = await createMockApp({
        directory: tmpDir,
      })

      // When
      await addESLint({app, ...defaultOptions, install: false})

      // Then
      await expect(dependency.addNPMDependenciesWithoutVersionIfNeeded).not.toHaveBeenCalled()
    })
  })

  it('adds vscode recommendations', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      vi.mocked(vscode.isVSCode).mockResolvedValue(true)
      const app = await createMockApp({
        directory: tmpDir,
      })

      // When
      await addESLint({app, ...defaultOptions})

      // Then
      await expect(vscode.addRecommendedExtensions).toHaveBeenCalledWith(tmpDir, ['dbaeumer.vscode-eslint'])
    })
  })

  it('throws error when eslintrc already exists', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      await file.write(path.join(tmpDir, genericConfigurationFileNames.eslint), '')
      const app = await createMockApp({
        directory: tmpDir,
      })

      // When/Then
      await expect(addESLint({app, ...defaultOptions})).rejects.toThrowError('ESLint config already exists.')
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
    dependencyManager: 'npm',
    language: 'JavaScript',
    nodeDependencies: {
      ...mockHydrogenApp.configuration?.nodeDependencies,
    },
    directory: './some/path',
    ...mockHydrogenApp,
  } as const

  await file.write(path.join(app.directory, 'package.json'), JSON.stringify({scripts: {}}, null, 2))

  return app
}
