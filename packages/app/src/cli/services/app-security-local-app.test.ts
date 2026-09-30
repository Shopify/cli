import {startAppSecurityLocalApp} from './app-security-local-app.js'
import {fileExists, inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {fetch} from '@shopify/cli-kit/node/http'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'

describe('startAppSecurityLocalApp', () => {
  test('runs predev and starts the backend command from shopify.web.toml, then stops it', async () => {
    await inTemporaryDirectory(async (directory) => {
      const webDirectory = joinPath(directory, 'web')
      await mkdir(webDirectory)
      await writeFile(
        joinPath(directory, 'shopify.app.toml'),
        'name = "Local runner"\nclient_id = "test-client-id"\n[access_scopes]\nscopes = "read_products"\n',
      )
      await writeFile(
        joinPath(webDirectory, 'shopify.web.toml'),
        'roles = ["backend"]\n[commands]\npredev = "node predev.mjs"\ndev = "node server.mjs"\n',
      )
      await writeFile(
        joinPath(webDirectory, 'predev.mjs'),
        'import {writeFile} from "node:fs/promises"; await writeFile("predev-ran", "yes");\n',
      )
      await writeFile(
        joinPath(webDirectory, 'server.mjs'),
        `import {createServer} from "node:http";
const server = createServer((_request, response) => {
  response.writeHead(401, {"content-type": "application/json"});
  response.end(JSON.stringify({apiKey: process.env.SHOPIFY_API_KEY, appUrl: process.env.SHOPIFY_APP_URL}));
});
server.listen(Number(process.env.PORT), "localhost");
process.on("SIGTERM", () => server.close());
`,
      )

      const runningApp = await startAppSecurityLocalApp({
        appRoot: directory,
        configFileName: 'shopify.app.toml',
        startupTimeoutMilliseconds: 10_000,
      })
      const response = await fetch(runningApp.url)

      expect(response.status).toBe(401)
      await expect(response.json()).resolves.toEqual({apiKey: 'test-client-id'})
      await expect(fileExists(joinPath(webDirectory, 'predev-ran'))).resolves.toBe(true)

      await runningApp.stop()
      await expect(fetch(runningApp.url)).rejects.toThrow()
    })
  })

  test('requires exactly one backend web process', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeFile(joinPath(directory, 'shopify.app.toml'), 'name = "No backend"\n')
      await writeFile(
        joinPath(directory, 'shopify.web.toml'),
        'roles = ["frontend"]\n[commands]\ndev = "node server.mjs"\n',
      )

      await expect(startAppSecurityLocalApp({appRoot: directory, configFileName: 'shopify.app.toml'})).rejects.toThrow(
        'App Security could not find a backend web process.',
      )
    })
  })
})
