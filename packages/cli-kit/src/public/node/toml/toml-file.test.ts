import {TomlFile, TomlParseError} from './toml-file.js'
import {writeFile, readFile, inTemporaryDirectory} from '../fs.js'
import {joinPath} from '../path.js'
import {describe, expect, test} from 'vitest'

describe('TomlFile', () => {
  describe('read', () => {
    test('reads and parses a TOML file', async () => {
      await inTemporaryDirectory(async (dir) => {
        const path = joinPath(dir, 'test.toml')
        await writeFile(path, 'name = "my-app"\nclient_id = "123"\n')

        const file = await TomlFile.read(path)

        expect(file.path).toBe(path)
        expect(file.content).toStrictEqual({name: 'my-app', client_id: '123'})
      })
    })

    test('reads nested tables', async () => {
      await inTemporaryDirectory(async (dir) => {
        const path = joinPath(dir, 'test.toml')
        await writeFile(path, '[build]\ndev_store_url = "my-store.myshopify.com"\n')

        const file = await TomlFile.read(path)

        expect(file.content).toStrictEqual({build: {dev_store_url: 'my-store.myshopify.com'}})
      })
    })

    test('throws TomlParseError with file path on invalid TOML', async () => {
      await inTemporaryDirectory(async (dir) => {
        const path = joinPath(dir, 'bad.toml')
        await writeFile(path, 'name = [invalid')

        await expect(TomlFile.read(path)).rejects.toThrow(TomlParseError)
        await expect(TomlFile.read(path)).rejects.toThrow(/bad\.toml/)
      })
    })

    test('throws if file does not exist', async () => {
      await expect(TomlFile.read('/nonexistent/path/test.toml')).rejects.toThrow()
    })
  })

  describe('patch', () => {
    test('sets a top-level value', async () => {
      await inTemporaryDirectory(async (dir) => {
        const path = joinPath(dir, 'test.toml')
        await writeFile(path, 'name = "old"\n')

        const file = await TomlFile.read(path)
        await file.patch({name: 'new'})

        expect(file.content.name).toBe('new')
        const raw = await readFile(path)
        expect(raw).toContain('name = "new"')
      })
    })

    test('sets a nested value', async () => {
      await inTemporaryDirectory(async (dir) => {
        const path = joinPath(dir, 'test.toml')
        await writeFile(path, '[build]\ndev_store_url = "old.myshopify.com"\n')

        const file = await TomlFile.read(path)
        await file.patch({build: {dev_store_url: 'new.myshopify.com'}})

        expect(file.content).toStrictEqual({build: {dev_store_url: 'new.myshopify.com'}})
      })
    })

    test('creates intermediate tables', async () => {
      await inTemporaryDirectory(async (dir) => {
        const path = joinPath(dir, 'test.toml')
        await writeFile(path, 'name = "app"\n')

        const file = await TomlFile.read(path)
        await file.patch({build: {dev_store_url: 'store.myshopify.com'}})

        expect(file.content).toStrictEqual({
          name: 'app',
          build: {dev_store_url: 'store.myshopify.com'},
        })
      })
    })

    test('sets multiple values at once', async () => {
      await inTemporaryDirectory(async (dir) => {
        const path = joinPath(dir, 'test.toml')
        await writeFile(path, 'name = "app"\nclient_id = "123"\n')

        const file = await TomlFile.read(path)
        await file.patch({name: 'updated', client_id: '456'})

        expect(file.content.name).toBe('updated')
        expect(file.content.client_id).toBe('456')
      })
    })

    test('preserves comments', async () => {
      await inTemporaryDirectory(async (dir) => {
        const path = joinPath(dir, 'test.toml')
        await writeFile(path, '# This is a comment\nname = "app"\n')

        const file = await TomlFile.read(path)
        await file.patch({name: 'updated'})

        const raw = await readFile(path)
        expect(raw).toContain('# This is a comment')
        expect(raw).toContain('name = "updated"')
      })
    })

    test('handles array values', async () => {
      await inTemporaryDirectory(async (dir) => {
        const path = joinPath(dir, 'test.toml')
        await writeFile(path, '[auth]\nredirect_urls = ["https://old.com"]\n')

        const file = await TomlFile.read(path)
        await file.patch({auth: {redirect_urls: ['https://new.com', 'https://other.com']}})

        const content = file.content as {auth: {redirect_urls: string[]}}
        expect(content.auth.redirect_urls).toStrictEqual(['https://new.com', 'https://other.com'])
      })
    })
  })

  describe('remove', () => {
    test('removes a top-level key', async () => {
      await inTemporaryDirectory(async (dir) => {
        const path = joinPath(dir, 'test.toml')
        await writeFile(path, 'name = "app"\nclient_id = "123"\n')

        const file = await TomlFile.read(path)
        await file.remove('name')

        expect(file.content.name).toBeUndefined()
        expect(file.content.client_id).toBe('123')
      })
    })

    test('removes a nested key', async () => {
      await inTemporaryDirectory(async (dir) => {
        const path = joinPath(dir, 'test.toml')
        await writeFile(
          path,
          '[build]\ndev_store_url = "store.myshopify.com"\nautomatically_update_urls_on_dev = true\n',
        )

        const file = await TomlFile.read(path)
        await file.remove('build.dev_store_url')

        const build = file.content.build as {[key: string]: unknown}
        expect(build.dev_store_url).toBeUndefined()
        expect(build.automatically_update_urls_on_dev).toBe(true)
      })
    })

    test('preserves unrelated content', async () => {
      await inTemporaryDirectory(async (dir) => {
        const path = joinPath(dir, 'test.toml')
        await writeFile(path, 'name = "app"\nclient_id = "123"\n')

        const file = await TomlFile.read(path)
        await file.remove('name')

        const raw = await readFile(path)
        expect(raw).toContain('client_id = "123"')
        expect(raw).not.toContain('name')
      })
    })
  })

  describe('replace', () => {
    test('replaces the entire file content', async () => {
      await inTemporaryDirectory(async (dir) => {
        const path = joinPath(dir, 'test.toml')
        await writeFile(path, 'name = "old"\n')

        const file = await TomlFile.read(path)
        await file.replace({name: 'new', client_id: '789'})

        expect(file.content).toStrictEqual({name: 'new', client_id: '789'})
        const raw = await readFile(path)
        expect(raw).toContain('name = "new"')
        expect(raw).toContain('client_id = "789"')
      })
    })

    test('does not preserve comments', async () => {
      await inTemporaryDirectory(async (dir) => {
        const path = joinPath(dir, 'test.toml')
        await writeFile(path, '# Comment\nname = "old"\n')

        const file = await TomlFile.read(path)
        await file.replace({name: 'new'})

        const raw = await readFile(path)
        expect(raw).not.toContain('# Comment')
      })
    })

    test('round-trips read → replace → read', async () => {
      await inTemporaryDirectory(async (dir) => {
        const path = joinPath(dir, 'test.toml')
        const original = {
          name: 'my-app',
          client_id: 'abc123',
          build: {dev_store_url: 'store.myshopify.com'},
        }
        await writeFile(path, 'name = "placeholder"\n')

        const file = await TomlFile.read(path)
        await file.replace(original)

        const reread = await TomlFile.read(path)
        expect(reread.content).toStrictEqual(original)
      })
    })
  })

  describe('transformRaw', () => {
    test('transforms the raw TOML string and updates content', async () => {
      await inTemporaryDirectory(async (dir) => {
        const path = joinPath(dir, 'test.toml')
        await writeFile(path, 'name = "app"\n')

        const file = await TomlFile.read(path)
        await file.transformRaw((raw) => `# Header comment\n${raw}`)

        const raw = await readFile(path)
        expect(raw).toContain('# Header comment')
        expect(raw).toContain('name = "app"')
        expect(file.content.name).toBe('app')
      })
    })

    test('injected comments survive subsequent patch calls', async () => {
      await inTemporaryDirectory(async (dir) => {
        const path = joinPath(dir, 'test.toml')
        await writeFile(path, 'name = "app"\nclient_id = "123"\n')

        const file = await TomlFile.read(path)
        await file.transformRaw((raw) => `# Keep this comment\n${raw}`)
        await file.patch({name: 'updated'})

        const raw = await readFile(path)
        expect(raw).toContain('# Keep this comment')
        expect(raw).toContain('name = "updated"')
      })
    })

    test('works after replace to add comments', async () => {
      await inTemporaryDirectory(async (dir) => {
        const path = joinPath(dir, 'test.toml')
        await writeFile(path, '')

        const file = new TomlFile(path, {})
        await file.replace({name: 'app', client_id: '123'})
        await file.transformRaw((raw) => `# Doc link\n${raw}`)

        const raw = await readFile(path)
        expect(raw).toContain('# Doc link')
        expect(raw).toContain('name = "app"')
        expect(file.content).toStrictEqual({name: 'app', client_id: '123'})
      })
    })
  })

  describe('constructor', () => {
    test('creates a TomlFile instance for new files', async () => {
      await inTemporaryDirectory(async (dir) => {
        const path = joinPath(dir, 'new.toml')
        const file = new TomlFile(path, {})
        await file.replace({type: 'ui_extension', name: 'My Extension'})

        const raw = await readFile(path)
        expect(raw).toContain('type = "ui_extension"')
        expect(raw).toContain('name = "My Extension"')
      })
    })
  })
})
