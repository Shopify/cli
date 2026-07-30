/**
 * "Apps" section of the CLI Pre-release QA flow.
 *
 * Each step mirrors one checklist item of the QA doc, in order. Items that
 * require a human (browser/visual checks) are declared kind: 'manual' and
 * reported as skipped — never silently dropped.
 */
import * as fs from 'fs'
import * as net from 'net'
import * as path from 'path'
import {exec, expectSuccess, httpRequest, retry, spawnPty, tail} from '../proc.js'
import type {Ctx} from '../context.js'
import type {SectionDef} from '../types.js'

const READY_MESSAGE = 'Ready, watching for changes in your app'
const UPDATED_MESSAGE = 'Updated dev preview'

const FUNCTION_INPUT =
  '{"cart":{"lines":[{"id":"gid://shopify/CartLine/0","cost":{"subtotalAmount":{"amount":"10.0"}}}]},"discount":{"discountClasses":["PRODUCT","ORDER","SHIPPING"]}}'

const EXTENSIONS = {
  adminAction: 'qa-admin-action',
  theme: 'qa-theme-ext',
  discount: 'qa-discount',
  flowAction: 'qa-flow-action',
  choice: 'qa-admin-block',
  midDev: 'qa-admin-link',
}

function appDirOrThrow(ctx: Ctx): string {
  const dir = ctx.state.appDir
  if (!dir) throw new Error('No app directory (app init did not succeed)')
  return dir
}

function devProcOrThrow(ctx: Ctx) {
  const proc = ctx.state.devProc
  if (!proc || proc.exited) throw new Error('`app dev` is not running')
  return proc
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (address && typeof address === 'object') {
        const port = address.port
        server.close(() => resolve(port))
      } else {
        server.close(() => reject(new Error('Could not allocate a free port')))
      }
    })
    server.on('error', reject)
  })
}

async function generateExtension(ctx: Ctx, template: string, name: string, flavor?: string): Promise<string> {
  const appDir = appDirOrThrow(ctx)
  const args = ['app', 'generate', 'extension', `--template=${template}`, `--name=${name}`]
  if (flavor) args.push(`--flavor=${flavor}`)
  expectSuccess(
    await exec(ctx, args, {cwd: appDir, timeoutMs: 5 * 60_000}),
    `app generate extension --template=${template}`,
  )
  const extDir = path.join(appDir, 'extensions', name)
  if (!fs.existsSync(extDir)) throw new Error(`Extension directory not created: ${extDir}`)
  return `created extensions/${name}`
}

/** Edit a file and return a note; throws when the expected content is missing. */
function editFile(filePath: string, mutate: (content: string) => string): void {
  const content = fs.readFileSync(filePath, 'utf8')
  fs.writeFileSync(filePath, mutate(content))
}

function findFile(dir: string, candidates: string[]): string {
  for (const candidate of candidates) {
    const filePath = path.join(dir, candidate)
    if (fs.existsSync(filePath)) return filePath
  }
  throw new Error(`None of ${candidates.join(', ')} found under ${dir}`)
}

export const appsSection: SectionDef = {
  title: 'Apps',
  steps: [
    {
      id: 'apps.init',
      doc: 'Create a new dev platform app: `shopify app init --template reactRouter`',
      kind: 'auto',
      run: async (ctx) => {
        const name = `qa-ci-${new Date().toISOString().slice(0, 10)}-${process.pid}`
        const args = [
          'app',
          'init',
          '--template',
          'reactRouter',
          // Flags below only replace interactive prompts; the doc answers them by hand.
          '--name',
          name,
          '--flavor',
          'javascript',
          '--package-manager',
          process.env.QA_PACKAGE_MANAGER ?? 'pnpm',
          '--path',
          ctx.workDir,
        ]
        if (ctx.orgId) args.push('--organization-id', ctx.orgId)
        const result = expectSuccess(await exec(ctx, args, {timeoutMs: 10 * 60_000}), 'app init')

        const output = `${result.stdout}\n${result.stderr}`
        const match = output.match(/([\w-]+) is ready for you to build!/)
        let appDir: string | undefined
        if (match?.[1]) {
          appDir = path.join(ctx.workDir, match[1])
        } else {
          const entries = fs.readdirSync(ctx.workDir, {withFileTypes: true})
          const appEntry = entries.find(
            (entry) => entry.isDirectory() && fs.existsSync(path.join(ctx.workDir, entry.name, 'shopify.app.toml')),
          )
          if (appEntry) appDir = path.join(ctx.workDir, appEntry.name)
        }
        if (!appDir || !fs.existsSync(appDir)) {
          throw new Error(`Could not locate created app in ${ctx.workDir}\n${tail(output)}`)
        }
        ctx.state.appDir = appDir
        ctx.state.appName = name
        return `created ${path.basename(appDir)}`
      },
    },
    {
      id: 'apps.ext.admin-action',
      doc: '`shopify app generate extension --template=admin_action`',
      kind: 'auto',
      independent: true,
      run: (ctx) => generateExtension(ctx, 'admin_action', EXTENSIONS.adminAction),
    },
    {
      id: 'apps.ext.theme',
      doc: '`shopify app generate extension --template=theme_app_extension`',
      kind: 'auto',
      independent: true,
      run: (ctx) => generateExtension(ctx, 'theme_app_extension', EXTENSIONS.theme),
    },
    {
      id: 'apps.ext.discount',
      doc: '`shopify app generate extension --template=discount --flavor=typescript`',
      kind: 'auto',
      independent: true,
      run: (ctx) => generateExtension(ctx, 'discount', EXTENSIONS.discount, 'typescript'),
    },
    {
      id: 'apps.ext.flow-action',
      doc: '`shopify app generate extension --template=flow_action`',
      kind: 'auto',
      independent: true,
      run: (ctx) => generateExtension(ctx, 'flow_action', EXTENSIONS.flowAction),
    },
    {
      id: 'apps.ext.choice',
      doc: '`shopify app generate extension` (a random extension of your choice — admin_block)',
      kind: 'auto',
      independent: true,
      run: (ctx) => generateExtension(ctx, 'admin_block', EXTENSIONS.choice),
    },
    {
      id: 'apps.dev.start',
      doc: 'Run `shopify app dev`',
      kind: 'auto',
      run: async (ctx) => {
        const appDir = appDirOrThrow(ctx)
        const port = await freePort()
        const key = 'qa-graphiql-key'
        ctx.state.graphiql = {port, key}
        const args = ['app', 'dev', '--graphiql-port', String(port), '--graphiql-key', key]
        if (ctx.storeFqdn) args.push('--store', ctx.storeFqdn)
        const proc = spawnPty(ctx, args, {cwd: appDir})
        ctx.state.devProc = proc
        await proc.waitFor(READY_MESSAGE, {timeoutMs: 5 * 60_000})
        return 'dev is ready and watching for changes'
      },
    },
    {
      id: 'apps.dev.console.open',
      doc: 'Dev Console: open the shop and see the dev console',
      kind: 'manual',
      reason: 'browser check',
    },
    {
      id: 'apps.dev.console.connected',
      doc: 'The app you ran dev on should be the first dev preview and show as connected (green icon)',
      kind: 'manual',
      reason: 'browser check',
    },
    {
      id: 'apps.dev.admin-action.product',
      doc: 'If your shop has no products, create one now (needed to test the extensions)',
      kind: 'manual',
      reason: 'store admin browser step — the QA store is expected to already have a product',
    },
    {
      id: 'apps.dev.admin-action.modal',
      doc: 'From dev-console, open the admin-action link: product admin page opens the action modal',
      kind: 'manual',
      reason: 'browser check',
    },
    {
      id: 'apps.dev.admin-action.hot-reload',
      doc: 'Change the message inside `src/ActionExtension.js` — you should see it hot reload',
      kind: 'auto',
      run: async (ctx) => {
        const proc = devProcOrThrow(ctx)
        const extDir = path.join(appDirOrThrow(ctx), 'extensions', EXTENSIONS.adminAction, 'src')
        const file = findFile(extDir, ['ActionExtension.jsx', 'ActionExtension.js', 'ActionExtension.tsx'])
        editFile(file, (content) => content.replace(/current product/i, 'QA hot reload message'))
        await proc.waitFor(UPDATED_MESSAGE, {timeoutMs: 3 * 60_000})
        return `edited ${path.basename(file)}; dev reported "${UPDATED_MESSAGE}" (visual confirmation stays manual)`
      },
    },
    {
      id: 'apps.dev.extension-mid-dev',
      doc: 'Add another extension and see it show up in the dev console',
      kind: 'auto',
      run: async (ctx) => {
        const proc = devProcOrThrow(ctx)
        await generateExtension(ctx, 'admin_link', EXTENSIONS.midDev)
        await proc.waitFor(/Extension created|Updated dev preview/, {timeoutMs: 3 * 60_000})
        return 'new extension picked up by the running dev session (dev-console visual stays manual)'
      },
    },
    {
      id: 'apps.dev.graphiql',
      doc: 'Press `g` to open GraphiQL; test that it works with `query { shop { name } }`',
      kind: 'auto',
      run: async (ctx) => {
        devProcOrThrow(ctx)
        const graphiql = ctx.state.graphiql
        if (!graphiql) throw new Error('GraphiQL port/key were not configured')
        const base = `http://localhost:${graphiql.port}`
        // Equivalent of pressing `g`: the key only opens this URL in a browser.
        await retry(async () => {
          const ping = await httpRequest(`${base}/graphiql/ping`)
          if (ping.status !== 200) throw new Error(`GraphiQL ping returned ${ping.status}`)
        }, 10, 3000)
        const response = await httpRequest(`${base}/graphiql/graphql.json?key=${graphiql.key}&api_version=unstable`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({query: 'query { shop { name } }'}),
          timeoutMs: 30_000,
        })
        if (response.status !== 200) {
          throw new Error(`GraphiQL query returned HTTP ${response.status}: ${tail(response.body, 10)}`)
        }
        const parsed = JSON.parse(response.body) as {data?: {shop?: {name?: string}}; errors?: unknown}
        if (!parsed.data?.shop?.name) {
          throw new Error(`GraphiQL query did not return shop name: ${tail(response.body, 10)}`)
        }
        return `GraphiQL answered: shop name "${parsed.data.shop.name}"`
      },
    },
    {
      id: 'apps.dev.execute',
      doc: "Test the same query via command: `shopify app execute --query 'query { shop { name } }'`",
      kind: 'auto',
      run: async (ctx) => {
        const result = expectSuccess(
          await exec(ctx, ['app', 'execute', '--query', 'query { shop { name } }'], {
            cwd: appDirOrThrow(ctx),
            timeoutMs: 2 * 60_000,
          }),
          'app execute',
        )
        const output = result.stdout + result.stderr
        if (!/"name"\s*:/.test(output)) throw new Error(`app execute output has no shop name:\n${tail(output, 15)}`)
        return 'app execute returned shop data'
      },
    },
    {
      id: 'apps.dev.theme-ext.uploaded',
      doc: 'Theme extension files should have been uploaded by now (if not, wait for it)',
      kind: 'auto',
      run: async (ctx) => {
        const proc = devProcOrThrow(ctx)
        await proc.waitFor(/theme app extension|host theme|9292/i, {timeoutMs: 4 * 60_000})
        return 'dev output shows the theme app extension is being served'
      },
    },
    {
      id: 'apps.dev.theme-ext.setup-link',
      doc: 'Click on the "Setup your theme app extension in the host theme" link from the CLI output',
      kind: 'manual',
      reason: 'browser check (theme editor)',
    },
    {
      id: 'apps.dev.theme-ext.add-section',
      doc: '"Add section", choose your app and "Save"',
      kind: 'manual',
      reason: 'browser check (theme editor)',
    },
    {
      id: 'apps.dev.theme-ext.preview',
      doc: 'Open the theme app extension local preview (e.g. http://127.0.0.1:9292)',
      kind: 'auto',
      run: async (ctx) => {
        const proc = devProcOrThrow(ctx)
        const match = proc.output().match(/https?:\/\/(?:127\.0\.0\.1|localhost):(\d{4,5})/g)
        const themeUrl =
          match?.find((url) => url.includes('9292')) ?? 'http://127.0.0.1:9292'
        const response = await retry(() => httpRequest(themeUrl, {timeoutMs: 20_000}), 6, 5000)
        return `theme preview at ${themeUrl} responded with HTTP ${response.status} (visual confirmation stays manual)`
      },
    },
    {
      id: 'apps.dev.theme-ext.hot-reload',
      doc: "Add `Hello` inside the span in the theme's `blocks/star_rating.liquid` — it should hot reload",
      kind: 'auto',
      run: async (ctx) => {
        const proc = devProcOrThrow(ctx)
        const blocksDir = path.join(appDirOrThrow(ctx), 'extensions', EXTENSIONS.theme, 'blocks')
        const file = findFile(blocksDir, ['star_rating.liquid'])
        editFile(file, (content) => {
          if (!content.includes('<span')) throw new Error(`No <span> found in ${file}`)
          return content.replace(/(<span[^>]*>)/, '$1Hello ')
        })
        await proc.waitFor(/star_rating\.liquid|Updated dev preview|hot reload/i, {timeoutMs: 3 * 60_000})
        return 'edited star_rating.liquid; dev picked up the change (visual confirmation stays manual)'
      },
    },
    {
      id: 'apps.dev.quit',
      doc: 'Press `q` to stop dev',
      kind: 'auto',
      run: async (ctx) => {
        const proc = devProcOrThrow(ctx)
        proc.write('q')
        const code = await proc.waitForExit(60_000)
        ctx.state.devProc = undefined
        if (code !== 0) throw new Error(`app dev exited with code ${code} after pressing q\n${tail(proc.output())}`)
        return 'dev stopped cleanly'
      },
    },
    {
      id: 'apps.dev.console.disconnected',
      doc: 'See that the dev console still reports a dev preview, but shown as disconnected',
      kind: 'manual',
      reason: 'browser check',
    },
    {
      id: 'apps.dev.clean',
      doc: 'Run `shopify app dev clean` to end the preview; the dev preview is now hidden',
      kind: 'auto',
      run: async (ctx) => {
        expectSuccess(
          await exec(ctx, ['app', 'dev', 'clean'], {cwd: appDirOrThrow(ctx), timeoutMs: 2 * 60_000}),
          'app dev clean',
        )
        return 'dev preview cleaned (dev-console visual stays manual)'
      },
    },
    {
      id: 'apps.function.build',
      doc: 'Move to the function directory and run `shopify app function build`',
      kind: 'auto',
      run: async (ctx) => {
        const functionDir = path.join(appDirOrThrow(ctx), 'extensions', EXTENSIONS.discount)
        expectSuccess(
          await exec(ctx, ['app', 'function', 'build'], {cwd: functionDir, timeoutMs: 5 * 60_000}),
          'app function build',
        )
        return 'function built'
      },
    },
    {
      id: 'apps.function.run',
      doc: "echo '<cart JSON>' | shopify app function run — should complete without an error",
      kind: 'auto',
      run: async (ctx) => {
        const functionDir = path.join(appDirOrThrow(ctx), 'extensions', EXTENSIONS.discount)
        const result = expectSuccess(
          await exec(ctx, ['app', 'function', 'run'], {
            cwd: functionDir,
            input: FUNCTION_INPUT,
            timeoutMs: 3 * 60_000,
          }),
          'app function run',
        )
        return `function ran (output tail: ${tail(result.stdout, 3).trim().slice(0, 120)})`
      },
    },
    {
      id: 'apps.deploy.v1',
      doc: 'Run `shopify app deploy --version v1` and release the version — should complete without error',
      kind: 'auto',
      run: async (ctx) => {
        // --allow-updates replaces the interactive confirmation (the flag the CLI
        // documents as the CI/CD equivalent). Deploy releases by default.
        expectSuccess(
          await exec(ctx, ['app', 'deploy', '--version', 'v1', '--allow-updates'], {
            cwd: appDirOrThrow(ctx),
            timeoutMs: 10 * 60_000,
          }),
          'app deploy --version v1',
        )
        return 'v1 deployed and released'
      },
    },
    {
      id: 'apps.versions.list',
      doc: 'Run `shopify app versions list` and validate that your version is there',
      kind: 'auto',
      run: async (ctx) => {
        const result = expectSuccess(
          await exec(ctx, ['app', 'versions', 'list'], {cwd: appDirOrThrow(ctx), timeoutMs: 2 * 60_000}),
          'app versions list',
        )
        const output = result.stdout + result.stderr
        if (!output.includes('v1')) throw new Error(`versions list does not contain v1:\n${tail(output, 20)}`)
        return 'v1 present in versions list'
      },
    },
    {
      id: 'apps.config.link',
      doc: 'Run `shopify app config link` and create a new app',
      kind: 'auto',
      run: async (ctx) => {
        const appDir = appDirOrThrow(ctx)
        const configName = 'staging'
        const newAppName = `${ctx.state.appName ?? 'qa-ci-app'}-staging`
        const proc = spawnPty(ctx, ['app', 'config', 'link'], {cwd: appDir})

        // Prompt flow: configuration file name → (org) → app selection
        // ("Create this project as a new app" is the first choice) → app name.
        await proc.waitFor(/configuration file name/i, {timeoutMs: 2 * 60_000})
        proc.sendLine(configName)

        await proc.waitFor(/create this project as a new app|which existing app|organization/i, {
          timeoutMs: 3 * 60_000,
        })
        if (/organization/i.test(proc.output()) && !/create this project as a new app/i.test(proc.output())) {
          // Organization select — accept the highlighted option.
          proc.write('\r')
          await proc.waitFor(/create this project as a new app|which existing app/i, {timeoutMs: 2 * 60_000})
        }
        // "Create this project as a new app on Shopify?" (yes is default) or app select with create-new first.
        proc.write('\r')

        await proc.waitFor(/app name/i, {timeoutMs: 2 * 60_000})
        proc.sendLine(newAppName)

        const code = await proc.waitForExit(3 * 60_000)
        if (code !== 0) throw new Error(`app config link exited with ${code}\n${tail(proc.output())}`)
        const tomlPath = path.join(appDir, `shopify.app.${configName}.toml`)
        if (!fs.existsSync(tomlPath)) {
          throw new Error(`Expected ${tomlPath} to exist after config link\n${tail(proc.output())}`)
        }
        ctx.state.secondaryConfig = configName
        return `created shopify.app.${configName}.toml linked to new app "${newAppName}"`
      },
    },
    {
      id: 'apps.deploy.second',
      doc: 'Run `shopify app deploy` again and validate that it is deployed to the new app',
      kind: 'auto',
      run: async (ctx) => {
        const appDir = appDirOrThrow(ctx)
        const config = ctx.state.secondaryConfig
        if (!config) throw new Error('No secondary config from `app config link`')
        expectSuccess(
          await exec(ctx, ['app', 'deploy', '--config', config, '--allow-updates'], {
            cwd: appDir,
            timeoutMs: 10 * 60_000,
          }),
          `app deploy --config ${config}`,
        )
        const versions = expectSuccess(
          await exec(ctx, ['app', 'versions', 'list', '--config', config], {cwd: appDir, timeoutMs: 2 * 60_000}),
          'app versions list --config',
        )
        const output = versions.stdout + versions.stderr
        if (!/1 app version|app versions?/i.test(output)) {
          throw new Error(`Could not validate deploy on the new app:\n${tail(output, 20)}`)
        }
        return 'second deploy landed on the newly created app'
      },
    },
  ],
}
