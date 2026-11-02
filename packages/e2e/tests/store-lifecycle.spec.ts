import {temporaryStoreFixture as test, findTemporaryStore} from '../setup/temporary-store.js'
import {CLI_TIMEOUT} from '../setup/constants.js'
import {deleteDevStoreWithCli} from '../setup/store.js'
import {expect} from '@playwright/test'

test('creates and deletes a development store through the CLI', async ({cli, env, temporaryStoreName}) => {
  test.setTimeout(2 * CLI_TIMEOUT.store + 2 * CLI_TIMEOUT.short)

  const result = await cli.exec(
    [
      'store',
      'create',
      'dev',
      '--name',
      temporaryStoreName,
      '--organization-id',
      env.orgId,
      '--plan',
      'basic',
      '--country',
      'US',
      '--no-demo-data',
      '--json',
    ],
    {timeout: CLI_TIMEOUT.store},
  )
  expect(result.exitCode, `Store creation failed:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0)
  const created = JSON.parse(result.stdout)
  expect(created).toMatchObject({
    store: {
      name: temporaryStoreName,
      domain: expect.stringMatching(/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/),
      plan: 'basic',
      country: 'US',
      demoData: false,
    },
    organization: {id: env.orgId},
  })

  const findStore = () => findTemporaryStore({cli, orgId: env.orgId, name: temporaryStoreName})
  await expect.poll(findStore, {timeout: CLI_TIMEOUT.short, intervals: [5000]}).toMatchObject({
    store: created.store.domain,
    name: temporaryStoreName,
    type: 'dev',
    plan: 'basic',
  })

  const confirmed = await deleteDevStoreWithCli({cli, orgId: env.orgId, storeFqdn: created.store.domain})
  expect(confirmed, 'The CLI must confirm deletion, not only accept the request.').toBe(true)
  await expect.poll(findStore, {timeout: CLI_TIMEOUT.short, intervals: [5000]}).toBeUndefined()
})
