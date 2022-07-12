import {load} from './loader.js'
import {configurationFileNames, blocks} from '../../constants.js'
import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import {file, path} from '@shopify/cli-kit'
import {yarnLockfile, pnpmLockfile} from '@shopify/cli-kit/node/node-package-manager'

describe('load', () => {
  type BlockType = 'ui' | 'function' | 'theme'

  let tmpDir: string
  const appConfiguration = `
scopes = "read_products"
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
    const packageJsonPath = path.join(tmpDir, 'package.json')
    const webDirectory = path.join(tmpDir, blocks.web.directoryName)
    const webConfiguration = `
    type = "backend"

    [commands]
    build = "build"
    dev = "dev"
    `
    await file.write(appConfigurationPath, appConfiguration)
    await file.write(packageJsonPath, JSON.stringify({name: 'my_app', dependencies: {}, devDependencies: {}}))
    await file.mkdir(webDirectory)
    await file.write(path.join(webDirectory, blocks.web.configurationName), webConfiguration)
  }

  const blockPath = (name: string) => {
    return path.join(tmpDir, blocks.extensions.directoryName, name)
  }

  const blockConfigurationPath = ({blockType, name}: {blockType: BlockType; name: string}) => {
    const configurationName = blocks.extensions.configurationName[blockType]
    return path.join(tmpDir, blocks.extensions.directoryName, name, configurationName)
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
    await file.inTemporaryDirectory(async (tmp) => {
      // Given
      await file.rmdir(tmp, {force: true})

      // When/Then
      await expect(load(tmp)).rejects.toThrow(`Couldn't find directory ${tmp}`)
    })
  })

  it("throws an error if the configuration file doesn't exist", async () => {
    // Given
    const currentDir = process.cwd()

    // When/Then
    await expect(load(currentDir)).rejects.toThrow(`Couldn't find the configuration file for ${currentDir}`)
  })

  it('throws an error when the configuration file is invalid', async () => {
    // Given
    const appConfiguration = `
        scopes = 1
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
    expect(app.name).toBe('my_app')
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
    const yarnLockPath = path.join(tmpDir, yarnLockfile)
    await file.write(yarnLockPath, '')

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.packageManager).toBe('yarn')
  })

  it('defaults to pnpm st the package manager when pnpm lockfile is present, the configuration is valid, and has no blocks', async () => {
    // Given
    await writeConfig(appConfiguration)
    const pnpmLockPath = path.join(tmpDir, pnpmLockfile)
    await file.write(pnpmLockPath, '')

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.packageManager).toBe('pnpm')
  })

  it("throws an error if the extension configuration file doesn't exist", async () => {
    // Given
    makeBlockDir({blockType: 'ui', name: 'my-extension'})

    // When
    await expect(load(tmpDir)).rejects.toThrow(/Couldn't find the configuration file/)
  })

  it('throws an error if the extension configuration file is invalid', async () => {
    // Given
    const blockConfiguration = `
      wrong = "my_extension"
      `
    await writeBlockConfig({
      blockType: 'ui',
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

      [build]
      command = "make build"
      path = "dist/index.wasm"
      `
    await writeBlockConfig({
      blockType: 'ui',
      blockConfiguration,
      name: 'my-extension',
    })
    await file.write(path.join(blockPath('my-extension'), 'index.js'), '')

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.extensions.ui[0].configuration.name).toBe('my_extension')
    expect(app.extensions.ui[0].idEnvironmentVariableName).toBe('SHOPIFY_MY_EXTENSION_ID')
    expect(app.extensions.ui[0].localIdentifier).toBe('my-extension')
  })

  it('loads the app from a extension directory when it has a extension with a valid configuration', async () => {
    // Given
    await writeConfig(appConfiguration)
    const blockConfiguration = `
      name = "my_extension"
      type = "checkout_post_purchase"
      `
    const {blockDir} = await writeBlockConfig({
      blockType: 'ui',
      blockConfiguration,
      name: 'my-extension',
    })
    await file.write(path.join(blockPath('my-extension'), 'index.js'), '')

    // When
    const app = await load(blockDir)

    // Then
    expect(app.name).toBe('my_app')
    expect(app.extensions.ui[0].configuration.name).toBe('my_extension')
    expect(app.extensions.ui[0].idEnvironmentVariableName).toBe('SHOPIFY_MY_EXTENSION_ID')
  })

  it('loads the app with several extensions that have valid configurations', async () => {
    // Given
    await writeConfig(appConfiguration)

    let blockConfiguration = `
      name = "my_extension_1"
      type = "checkout_post_purchase"
      `
    await writeBlockConfig({
      blockType: 'ui',
      blockConfiguration,
      name: 'my_extension_1',
    })
    await file.write(path.join(blockPath('my_extension_1'), 'index.js'), '')

    blockConfiguration = `
      name = "my_extension_2"
      type = "product_subscription"
      `
    await writeBlockConfig({
      blockType: 'ui',
      blockConfiguration,
      name: 'my_extension_2',
    })
    await file.write(path.join(blockPath('my_extension_2'), 'index.js'), '')

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.extensions.ui).toHaveLength(2)
    const extensions = app.extensions.ui.sort((extA, extB) =>
      extA.configuration.name < extB.configuration.name ? -1 : 1,
    )
    expect(extensions[0].configuration.name).toBe('my_extension_1')
    expect(extensions[0].idEnvironmentVariableName).toBe('SHOPIFY_MY_EXTENSION_1_ID')
    expect(extensions[1].configuration.name).toBe('my_extension_2')
    expect(extensions[1].idEnvironmentVariableName).toBe('SHOPIFY_MY_EXTENSION_2_ID')
  })

  it('loads the app supports extensions with the following sources paths: index.js, index.jsx, src/index.js, src/index.jsx', async () => {
    // Given
    await writeConfig(appConfiguration)
    await Promise.all(
      ['index.js', 'index.jsx', 'src/index.js', 'src/index.jsx'].map(async (sourcePath, index) => {
        const blockConfiguration = `
        name = "my_extension_${index}"
        type = "checkout_post_purchase"
        `
        await writeBlockConfig({
          blockType: 'ui',
          blockConfiguration,
          name: `my_extension_${index}`,
        })
        const sourceAbsolutePath = path.join(blockPath(`my_extension_${index}`), sourcePath)
        await file.mkdir(path.dirname(sourceAbsolutePath))
        await file.write(sourceAbsolutePath, '')
      }),
    )

    // When
    await expect(load(tmpDir)).resolves.not.toBeUndefined()
  })

  it(`throws an error if the extension doesn't have a source file`, async () => {
    // Given
    await writeConfig(appConfiguration)
    const blockConfiguration = `
      name = "my_extension"
      type = "checkout_post_purchase"
      `
    const {blockDir} = await writeBlockConfig({
      blockType: 'ui',
      blockConfiguration,
      name: 'my-extension',
    })

    // When
    await expect(load(blockDir)).rejects.toThrow(/Couldn't find an index.{js,jsx,ts,tsx} file in the directories/)
  })

  it("throws an error if the configuration file doesn't exist", async () => {
    // Given
    makeBlockDir({blockType: 'function', name: 'my-functions'})

    // When
    await expect(load(tmpDir)).rejects.toThrow(/Couldn't find the configuration file/)
  })

  it('throws an error if the function configuration file is invalid', async () => {
    // Given
    const blockConfiguration = `
      wrong = "my-function"
    `
    await writeBlockConfig({
      blockType: 'function',
      blockConfiguration,
      name: 'my-function',
    })

    // When
    await expect(load(tmpDir)).rejects.toThrowError()
  })

  it('loads the app when it has a function with a valid configuration', async () => {
    // Given
    await writeConfig(appConfiguration)

    const blockConfiguration = `
      name = "my-function"
      type = "payment_methods"
      apiVersion = "2022-07"

      [build]
      command = "make build"
      path = "dist/index.wasm"
      `
    await writeBlockConfig({
      blockType: 'function',
      blockConfiguration,
      name: 'my-function',
    })
    await file.write(path.join(blockPath('my-function'), 'metadata.json'), JSON.stringify({schemaVersions: {}}))

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.extensions.function[0].configuration.name).toBe('my-function')
    expect(app.extensions.function[0].idEnvironmentVariableName).toBe('SHOPIFY_MY_FUNCTION_ID')
    expect(app.extensions.function[0].localIdentifier).toBe('my-function')
  })

  it('loads the app with several functions that have valid configurations', async () => {
    // Given
    await writeConfig(appConfiguration)
    let blockConfiguration = `
      name = "my-function-1"
      type = "payment_methods"
      apiVersion = "2022-07"

      [build]
      command = "make build"
      path = "dist/index.wasm"
      `
    await writeBlockConfig({
      blockType: 'function',
      blockConfiguration,
      name: 'my-function-1',
    })

    blockConfiguration = `
      name = "my-function-2"
      type = "product_discounts"
      apiVersion = "2022-07"

      [build]
      command = "make build"
      path = "dist/index.wasm"
      `
    await writeBlockConfig({
      blockType: 'function',
      blockConfiguration,
      name: 'my-function-2',
    })
    await file.write(path.join(blockPath('my-function-1'), 'metadata.json'), JSON.stringify({schemaVersions: {}}))
    await file.write(path.join(blockPath('my-function-2'), 'metadata.json'), JSON.stringify({schemaVersions: {}}))

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.extensions.function).toHaveLength(2)
    const functions = app.extensions.function.sort((extA, extB) =>
      extA.configuration.name < extB.configuration.name ? -1 : 1,
    )
    expect(functions[0].configuration.name).toBe('my-function-1')
    expect(functions[1].configuration.name).toBe('my-function-2')
    expect(functions[0].idEnvironmentVariableName).toBe('SHOPIFY_MY_FUNCTION_1_ID')
    expect(functions[1].idEnvironmentVariableName).toBe('SHOPIFY_MY_FUNCTION_2_ID')
    expect(functions[0].localIdentifier).toBe('my-function-1')
    expect(functions[1].localIdentifier).toBe('my-function-2')
  })

  it(`throws an error when the function's metadata.json file is missing`, async () => {
    // Given
    await writeConfig(appConfiguration)

    const blockConfiguration = `
      name = "my-function"
      type = "payment_methods"
      apiVersion = "2022-07"

      [build]
      command = "make build"
      path = "target/wasm32-wasi/release/my-function.wasm"
      `
    await writeBlockConfig({
      blockType: 'function',
      blockConfiguration,
      name: 'my-function',
    })

    // When
    await expect(load(tmpDir)).rejects.toThrow(/Couldn't find the configuration file at .+metadata\.json/)
  })

  it(`uses a custom function wasm path if configured`, async () => {
    // Given
    await writeConfig(appConfiguration)
    const blockConfiguration = `
      name = "my-function"
      type = "payment_methods"
      apiVersion = "2022-07"

      [build]
      command = "make build"
      path = "target/wasm32-wasi/release/my-function.wasm"
      `
    await writeBlockConfig({
      blockType: 'function',
      blockConfiguration,
      name: 'my-function',
    })
    await file.write(path.join(blockPath('my-function'), 'metadata.json'), JSON.stringify({schemaVersions: {}}))

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.extensions.function[0].buildWasmPath()).toMatch(/wasm32-wasi\/release\/my-function.wasm/)
  })

  it(`defaults the function wasm path if not configured`, async () => {
    // Given
    await writeConfig(appConfiguration)
    const blockConfiguration = `
      name = "my-function"
      type = "payment_methods"
      apiVersion = "2022-07"

      [build]
      command = "make build"
      `
    await writeBlockConfig({
      blockType: 'function',
      blockConfiguration,
      name: 'my-function',
    })
    await file.write(path.join(blockPath('my-function'), 'metadata.json'), JSON.stringify({schemaVersions: {}}))

    // When
    const app = await load(tmpDir)

    // Then
    expect(app.extensions.function[0].buildWasmPath()).toMatch(/.+dist\/index.wasm$/)
  })
})

function createPackageJson(tmpDir: string, type: string, version: string) {
  const packagePath = path.join(tmpDir, 'node_modules', '@shopify', type, 'package.json')
  const packageJson = {name: 'name', version}
  const dirPath = path.join(tmpDir, 'node_modules', '@shopify', type)
  return file.mkdir(dirPath).then(() => file.write(packagePath, JSON.stringify(packageJson)))
}
