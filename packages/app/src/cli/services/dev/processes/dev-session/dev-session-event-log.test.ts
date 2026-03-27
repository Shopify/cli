import {DevSessionEventLog} from './dev-session-event-log.js'
import {inTemporaryDirectory, readFile, fileExists, rmdir} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, test, expect} from 'vitest'

describe('DevSessionEventLog', () => {
  test('init creates the event log file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const eventLog = new DevSessionEventLog(tmpDir)
      await eventLog.init()

      const exists = await fileExists(joinPath(tmpDir, '.shopify', 'dev-session-events.jsonl'))
      expect(exists).toBe(true)
    })
  })

  test('init truncates existing file', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const eventLog = new DevSessionEventLog(tmpDir)
      await eventLog.init()
      await eventLog.write({event: 'test-event'})

      // Re-init should truncate
      await eventLog.init()
      const content = await readFile(eventLog.path)
      expect(content).toBe('')
    })
  })

  test('write appends JSONL lines', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const eventLog = new DevSessionEventLog(tmpDir)
      await eventLog.init()

      await eventLog.write({event: 'first'})
      await eventLog.write({event: 'second', extra: 'data'})

      const content = await readFile(eventLog.path)
      const lines = content.trim().split('\n')
      expect(lines).toHaveLength(2)

      const first = JSON.parse(lines[0]!)
      expect(first.event).toBe('first')
      expect(first.ts).toBeDefined()

      const second = JSON.parse(lines[1]!)
      expect(second.event).toBe('second')
      expect(second.extra).toBe('data')
    })
  })

  test('write is a no-op before init', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const eventLog = new DevSessionEventLog(tmpDir)

      // Should not throw
      await eventLog.write({event: 'ignored'})

      const exists = await fileExists(joinPath(tmpDir, '.shopify', 'dev-session-events.jsonl'))
      expect(exists).toBe(false)
    })
  })

  test('path returns the expected file path', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const eventLog = new DevSessionEventLog(tmpDir)
      expect(eventLog.path).toBe(joinPath(tmpDir, '.shopify', 'dev-session-events.jsonl'))
    })
  })

  test('concurrent writes produce valid JSONL', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const eventLog = new DevSessionEventLog(tmpDir)
      await eventLog.init()

      await Promise.all([
        eventLog.write({event: 'event1', data: 'a'}),
        eventLog.write({event: 'event2', data: 'b'}),
        eventLog.write({event: 'event3', data: 'c'}),
      ])

      const content = await readFile(eventLog.path)
      const lines = content.trim().split('\n')
      expect(lines).toHaveLength(3)
      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow()
      }
    })
  })

  test('write rejects when file is deleted', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const eventLog = new DevSessionEventLog(tmpDir)
      await eventLog.init()

      await rmdir(joinPath(tmpDir, '.shopify'), {force: true})

      await expect(eventLog.write({event: 'test'})).rejects.toThrow()
    })
  })
})
