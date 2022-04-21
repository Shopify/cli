import {load} from './app'
import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import {file, path} from '@shopify/cli-kit'
import {configurationFileNames, blocks, genericConfigurationFileNames} from '$cli/constants'

describe('load', () => {
  type BlockType = 'extensions' | 'scripts'

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
    const appDirectory = path.join(tmpDir, configurationFileNames.app)
    const homeDirectory = path.join(tmpDir, blocks.home.directoryName)
    const homeConfiguration = `
    [commands]
    build = "build"
    dev = "dev"
    `
    await file.write(appDirectory, appConfiguration)
    await file.mkdir(homeDirectory)
    await file.write(path.join(homeDirectory, blocks.home.configurationName), homeConfiguration)
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

    // When/Then
    await expect(load(tmpDir)).rejects.toThrow()
  })

  it('loads the app when the configuration is valid and has no blocks', async () => {
    // Given
    await writeConfig(appConfiguration)

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.configuration.name).toBe('my_app')
  })

  it('defaults to npm as package manager when the configuration is valid', async () => {
    // Given
    await writeConfig(appConfiguration)

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.packageManager).toBe('npm')
  })

  it('defaults to yarn st the package manager when yarn.lock is present, the configuration is valid, and has no blocks', async () => {
    // Given
    await writeConfig(appConfiguration)
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
    const pnpmLockPath = path.join(tmpDir, genericConfigurationFileNames.pnpm.lockfile)
    await file.write(pnpmLockPath, '')

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.packageManager).toBe('pnpm')
  })

  it("throws an error if the extension configuration file doesn't exist", async () => {
    // Given
    makeBlockDir({blockType: 'extensions', name: 'my-extension'})

    // When
    await expect(load(tmpDir)).rejects.toThrow(/Couldn't find the configuration file/)
  })

  it('throws an error if the extension configuration file is invalid', async () => {
    // Given
    const blockConfiguration = `
      wrong = "my_extension"
      `
    await writeBlockConfig({
      blockType: 'extensions',
      blockConfiguration,
      name: 'my-extension',
    })

    // When
    await expect(load(tmpDir)).rejects.toThrow()
  })

  it('loads the app when it has a extension with a valid configuration', async () => {
    // Given
    await writeConfig(appConfiguration)
    const blockConfiguration = `
      name = "my_extension"
      type = "checkout_post_purchase"
      `
    await writeBlockConfig({
      blockType: 'extensions',
      blockConfiguration,
      name: 'my-extension',
    })

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.extensions[0].configuration.name).toBe('my_extension')
  })

  it('loads the app from a extension directory when it has a extension with a valid configuration', async () => {
    // Given
    await writeConfig(appConfiguration)
    const blockConfiguration = `
      name = "my_extension"
      type = "checkout_post_purchase"
      `
    const {blockDir} = await writeBlockConfig({
      blockType: 'extensions',
      blockConfiguration,
      name: 'my-extension',
    })

    // When
    const app = await load(blockDir)

    // Then
    expect(app.configuration.name).toBe('my_app')
    expect(app.extensions[0].configuration.name).toBe('my_extension')
  })

  it('loads the app with several extensions that have valid configurations', async () => {
    // Given
    await writeConfig(appConfiguration)

    let blockConfiguration = `
      name = "my_extension_1"
      type = "checkout_post_purchase"
      `
    await writeBlockConfig({
      blockType: 'extensions',
      blockConfiguration,
      name: 'my_extension_1',
    })

    blockConfiguration = `
      name = "my_extension_2"
      type = "product_subscription"
      `
    await writeBlockConfig({
      blockType: 'extensions',
      blockConfiguration,
      name: 'my_extension_2',
    })

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.extensions).toHaveLength(2)
    expect(app.extensions[0].configuration.name).toBe('my_extension_1')
    expect(app.extensions[1].configuration.name).toBe('my_extension_2')
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

  it('loads the app when it has a script with a valid configuration', async () => {
    // Given
    await writeConfig(appConfiguration)

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
