import {withDevInstanceStartupLock} from './dev-instance-lock.js'
import {inTemporaryDirectory, mkdir, readFile, writeFile, fileExists} from '../../public/node/fs.js'
import {joinPath} from '../../public/node/path.js'
import {randomUUID} from '../../public/node/crypto.js'
import {expect, test} from 'vitest'

test('only one contender enters startup after recovery itself has crashed', async () => {
  await inTemporaryDirectory(async (directory) => {
    const lockFile = joinPath(directory, 'dev.lock')
    const abandonedOwners = [randomUUID(), randomUUID()]
    const claims = [`${lockFile}.acquire`, `${lockFile}.${abandonedOwners[0]}.acquire`]
    await Promise.all(
      claims.map(async (claim, index) => {
        await mkdir(claim)
        await writeFile(
          joinPath(claim, 'owner.json'),
          JSON.stringify({pid: 2 ** 22 + 12345, sessionId: abandonedOwners[index]}),
        )
      }),
    )
    const entered: number[] = []
    let release: () => void = () => {}
    const stopped = new Promise<void>((resolve) => {
      release = resolve
    })
    const attempts = Array.from({length: 8}, (_, index) =>
      withDevInstanceStartupLock(lockFile, async () => {
        entered.push(index)
        await stopped
      }),
    )
    try {
      // All but the owner must settle while startup is still held.
      let rejected = 0
      const refused = attempts.map((attempt) =>
        attempt.catch((error: NodeJS.ErrnoException) => {
          expect(error.code).toBe('ELOCKED')
          rejected++
        }),
      )
      await expect.poll(() => rejected).toBe(7)
      expect(entered).toHaveLength(1)
      release()
      await Promise.all(refused)
      await expect(Promise.all(claims.map((claim) => fileExists(claim)))).resolves.toEqual([false, false])
      await expect(withDevInstanceStartupLock(lockFile, async () => 'restarted')).resolves.toBe('restarted')
    } finally {
      release()
      await Promise.allSettled(attempts)
    }
  })
})

test('keeps a live startup claim and releases its own claim when startup fails', async () => {
  await inTemporaryDirectory(async (directory) => {
    const lockFile = joinPath(directory, 'dev.lock')
    await expect(
      withDevInstanceStartupLock(lockFile, async () => {
        const owner = await readFile(joinPath(`${lockFile}.acquire`, 'owner.json'))
        await expect(withDevInstanceStartupLock(lockFile, async () => {})).rejects.toMatchObject({code: 'ELOCKED'})
        await expect(readFile(joinPath(`${lockFile}.acquire`, 'owner.json'))).resolves.toBe(owner)
        throw new Error('Startup failed')
      }),
    ).rejects.toThrow('Startup failed')
    await expect(withDevInstanceStartupLock(lockFile, async () => 'restarted')).resolves.toBe('restarted')
  })
})
