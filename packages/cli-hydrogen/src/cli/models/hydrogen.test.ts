import {load} from './hydrogen.js'
import {genericConfigurationFileNames} from '../constants.js'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import {loadConfig} from '../utilities/load-config.js'
import {describe, vi, it, expect} from 'vitest'
import {pnpmLockfile, yarnLockfile} from '@shopify/cli-kit/node/node-package-manager'
import {inTemporaryDirectory, rmdir, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath, extname} from '@shopify/cli-kit/node/path'

/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore
import type {HydrogenConfig} from '@shopify/hydrogen/config'
/* eslint-enable @typescript-eslint/ban-ts-comment */

vi.mock('../utilities/load-config.js')

interface PackageJSONContents {
  name?: string
  dependencies?: {[key: string]: string}
  devDependencies?: {[key: string]: string}
}

describe('load', () => {
  /* eslint-disable no-console */
  // Suppress vite warning about auto-determine entry points
  console.warn = () => {}
  /* eslint-enable no-console */
  const createHydrogenProject = async (
    directory: string,
    configFileName = 'hydrogen.config.js',
    appConfiguration: HydrogenConfig = {},
    packageJSON: PackageJSONContents = {},
  ) => {
    const packageJsonPath = joinPath(directory, 'package.json')
    await writeFile(
      packageJsonPath,
      JSON.stringify({name: 'hydrogen-app', dependencies: {}, devDependencies: {}, ...packageJSON}, null, 2),
    )

    if (appConfiguration) {
      const appConfigurationPath = joinPath(directory, configFileName)
      let configContent = JSON.stringify(appConfiguration, null, 2)

      vi.mocked(loadConfig).mockResolvedValue({
        configuration: appConfiguration,
        configurationPath: appConfigurationPath,
      })

      switch (extname(configFileName)) {
        case '.json':
          configContent = JSON.stringify(appConfiguration, null, 2)
          break
        case '.ts':
        case '.js':
          configContent = `export default ${configContent}`
          break
      }

      await writeFile(appConfigurationPath, configContent)
    }
  }

  it("throws an error if the directory doesn't exist", async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await rmdir(tmpDir, {force: true})

      // When/Then
      await expect(load(tmpDir)).rejects.toThrow(/Couldn't find directory/)
    })
  })

  it("throws an error if the configuration file doesn't exist", async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // When/Then
      await expect(load(tmpDir)).rejects.toThrow(/Couldn't find hydrogen configuration file/)
    })
  })

  it('defaults to npm as package manager when the configuration is valid', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await createHydrogenProject(tmpDir)

      // When
      const app = await load(tmpDir)

      // When/Then
      expect(app.packageManager).toBe('npm')
    })
  })

  it('defaults to yarn as the package manager when yarn.lock is present, the configuration is valid, and has no blocks', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await createHydrogenProject(tmpDir)
      const yarnLockPath = joinPath(tmpDir, yarnLockfile)
      await writeFile(yarnLockPath, '')

      // When
      const app = await load(tmpDir)

      // Then
      expect(app.packageManager).toBe('yarn')
    })
  })

  it('defaults to pnpm as the package manager when pnpm lockfile is present, the configuration is valid, and has no blocks', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await createHydrogenProject(tmpDir)
      const pnpmLockPath = joinPath(tmpDir, pnpmLockfile)
      await writeFile(pnpmLockPath, '')

      // When
      const app = await load(tmpDir)

      // Then
      expect(app.packageManager).toBe('pnpm')
    })
  })

  it('parses the hydrogen.config when it is a JSON file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const config = {
        shopify: {
          storeDomain: 'hydrogen-preview.myshopify.com',
          storefrontToken: '3b580e70970c4528da70c98e097c2fa0',
          storefrontApiVersion: '2022-07',
        },
      }

      // Given
      await createHydrogenProject(tmpDir, 'hydrogen.config.json', config)

      // When
      const app = await load(tmpDir)

      // Then
      expect(app.configuration).toEqual(config)
    })
  })

  it('parses the hydrogen.config when it is a JS file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const config = {
        shopify: {
          storeDomain: 'hydrogen-preview.myshopify.com',
          storefrontToken: '3b580e70970c4528da70c98e097c2fa0',
          storefrontApiVersion: '2022-07',
        },
      }

      // Given
      await createHydrogenProject(tmpDir, 'hydrogen.config.js', config)

      // When
      const app = await load(tmpDir)

      // Then
      expect(app.configuration).toEqual(config)
    })
  })

  it('sets the language as javascript by default', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await createHydrogenProject(tmpDir)

      // When
      const app = await load(tmpDir)

      // Then
      expect(app.language).toEqual('JavaScript')
    })
  })

  it('detects typescript projects', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await createHydrogenProject(
        tmpDir,
        'hydrogen.config.ts',
        {},
        {
          devDependencies: {
            typescript: '*',
          },
        },
      )
      const tsconfigPath = joinPath(tmpDir, genericConfigurationFileNames.typescript.config)
      await writeFile(tsconfigPath, '')

      // When
      const app = await load(tmpDir)

      // Then
      expect(app.language).toEqual('TypeScript')
    })
  })
})
