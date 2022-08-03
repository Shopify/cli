import {load} from './hydrogen.js'
import {genericConfigurationFileNames} from '../constants.js'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import {loadConfig} from '../utilities/load-config.js'
import {describe, vi, it, expect} from 'vitest'
import {file, path} from '@shopify/cli-kit'
import {pnpmLockfile, yarnLockfile} from '@shopify/cli-kit/node/node-package-manager'

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
    const packageJsonPath = path.join(directory, 'package.json')
    await file.write(
      packageJsonPath,
      JSON.stringify({name: 'hydrogen-app', dependencies: {}, devDependencies: {}, ...packageJSON}, null, 2),
    )

    if (appConfiguration) {
      const appConfigurationPath = path.join(directory, configFileName)
      let configContent = JSON.stringify(appConfiguration, null, 2)

      vi.mocked(loadConfig).mockResolvedValue({
        configuration: appConfiguration,
        configurationPath: appConfigurationPath,
      })

      switch (path.extname(configFileName)) {
        case '.json':
          configContent = JSON.stringify(appConfiguration, null, 2)
          break
        case '.ts':
        case '.js':
          configContent = `export default ${configContent}`
          break
      }

      await file.write(appConfigurationPath, configContent)
    }
  }

  it("throws an error if the directory doesn't exist", async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      await file.rmdir(tmpDir, {force: true})

      // When/Then
      await expect(load(tmpDir)).rejects.toThrow(/Couldn't find directory/)
    })
  })

  it("throws an error if the configuration file doesn't exist", async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // When/Then
      await expect(load(tmpDir)).rejects.toThrow(/Couldn't find hydrogen configuration file/)
    })
  })

  it('defaults to npm as package manager when the configuration is valid', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      await createHydrogenProject(tmpDir)

      // When
      const app = await load(tmpDir)

      // When/Then
      expect(app.packageManager).toBe('npm')
    })
  })

  it('defaults to yarn as the package manager when yarn.lock is present, the configuration is valid, and has no blocks', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      await createHydrogenProject(tmpDir)
      const yarnLockPath = path.join(tmpDir, yarnLockfile)
      await file.write(yarnLockPath, '')

      // When
      const app = await load(tmpDir)

      // Then
      expect(app.packageManager).toBe('yarn')
    })
  })

  it('defaults to pnpm as the package manager when pnpm lockfile is present, the configuration is valid, and has no blocks', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      await createHydrogenProject(tmpDir)
      const pnpmLockPath = path.join(tmpDir, pnpmLockfile)
      await file.write(pnpmLockPath, '')

      // When
      const app = await load(tmpDir)

      // Then
      expect(app.packageManager).toBe('pnpm')
    })
  })

  it('parses the hydrogen.config when it is a JSON file', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
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
    await file.inTemporaryDirectory(async (tmpDir) => {
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
    await file.inTemporaryDirectory(async (tmpDir) => {
      // Given
      await createHydrogenProject(tmpDir)

      // When
      const app = await load(tmpDir)

      // Then
      expect(app.language).toEqual('JavaScript')
    })
  })

  it('detects typescript projects', async () => {
    await file.inTemporaryDirectory(async (tmpDir) => {
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
      const tsconfigPath = path.join(tmpDir, genericConfigurationFileNames.typescript.config)
      await file.write(tsconfigPath, '')

      // When
      const app = await load(tmpDir)

      // Then
      expect(app.language).toEqual('TypeScript')
    })
  })
})
