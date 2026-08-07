/**
 * "Apps" section of the CLI Pre-release QA flow.
 *
 * Each step mirrors one checklist item of the QA doc, in order. Items that
 * require a human are declared kind: 'manual' and reported as skipped — never
 * silently dropped. The whole `shopify app dev` block is manual by team
 * decision: it is an interactive session with browser/visual checks.
 */
import * as fs from 'fs'
import * as path from 'path'
import {exec, expectSuccess, settle, spawnPty, tail} from '../proc.js'
import type {Ctx} from '../context.js'
import type {SectionDef} from '../types.js'

const DEV_MANUAL_REASON = 'part of the interactive `shopify app dev` session — validated by hand during release QA'

const FUNCTION_INPUT =
  '{"cart":{"lines":[{"id":"gid://shopify/CartLine/0","cost":{"subtotalAmount":{"amount":"10.0"}}}]},"discount":{"discountClasses":["PRODUCT","ORDER","SHIPPING"]}}'

const EXTENSIONS = {
  adminAction: 'qa-admin-action',
  theme: 'qa-theme-ext',
  discount: 'qa-discount',
  flowAction: 'qa-flow-action',
  choice: 'qa-admin-block',
}

function appDirOrThrow(ctx: Ctx): string {
  const dir = ctx.state.appDir
  if (!dir) throw new Error('No app directory (app init did not succeed)')
  return dir
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
        // On CI, pnpm defaults to frozen-lockfile and `generate extension` adds
        // workspace packages that are not in the template lockfile yet.
        fs.appendFileSync(path.join(appDir, '.npmrc'), 'frozen-lockfile=false\n')
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
      kind: 'manual',
      reason: DEV_MANUAL_REASON,
    },
    {
      id: 'apps.dev.console',
      doc: 'Dev Console: open the shop, see the dev console, app shows as connected (green icon)',
      kind: 'manual',
      reason: DEV_MANUAL_REASON,
    },
    {
      id: 'apps.dev.admin-action',
      doc: 'Test the admin-action: product admin opens the action modal; editing `src/ActionExtension.js` hot reloads',
      kind: 'manual',
      reason: DEV_MANUAL_REASON,
    },
    {
      id: 'apps.dev.extension-mid-dev',
      doc: 'Add another extension and see it show up in the dev console',
      kind: 'manual',
      reason: DEV_MANUAL_REASON,
    },
    {
      id: 'apps.dev.graphiql',
      doc: 'Press `g` to open GraphiQL and test `query { shop { name } }`',
      kind: 'manual',
      reason: DEV_MANUAL_REASON,
    },
    {
      id: 'apps.dev.execute',
      doc: "Test the same query via command: `shopify app execute --query 'query { shop { name } }'`",
      kind: 'manual',
      reason: DEV_MANUAL_REASON,
    },
    {
      id: 'apps.dev.theme-ext',
      doc: 'Theme app extension: setup link, "Add section" + Save, local preview at 127.0.0.1:9292, `star_rating.liquid` hot reload',
      kind: 'manual',
      reason: DEV_MANUAL_REASON,
    },
    {
      id: 'apps.dev.quit',
      doc: 'Press `q` to stop dev; dev console shows the preview as disconnected',
      kind: 'manual',
      reason: DEV_MANUAL_REASON,
    },
    {
      id: 'apps.dev.clean',
      doc: 'Run `shopify app dev clean` to end the preview; the dev preview is now hidden',
      kind: 'manual',
      reason: DEV_MANUAL_REASON,
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
        // --organization-id and --config replace prompts the doc answers by hand;
        // the "create new app" + "app name" prompts are driven over the pty.
        const args = ['app', 'config', 'link', '--config', configName]
        if (ctx.orgId) args.push('--organization-id', ctx.orgId)
        const proc = spawnPty(ctx, args, {cwd: appDir})

        // First prompt is "Create this project as a new app" when the org has
        // existing apps, or "App name" straight away when it does not.
        await proc.waitFor(/Create this project as a new app|App name/, {timeoutMs: 3 * 60_000})
        if (proc.output().includes('Create this project as a new app')) {
          await settle(100)
          proc.write('\r')
          await proc.waitFor(/App name/, {timeoutMs: 2 * 60_000})
        }
        // Write the name as a single data event, then Enter separately so Ink
        // treats it as submission (mirrors how a human types + confirms).
        await settle(250)
        proc.write(newAppName)
        await settle(250)
        proc.write('\r')

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
