/* eslint-disable no-await-in-loop */
/* eslint-disable no-console */
/* eslint-disable no-restricted-imports */
import {
  appInfo,
  configLink,
  createApp,
  deployApp,
  devClean,
  executeGraphQL,
  functionBuild,
  functionRun,
  generateExtension,
  versionsList,
} from '../setup/app.js'
import {teardownAll} from '../setup/teardown.js'
import {CLI_TIMEOUT, TEST_TIMEOUT} from '../setup/constants.js'
import {requireEnv} from '../setup/env.js'
import {storeTestFixture as test} from '../setup/store.js'
import {expect, type APIRequestContext} from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import type {SpawnedProcess} from '../setup/cli.js'

const SHOP_QUERY = 'query { shop { name } }'
const GRAPHIQL_KEY = 'e2e-graphiql-key'
const RUN_APP_DEV_QA_FLOW = true
const RUN_POST_DEV_QA_FLOW = false

const FUNCTION_INPUT = {
  cart: {
    lines: [
      {
        id: 'gid://shopify/CartLine/0',
        cost: {subtotalAmount: {amount: '10.0'}},
      },
    ],
  },
  discount: {
    discountClasses: ['PRODUCT', 'ORDER', 'SHIPPING'],
  },
}

interface StepLogger {
  label: string
  startedAt: number
}

function startStep(label: string): StepLogger {
  console.log(`[app-qa-flow] START ${label}`)
  return {label, startedAt: Date.now()}
}

function finishStep(step: StepLogger) {
  console.log(`[app-qa-flow] PASS ${step.label} (${Date.now() - step.startedAt}ms)`)
}

async function qaStep<T>(label: string, action: () => Promise<T>): Promise<T> {
  const step = startStep(label)
  try {
    const result = await action()
    finishStep(step)
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[app-qa-flow] FAIL ${step.label} (${Date.now() - step.startedAt}ms)\n${message}`)
    throw error
  }
}

function expectCommandSuccess(step: string, result: {exitCode: number; stdout: string; stderr: string}) {
  if (result.exitCode !== 0) {
    throw new Error(
      `${step} failed with exit code ${result.exitCode}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    )
  }
}

async function waitForNewOutput(proc: SpawnedProcess, text: string, startIndex: number, timeoutMs: number) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const output = proc.getOutput()
    if (output.slice(startIndex).includes(text)) return
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(`Timed out waiting for new output "${text}". Captured output:\n${proc.getOutput()}`)
}

async function waitForGraphiQL(request: APIRequestContext, port: number) {
  const statusUrl = `http://localhost:${port}/graphiql/status`
  const startedAt = Date.now()
  while (Date.now() - startedAt < CLI_TIMEOUT.medium) {
    const response = await request.get(statusUrl).catch(() => undefined)
    if (response?.ok) {
      const body = (await response.json()) as {status?: string}
      if (body.status === 'OK') return
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  throw new Error(`GraphiQL did not become ready at ${statusUrl}`)
}

async function runGraphiQLQuery(request: APIRequestContext, port: number, key: string) {
  const response = await request.post(
    `http://localhost:${port}/graphiql/graphql.json?key=${key}&api_version=unstable`,
    {
      headers: {'content-type': 'application/json'},
      data: {query: SHOP_QUERY},
    },
  )
  const body = (await response.json()) as {data?: {shop?: {name?: string}}; errors?: {message: string}[]}

  expect(response.ok(), `GraphiQL query failed: ${JSON.stringify(body)}`).toBe(true)
  expect(body.errors, `GraphiQL returned errors: ${JSON.stringify(body.errors)}`).toBeUndefined()
  expect(body.data?.shop?.name).toBeTruthy()
}

function findFile(directory: string, matcher: RegExp): string {
  const entries = fs.readdirSync(directory, {withFileTypes: true})
  for (const entry of entries) {
    const child = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      const match = findFile(child, matcher)
      if (match) return match
    } else if (matcher.test(entry.name)) {
      return child
    }
  }
  return ''
}

test.describe('Apps QA flow', () => {
  test('covers the prerelease Apps QA checklist', async ({cli, env, browserPage, request, storeFqdn}) => {
    test.setTimeout(TEST_TIMEOUT.qaFlow)
    requireEnv(env, 'orgId')

    const parentDir = fs.mkdtempSync(path.join(env.tempDir, 'app-'))
    const appName = `E2E-qa1-${Date.now()}`
    const secondaryAppName = `E2E-qa2-${Date.now()}`
    const graphiqlPort = 4457 + env.workerIndex * 10
    let appDir = ''
    let secondaryAppCreated = false
    let needsStoreCleanup = false

    try {
      appDir = await qaStep('app init reactRouter', async () => {
        const initResult = await createApp({
          cli,
          parentDir,
          name: appName,
          template: 'reactRouter',
          flavor: 'javascript',
          packageManager: 'pnpm',
          orgId: env.orgId,
        })
        expectCommandSuccess('app init', initResult)
        return initResult.appDir
      })

      const extensions = [{name: 'e2e-admin-action', template: 'admin_action', flavor: 'preact'}]

      for (const extension of extensions) {
        await qaStep(`generate ${extension.template}`, async () => {
          const result = await generateExtension({cli, appDir, ...extension})
          expectCommandSuccess(`generate ${extension.template}`, result)
          expect(fs.existsSync(path.join(appDir, 'extensions', extension.name))).toBe(true)
        })
      }

      if (RUN_APP_DEV_QA_FLOW) {
        await qaStep('app dev, GraphiQL, dev console, and hot reload', async () => {
          const dev = await cli.spawn(['app', 'dev', '--path', appDir, '--skip-dependencies-installation'], {
            env: {
              CI: '',
              SHOPIFY_FLAG_GRAPHIQL_KEY: GRAPHIQL_KEY,
              SHOPIFY_FLAG_GRAPHIQL_PORT: String(graphiqlPort),
              SHOPIFY_FLAG_STORE: storeFqdn,
            },
          })
          needsStoreCleanup = true

          try {
            await dev.waitForOutput('Ready, watching for changes in your app', CLI_TIMEOUT.long)
            await waitForGraphiQL(request, graphiqlPort)
            await runGraphiQLQuery(request, graphiqlPort, GRAPHIQL_KEY)

            const adminActionFile = findFile(path.join(appDir, 'extensions', 'e2e-admin-action'), /^ActionExtension\./)
            expect(adminActionFile).toBeTruthy()
            const beforeAdminEdit = dev.getOutput().length
            fs.appendFileSync(adminActionFile, '\nconst e2eHotReloadMarker = "qa-flow";\n')
            await waitForNewOutput(dev, 'Extension changed', beforeAdminEdit, CLI_TIMEOUT.medium)

            const extraExtensionDir = path.join(appDir, 'extensions', 'e2e-mid-dev-flow-trigger')
            const beforeCreate = dev.getOutput().length
            fs.mkdirSync(extraExtensionDir, {recursive: true})
            fs.writeFileSync(
              path.join(extraExtensionDir, 'shopify.extension.toml'),
              `
type = "flow_trigger"
name = "e2e-mid-dev-flow-trigger"
handle = "e2e-mid-dev-flow-trigger"
description = "E2E mid-dev trigger"
`.trimStart(),
            )
            await waitForNewOutput(dev, 'Extension created', beforeCreate, CLI_TIMEOUT.medium)

            dev.sendKey('q')
            const exitCode = await dev.waitForExit(CLI_TIMEOUT.short)
            expect(exitCode, `app dev exited with non-zero code. Output:\n${dev.getOutput()}`).toBe(0)
          } catch (error) {
            console.error(`[app-qa-flow] Captured app dev output:\n${dev.getOutput()}`)
            throw error
          } finally {
            dev.kill()
          }
        })

        await qaStep('app dev clean', async () => {
          const cleanResult = await devClean({cli, appDir, storeFqdn})
          expectCommandSuccess('app dev clean', cleanResult)
        })

        await qaStep('app execute GraphQL', async () => {
          const executeResult = await executeGraphQL({cli, appDir, storeFqdn, query: SHOP_QUERY})
          expectCommandSuccess('app execute', executeResult)
          expect(executeResult.stdout + executeResult.stderr).toContain('shop')
        })
      } else {
        console.log(
          '[app-qa-flow] SKIP app dev flow and app execute: CLI auth escapes Playwright and opens the system browser',
        )
      }

      if (RUN_POST_DEV_QA_FLOW) {
        await qaStep('function build and run', async () => {
          const info = await appInfo({cli, appDir})
          const discountFunction = info.allExtensions.find(
            (extension) =>
              extension.configuration.handle === 'e2e-product-discount' ||
              extension.directory.endsWith('/extensions/e2e-product-discount'),
          )
          expect(
            discountFunction,
            `e2e-product-discount extension not found in app info. Found: ${info.allExtensions
              .map(
                (extension) =>
                  `${extension.configuration.type}:${extension.configuration.handle ?? extension.directory}`,
              )
              .join(', ')}`,
          ).toBeDefined()

          const functionDir = discountFunction!.directory
          const buildResult = await functionBuild({cli, appDir: functionDir})
          expectCommandSuccess('function build', buildResult)

          const inputPath = path.join(env.tempDir, 'discount-function-input.json')
          fs.writeFileSync(inputPath, JSON.stringify(FUNCTION_INPUT))
          const runResult = await functionRun({cli, appDir: functionDir, inputPath, json: true})
          expectCommandSuccess('function run', runResult)
        })

        await qaStep('deploy primary app and list version', async () => {
          const versionTag = `E2E-QA-v1-${Date.now()}`
          const deployResult = await deployApp({
            cli,
            appDir,
            version: versionTag,
            message: 'E2E Apps QA flow primary deployment',
          })
          expectCommandSuccess('primary deploy', deployResult)

          const listResult = await versionsList({cli, appDir})
          expectCommandSuccess('versions list', listResult)
          expect(JSON.parse(listResult.stdout)).toContainEqual(expect.objectContaining({versionTag, status: 'active'}))
        })

        const secondaryConfig = 'secondary'
        await qaStep('config link secondary app', async () => {
          const linkResult = await configLink({
            cli,
            appDir,
            appName: secondaryAppName,
            orgId: env.orgId,
            configName: secondaryConfig,
          })
          expectCommandSuccess('config link', linkResult)
          expect(linkResult.stdout + linkResult.stderr).toContain(`is now linked to "${secondaryAppName}"`)
          secondaryAppCreated = true
        })

        await qaStep('deploy secondary app and list version', async () => {
          const secondaryVersionTag = `E2E-QA-v2-${Date.now()}`
          const secondaryDeployResult = await deployApp({
            cli,
            appDir,
            config: secondaryConfig,
            version: secondaryVersionTag,
            message: 'E2E Apps QA flow secondary deployment',
          })
          expectCommandSuccess('secondary deploy', secondaryDeployResult)

          const secondaryListResult = await versionsList({cli, appDir, config: secondaryConfig})
          expectCommandSuccess('secondary versions list', secondaryListResult)
          expect(JSON.parse(secondaryListResult.stdout)).toContainEqual(
            expect.objectContaining({versionTag: secondaryVersionTag, status: 'active'}),
          )
        })
      } else {
        console.log('[app-qa-flow] SKIP post-dev function/deploy flow while debugging app dev')
      }
    } finally {
      if (!process.env.E2E_SKIP_TEARDOWN) {
        fs.rmSync(parentDir, {recursive: true, force: true})
        await qaStep('teardown primary app/store', async () => {
          await teardownAll({
            browserPage,
            appName,
            orgId: env.orgId,
            storeFqdn: needsStoreCleanup ? storeFqdn : undefined,
            workerIndex: env.workerIndex,
          })
        })
        if (secondaryAppCreated) {
          await qaStep('teardown secondary app', async () => {
            await teardownAll({
              browserPage,
              appName: secondaryAppName,
              orgId: env.orgId,
              workerIndex: env.workerIndex,
            })
          })
        }
      }
    }
  })
})
