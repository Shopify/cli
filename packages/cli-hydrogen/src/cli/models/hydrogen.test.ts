import {load} from './hydrogen'
import {genericConfigurationFileNames} from '../constants'
import {HydrogenConfig} from '@shopify/hydrogen/config'
import {describe, it, expect} from 'vitest'
import {file, path} from '@shopify/cli-kit'
import {temporary} from '@shopify/cli-testing'

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
    // Given
    const directory = '/tmp/doesnt/exist'

    // When/Then
    await expect(load(directory)).rejects.toThrow(/Couldn't find directory/)
  })

  it("throws an error if the configuration file doesn't exist", async () => {
    await temporary.directory(async (tmpDir) => {
      // When/Then
      await expect(load(tmpDir)).rejects.toThrow(/Couldn't find the configuration file/)
    })
  })

  it('defaults to npm as package manager when the configuration is valid', async () => {
    await temporary.directory(async (tmpDir) => {
      // Given
      await createHydrogenProject(tmpDir)

      // When
      const app = await load(tmpDir)

      // When/Then
      expect(app.dependencyManager).toBe('npm')
    })
  })

  it('defaults to yarn as the package manager when yarn.lock is present, the configuration is valid, and has no blocks', async () => {
    await temporary.directory(async (tmpDir) => {
      // Given
      await createHydrogenProject(tmpDir)
      const yarnLockPath = path.join(tmpDir, genericConfigurationFileNames.yarn.lockfile)
      await file.write(yarnLockPath, '')

      // When
      const app = await load(tmpDir)

      // Then
      expect(app.dependencyManager).toBe('yarn')
    })
  })

  it('defaults to pnpm as the package manager when pnpm lockfile is present, the configuration is valid, and has no blocks', async () => {
    await temporary.directory(async (tmpDir) => {
      // Given
      await createHydrogenProject(tmpDir)
      const pnpmLockPath = path.join(tmpDir, genericConfigurationFileNames.pnpm.lockfile)
      await file.write(pnpmLockPath, '')

      // When
      const app = await load(tmpDir)

      // Then
      expect(app.dependencyManager).toBe('pnpm')
    })
  })

  it('parses the hydrogen.config when it is a JSON file', async () => {
    await temporary.directory(async (tmpDir) => {
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
    await temporary.directory(async (tmpDir) => {
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
    await temporary.directory(async (tmpDir) => {
      // Given
      await createHydrogenProject(tmpDir)

      // When
      const app = await load(tmpDir)

      // Then
      expect(app.language).toEqual('javascript')
    })
  })

  it('detects typescript projects', async () => {
    await temporary.directory(async (tmpDir) => {
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
      expect(app.language).toEqual('typescript')
    })
  })
})
