import {load, HomeNotFoundError} from './app'
import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import {file, path} from '@shopify/cli-kit'
import {configurationFileNames, blocks, genericConfigurationFileNames} from '$cli/constants'

describe('load', () => {
  type BlockType = 'uiExtensions' | 'scripts'

  let tmpDir: string
  const appConfiguration = `
  name = "my_app"
  `
  beforeEach(async () => {
    tmpDir = await file.mkTmpDir()
  })

  afterEach(async () => {
    if (tmpDir) {
      await file.rmdir(tmpDir)
    }
  })

  const writeConfig = async (appConfiguration: string) => {
    const appConfigurationPath = path.join(tmpDir, configurationFileNames.app)
    await file.write(appConfigurationPath, appConfiguration)
  }

  const mkdirHome = async () => {
    await file.mkdir(path.join(tmpDir, 'home'))
  }

  const blockConfigurationPath = ({blockType, name}: {blockType: BlockType; name: string}) => {
    const block = blocks[blockType]
    return path.join(tmpDir, block.directoryName, name, block.configurationName)
  }

  const makeBlockDir = async ({blockType, name}: {blockType: BlockType; name: string}) => {
    const dirname = path.dirname(blockConfigurationPath({blockType, name}))
    await file.mkdir(dirname)
    return dirname
  }

  const writeBlockConfig = async ({
    blockType,
    blockConfiguration,
    name,
  }: {
    blockType: BlockType
    blockConfiguration: string
    name: string
  }) => {
    const blockDir = await makeBlockDir({blockType, name})
    const configPath = blockConfigurationPath({blockType, name})
    await file.write(configPath, blockConfiguration)
    return {blockDir, configPath}
  }

  it("throws an error if the directory doesn't exist", async () => {
    // Given
    const directory = '/tmp/doesnt/exist'

    // When/Then
    await expect(load(directory)).rejects.toThrow(/Couldn't find directory/)
  })

  it("throws an error if the configuration file doesn't exist", async () => {
    // When/Then
    await expect(load(tmpDir)).rejects.toThrow(/Couldn't find the configuration file/)
  })

  it('throws an error when the configuration file is invalid', async () => {
    // Given
    const appConfiguration = `
        wrong = "my_app"
        `
    await writeConfig(appConfiguration)
    await mkdirHome()

    // When/Then
    await expect(load(tmpDir)).rejects.toThrow()
  })

  it('loads the app when the configuration is valid and has no blocks', async () => {
    // Given
    await writeConfig(appConfiguration)
    await mkdirHome()

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.configuration.name).toBe('my_app')
  })

  it('defaults to npm as package manager when the configuration is valid', async () => {
    // Given
    await writeConfig(appConfiguration)
    await mkdirHome()

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.packageManager).toBe('npm')
  })

  it('defaults to yarn st the package manager when yarn.lock is present, the configuration is valid, and has no blocks', async () => {
    // Given
    await writeConfig(appConfiguration)
    await mkdirHome()
    const yarnLockPath = path.join(tmpDir, genericConfigurationFileNames.yarn.lockfile)
    await file.write(yarnLockPath, '')

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.packageManager).toBe('yarn')
  })

  it('defaults to pnpm st the package manager when pnpm lockfile is present, the configuration is valid, and has no blocks', async () => {
    // Given
    await writeConfig(appConfiguration)
    await mkdirHome()
    const pnpmLockPath = path.join(tmpDir, genericConfigurationFileNames.pnpm.lockfile)
    await file.write(pnpmLockPath, '')

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.packageManager).toBe('pnpm')
  })

  it("throws an error if the UI extension configuration file doesn't exist", async () => {
    // Given
    makeBlockDir({blockType: 'uiExtensions', name: 'my-extension'})

    // When
    await expect(load(tmpDir)).rejects.toThrow(/Couldn't find the configuration file/)
  })

  it('throws an error if the UI extension configuration file is invalid', async () => {
    // Given
    const blockConfiguration = `
      wrong = "my_extension"
      `
    await writeBlockConfig({
      blockType: 'uiExtensions',
      blockConfiguration,
      name: 'my-extension',
    })

    // When
    await expect(load(tmpDir)).rejects.toThrow()
  })

  it('loads the app when it has a UI extension with a valid configuration', async () => {
    // Given
    await writeConfig(appConfiguration)
    await mkdirHome()
    const blockConfiguration = `
      name = "my_extension"
      ui_extension_type = "checkout-post-purchase"
      `
    await writeBlockConfig({
      blockType: 'uiExtensions',
      blockConfiguration,
      name: 'my-extension',
    })

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.uiExtensions[0].configuration.name).toBe('my_extension')
  })

  it('loads the app from a UI extension directory when it has a UI extension with a valid configuration', async () => {
    // Given
    await writeConfig(appConfiguration)
    await mkdirHome()
    const blockConfiguration = `
      name = "my_extension"
      ui_extension_type = "checkout-post-purchase"
      `
    const {blockDir} = await writeBlockConfig({
      blockType: 'uiExtensions',
      blockConfiguration,
      name: 'my-extension',
    })

    // When
    const app = await load(blockDir)

    // Then
    expect(app.configuration.name).toBe('my_app')
    expect(app.uiExtensions[0].configuration.name).toBe('my_extension')
  })

  it('loads the app with several UI extensions that have valid configurations', async () => {
    // Given
    await writeConfig(appConfiguration)
    await mkdirHome()

    let blockConfiguration = `
      name = "my_extension_1"
      ui_extension_type = "checkout-post-purchase"
      `
    await writeBlockConfig({
      blockType: 'uiExtensions',
      blockConfiguration,
      name: 'my_extension_1',
    })

    blockConfiguration = `
      name = "my_extension_2"
      ui_extension_type = "product-subscription"
      `
    await writeBlockConfig({
      blockType: 'uiExtensions',
      blockConfiguration,
      name: 'my_extension_2',
    })

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.uiExtensions).toHaveLength(2)
    expect(app.uiExtensions[0].configuration.name).toBe('my_extension_1')
    expect(app.uiExtensions[1].configuration.name).toBe('my_extension_2')
  })

  it("throws an error if the configuration file doesn't exist", async () => {
    // Given
    makeBlockDir({blockType: 'scripts', name: 'my-script'})

    // When
    await expect(load(tmpDir)).rejects.toThrow(/Couldn't find the configuration file/)
  })

  it('throws an error if the script configuration file is invalid', async () => {
    // Given
    const blockConfiguration = `
      wrong = "my-script"
    `
    await writeBlockConfig({
      blockType: 'scripts',
      blockConfiguration,
      name: 'my-script',
    })

    // When
    await expect(load(tmpDir)).rejects.toThrowError()
  })

  it('throws an error if the home directory is missing', async () => {
    // Given
    await writeConfig(appConfiguration)

    // When
    await expect(load(tmpDir)).rejects.toThrowError(HomeNotFoundError(path.resolve(tmpDir, 'home')))
  })

  it('loads the app when it has a script with a valid configuration', async () => {
    // Given
    await writeConfig(appConfiguration)
    await mkdirHome()

    const blockConfiguration = `
      name = "my-script"
      `
    await writeBlockConfig({
      blockType: 'scripts',
      blockConfiguration,
      name: 'my-script',
    })

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.scripts[0].configuration.name).toBe('my-script')
  })

  it('loads the app with several scripts that have valid configurations', async () => {
    // Given
    await writeConfig(appConfiguration)
    await mkdirHome()
    let blockConfiguration = `
      name = "my-script-1"
      `
    await writeBlockConfig({
      blockType: 'scripts',
      blockConfiguration,
      name: 'my-script-1',
    })

    blockConfiguration = `
      name = "my-script-2"
      `
    await writeBlockConfig({
      blockType: 'scripts',
      blockConfiguration,
      name: 'my-script-2',
    })

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.scripts).toHaveLength(2)
    expect(app.scripts[0].configuration.name).toBe('my-script-1')
    expect(app.scripts[1].configuration.name).toBe('my-script-2')
  })
})
