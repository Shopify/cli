import {includeDemoService} from './include-demo.js'
import {inTemporaryDirectory, writeFile, mkdir} from '@shopify/cli-kit/node/fs'
import {decodeToml} from '@shopify/cli-kit/node/toml'
import {joinPath, dirname} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'

const writeToml = async (tmpDir: string, path: string, tomlContent: string) => {
  const filePath = joinPath(tmpDir, path)
  await mkdir(dirname(filePath))
  await writeFile(filePath, tomlContent)
  return filePath
}

describe('includeDemoService', () => {
  test('decodes a simple TOML file correctly', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const tomlContent = `
        [example]
        key = "value"
      `
      const filePath = await writeToml(tmpDir, 'test.toml', tomlContent)

      // When
      const result = await includeDemoService(filePath)

      // Then
      expect(result).toEqual({
        path: filePath,
        root: dirname(filePath),
        example: {
          key: 'value',
        },
      })
    })
  })

  test("doesn't break arrays", async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const tomlContent = `
        [[example]]
        key = "value"

        [[example]]
        key = "value2"
      `
      const filePath = await writeToml(tmpDir, 'test.toml', tomlContent)

      // When
      const result = await includeDemoService(filePath)

      // Then
      expect(result).toEqual({
        path: filePath,
        root: dirname(filePath),
        example: [
          {
            key: 'value',
          },
          {
            key: 'value2',
          },
        ],
      })
    })
  })

  test('handles _include directive correctly', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const startTomlContent = `
        [example]
        _include = "./extra.toml"
      `
      const extraTomlContent = `
        hello = "world"
      `
      const startFilePath = await writeToml(tmpDir, 'start.toml', startTomlContent)
      const extraFilePath = await writeToml(tmpDir, 'extra.toml', extraTomlContent)

      // When
      const result = await includeDemoService(startFilePath)

      // Then
      expect(result).toEqual({
        path: startFilePath,
        root: dirname(startFilePath),
        example: {
          path: extraFilePath,
          root: dirname(extraFilePath),
          hello: 'world',
        },
      })
      expect(result).toEqual(
        decodeToml(`
        path = "${startFilePath}"
        root = "${dirname(startFilePath)}"

        [example]
        path = "${extraFilePath}"
        root = "${dirname(extraFilePath)}"
        hello = "world"
      `),
      )
    })
  })

  test('throws error on circular include', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const file1Content = `
        [example]
        _include = "./file2.toml"
      `
      const file2Content = `
        [nested]
        _include = "./file1.toml"
      `
      const file1Path = await writeToml(tmpDir, 'file1.toml', file1Content)
      const file2Path = await writeToml(tmpDir, 'file2.toml', file2Content)

      // When/Then
      await expect(includeDemoService(file1Path)).rejects.toThrow('Circular include detected')
    })
  })

  test('allows including the same file multiple times', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const mainContent = `
        _include = "./file1.toml, ./file2.toml"
      `
      const file1Content = `
        [section1]
        _include = "./common.toml"
        key1 = "value1"
      `
      const file2Content = `
        [section2]
        _include = "./common.toml"
        key2 = "value2"
      `
      const commonContent = `
        shared = "sharedValue"
      `

      const mainPath = await writeToml(tmpDir, 'main.toml', mainContent)
      const file1Path = await writeToml(tmpDir, 'file1.toml', file1Content)
      const file2Path = await writeToml(tmpDir, 'file2.toml', file2Content)
      const commonPath = await writeToml(tmpDir, 'common.toml', commonContent)

      // When
      const result = await includeDemoService(mainPath)

      // Then
      expect(result).toEqual({
        path: mainPath,
        root: dirname(mainPath),
        section1: {
          path: file1Path,
          root: dirname(file1Path),
          key1: 'value1',
          shared: 'sharedValue',
        },
        section2: {
          path: file2Path,
          root: dirname(file2Path),
          key2: 'value2',
          shared: 'sharedValue',
        },
      })
      expect(result).toEqual(
        decodeToml(`
        path = "${mainPath}"
        root = "${dirname(mainPath)}"

        [section1]
        path = "${file1Path}"
        root = "${dirname(file1Path)}"
        key1 = "value1"
        shared = "sharedValue"

        [section2]
        path = "${file2Path}"
        root = "${dirname(file2Path)}"
        key2 = "value2"
        shared = "sharedValue"
      `),
      )
    })
  })

  test('handles multiple _include files correctly', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const startTomlContent = `
        [example]
        _include = "./extra1.toml, ./extra2.toml"
      `
      const extra1TomlContent = `
        hello = "world"
      `
      const extra2TomlContent = `
        foo = "bar"
      `
      const startFilePath = await writeToml(tmpDir, 'start.toml', startTomlContent)
      const extra1FilePath = await writeToml(tmpDir, 'extra1.toml', extra1TomlContent)
      const extra2FilePath = await writeToml(tmpDir, 'extra2.toml', extra2TomlContent)

      // When
      const result = await includeDemoService(startFilePath)

      // Then
      expect(result).toEqual({
        path: startFilePath,
        root: dirname(startFilePath),
        example: {
          path: extra2FilePath,
          root: dirname(extra2FilePath),
          hello: 'world',
          foo: 'bar',
        },
      })
      expect(result).toEqual(
        decodeToml(`
        path = "${startFilePath}"
        root = "${dirname(startFilePath)}"

        [example]
        path = "${extra2FilePath}"
        root = "${dirname(extra2FilePath)}"
        hello = "world"
        foo = "bar"
      `),
      )
    })
  })

  test('handles glob _include correctly', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const startTomlContent = `
        [example]
        _include = "./subfolder/*.toml"
      `
      const extra1TomlContent = `
        hello = "world"
      `
      const extra2TomlContent = `
        foo = "bar"
      `

      const startFilePath = await writeToml(tmpDir, 'start.toml', startTomlContent)
      const extra1FilePath = await writeToml(tmpDir, 'subfolder/extra1.toml', extra1TomlContent)
      const extra2FilePath = await writeToml(tmpDir, 'subfolder/extra2.toml', extra2TomlContent)

      // When
      const result = await includeDemoService(startFilePath)

      // Then
      expect(result).toEqual({
        path: startFilePath,
        root: dirname(startFilePath),
        example: {
          path: extra2FilePath,
          root: dirname(extra2FilePath),
          hello: 'world',
          foo: 'bar',
        },
      })
      expect(result).toEqual(
        decodeToml(`
        path = "${startFilePath}"
        root = "${dirname(startFilePath)}"

        [example]
        path = "${extra2FilePath}"
        root = "${dirname(extra2FilePath)}"
        hello = "world"
        foo = "bar"
      `),
      )
    })
  })

  test('handles _include directive with correct priority', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const startTomlContent = `
        [example]
        _include = "./extra.toml"
        existing = "value"
      `
      const extraTomlContent = `
        hello = "world"
        existing = "new value"
      `
      const startFilePath = await writeToml(tmpDir, 'start.toml', startTomlContent)
      const extraFilePath = await writeToml(tmpDir, 'extra.toml', extraTomlContent)

      // When
      const result = await includeDemoService(startFilePath)

      // Then
      expect(result).toEqual({
        path: startFilePath,
        root: dirname(startFilePath),
        example: {
          path: extraFilePath,
          root: dirname(extraFilePath),
          hello: 'world',
          existing: 'new value',
        },
      })
      expect(result).toEqual(
        decodeToml(`
        path = "${startFilePath}"
        root = "${dirname(startFilePath)}"

        [example]
        path = "${extraFilePath}"
        root = "${dirname(extraFilePath)}"
        hello = "world"
        existing = "new value"
      `),
      )
    })
  })

  test('handles multiple _include files with correct priority', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const startTomlContent = `
        [example]
        _include = "./extra1.toml, ./extra2.toml"
        existing = "original"
      `
      const extra1TomlContent = `
        hello = "world"
        existing = "from extra1"
      `
      const extra2TomlContent = `
        foo = "bar"
        existing = "from extra2"
      `
      const startFilePath = await writeToml(tmpDir, 'start.toml', startTomlContent)
      const extra1FilePath = await writeToml(tmpDir, 'extra1.toml', extra1TomlContent)
      const extra2FilePath = await writeToml(tmpDir, 'extra2.toml', extra2TomlContent)

      // When
      const result = await includeDemoService(startFilePath)

      // Then
      expect(result).toEqual({
        path: startFilePath,
        root: dirname(startFilePath),
        example: {
          path: extra2FilePath,
          root: dirname(extra2FilePath),
          hello: 'world',
          foo: 'bar',
          existing: 'from extra2',
        },
      })
      expect(result).toEqual(
        decodeToml(`
        path = "${startFilePath}"
        root = "${dirname(startFilePath)}"

        [example]
        path = "${extra2FilePath}"
        root = "${dirname(extra2FilePath)}"
        hello = "world"
        foo = "bar"
        existing = "from extra2"
      `),
      )
    })
  })

  test('handles glob _include with multiple top-level tables and applies special rule', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const startTomlContent = `
        _include = "./configs/*.toml"
      `
      const config1Content = `
        [database]
        host = "localhost"
        port = 5432
      `
      const config2Content = `
        [api]
        endpoint = "https://api.example.com"
        version = "v1"
      `
      const config3Content = `
        [logging]
        level = "info"
        file = "/var/log/app.log"
      `

      const startFilePath = await writeToml(tmpDir, 'start.toml', startTomlContent)
      const config1Path = await writeToml(tmpDir, 'configs/config1.toml', config1Content)
      const config2Path = await writeToml(tmpDir, 'configs/config2.toml', config2Content)
      const config3Path = await writeToml(tmpDir, 'configs/config3.toml', config3Content)

      // When
      const result = await includeDemoService(startFilePath)

      // Then
      expect(result).toEqual({
        path: startFilePath,
        root: dirname(startFilePath),
        database: {
          path: config1Path,
          root: dirname(config1Path),
          host: 'localhost',
          port: 5432,
        },
        api: {
          path: config2Path,
          root: dirname(config2Path),
          endpoint: 'https://api.example.com',
          version: 'v1',
        },
        logging: {
          path: config3Path,
          root: dirname(config3Path),
          level: 'info',
          file: '/var/log/app.log',
        },
      })
      expect(result).toEqual(
        decodeToml(`
        path = "${startFilePath}"
        root = "${dirname(startFilePath)}"

        [database]
        path = "${config1Path}"
        root = "${dirname(config1Path)}"
        host = "localhost"
        port = 5432

        [api]
        path = "${config2Path}"
        root = "${dirname(config2Path)}"
        endpoint = "https://api.example.com"
        version = "v1"

        [logging]
        path = "${config3Path}"
        root = "${dirname(config3Path)}"
        level = "info"
        file = "/var/log/app.log"
      `),
      )
    })
  })

  test('handles glob _include with [[extensions]] entries', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const startTomlContent = `
        _include = "./extensions/*.toml"
      `
      const extension1Content = `
        [[extensions]]
        name = "Extension 1"
        type = "ui_extension"
      `
      const extension2Content = `
        [[extensions]]
        name = "Extension 2"
        type = "function"
      `

      const startFilePath = await writeToml(tmpDir, 'start.toml', startTomlContent)
      const extension1Path = await writeToml(tmpDir, 'extensions/extension1.toml', extension1Content)
      const extension2Path = await writeToml(tmpDir, 'extensions/extension2.toml', extension2Content)

      // When
      const result = await includeDemoService(startFilePath)

      // Then
      expect(result).toEqual({
        path: startFilePath,
        root: dirname(startFilePath),
        extensions: [
          {
            path: extension1Path,
            root: dirname(extension1Path),
            name: 'Extension 1',
            type: 'ui_extension',
          },
          {
            path: extension2Path,
            root: dirname(extension2Path),
            name: 'Extension 2',
            type: 'function',
          },
        ],
      })
      expect(result).toEqual(
        decodeToml(`
        path = "${startFilePath}"
        root = "${dirname(startFilePath)}"

        [[extensions]]
        path = "${extension1Path}"
        root = "${dirname(extension1Path)}"
        name = "Extension 1"
        type = "ui_extension"

        [[extensions]]
        path = "${extension2Path}"
        root = "${dirname(extension2Path)}"
        name = "Extension 2"
        type = "function"
      `),
      )
    })
  })

  test('handles an exploding include', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const startTomlContent = `
        [[extensions]]
        name = "original extension 1"

        [[extensions]]
        _include = "./extensions/*.toml"

        [[extensions]]
        name = "original extension 2"
      `
      const extension1Content = `
        name = "Included extension 1"
      `
      const extension2Content = `
        name = "Included extension 2"
      `

      const startFilePath = await writeToml(tmpDir, 'start.toml', startTomlContent)
      const extension1Path = await writeToml(tmpDir, 'extensions/extension1.toml', extension1Content)
      const extension2Path = await writeToml(tmpDir, 'extensions/extension2.toml', extension2Content)

      // When
      const result = await includeDemoService(startFilePath)

      // Then
      expect(result).toEqual({
        path: startFilePath,
        root: dirname(startFilePath),
        extensions: [
          {
            name: 'original extension 1',
          },
          {
            path: extension1Path,
            root: dirname(extension1Path),
            name: 'Included extension 1',
          },
          {
            path: extension2Path,
            root: dirname(extension2Path),
            name: 'Included extension 2',
          },
          {
            name: 'original extension 2',
          },
        ],
      })
      expect(result).toEqual(
        decodeToml(`
        path = "${startFilePath}"
        root = "${dirname(startFilePath)}"

        [[extensions]]
        name = "original extension 1"

        [[extensions]]
        path = "${extension1Path}"
        root = "${dirname(extension1Path)}"
        name = "Included extension 1"

        [[extensions]]
        path = "${extension2Path}"
        root = "${dirname(extension2Path)}"
        name = "Included extension 2"

        [[extensions]]
        name = "original extension 2"
      `),
      )
    })
  })
})
