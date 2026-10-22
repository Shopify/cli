import {authFixture} from './auth.js'
import {CLI_TIMEOUT} from './constants.js'
import {e2eRunSegment, requireEnv} from './env.js'
import {isProtectedStore, readPersistentStores} from './persistent-stores.js'
import {deleteDevStoreWithCli} from './store.js'
import {randomUUID} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import type {CLIProcess} from './cli.js'

interface TemporaryStore {
  store: string
  name: string
  type: string
  plan?: string
}

export async function findTemporaryStore({
  cli,
  orgId,
  name,
}: {
  cli: Pick<CLIProcess, 'exec'>
  orgId: string
  name: string
}): Promise<TemporaryStore | undefined> {
  if (!name.startsWith('e2e-store-')) throw new Error(`Invalid temporary store name: ${name}`)

  const result = await cli.exec(['store', 'list', '--organization-id', orgId, '--type', 'dev', '--json'], {
    timeout: CLI_TIMEOUT.short,
  })
  if (result.exitCode !== 0) {
    throw new Error(`Could not list temporary stores:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`)
  }
  const output = JSON.parse(result.stdout)
  if (output.organization?.id !== orgId || output.notice || !Array.isArray(output.stores)) {
    throw new Error(`Could not verify the store list for organization ${orgId}.`)
  }

  const matches: TemporaryStore[] = output.stores.filter((store: TemporaryStore) => store.name === name)
  if (matches.length > 1) throw new Error(`Multiple stores have the temporary name ${name}.`)
  const store = matches[0]
  if (!store) {
    if (output.truncated) throw new Error(`The store list is truncated; unable to verify whether ${name} exists.`)
    return undefined
  }

  const [domain] = readPersistentStores({E2E_STORE_FQDN: store.store})
  if (store.type !== 'dev' || !domain || isProtectedStore(domain, readPersistentStores(process.env, false))) {
    throw new Error(`Refusing to use ${store.store} as a temporary store.`)
  }
  return store
}

export async function cleanupTemporaryStore(options: {
  cli: Pick<CLIProcess, 'exec'>
  orgId: string
  name: string
  /** Wait for provisioning after a failed test before treating an absent store as unresolved cleanup. */
  creationTimeoutMs?: number
}): Promise<void> {
  const deadline = Date.now() + (options.creationTimeoutMs ?? 0)
  let store = await findTemporaryStore(options)
  while (!store && Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop
    await delay(Math.min(5000, Math.max(0, deadline - Date.now())))
    // eslint-disable-next-line no-await-in-loop
    store = await findTemporaryStore(options)
  }
  if (!store) {
    if (options.creationTimeoutMs) {
      throw new Error(`Temporary store ${options.name} did not appear before cleanup timed out; cleanup is unresolved.`)
    }
    return
  }
  const confirmed = await deleteDevStoreWithCli({...options, storeFqdn: store.store})
  if (!confirmed) throw new Error(`Deletion of temporary store ${store.store} was not confirmed.`)
}

export const temporaryStoreFixture = authFixture.extend<{temporaryStoreName: string}>({
  temporaryStoreName: [
    async ({cli, env, authLogin: _authLogin}, use, testInfo) => {
      requireEnv(env, 'orgId')
      const name = `e2e-store-${e2eRunSegment()}-${randomUUID().slice(0, 8)}`
      await testInfo.attach('temporary-store', {body: name, contentType: 'text/plain'})

      try {
        await use(name)
      } finally {
        // Creation can succeed remotely before the CLI returns its domain.
        await cleanupTemporaryStore({
          cli,
          orgId: env.orgId,
          name,
          creationTimeoutMs: testInfo.status === 'passed' ? 0 : CLI_TIMEOUT.short,
        })
      }
    },
    {timeout: CLI_TIMEOUT.store + 2 * CLI_TIMEOUT.short},
  ],
})
