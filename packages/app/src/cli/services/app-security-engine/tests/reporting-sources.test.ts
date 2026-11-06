import {getRegistry, reportingSourcesByCheckId} from '../registry/index.js'
import {describe, expect, test, vi} from 'vitest'
import type * as Scanners from '../scanners/index.js'

// A planned deterministic implementation of SQL_INJECTION, which only an agent check reports today. Planned checks
// have no runner, so they report nothing.
vi.mock('../scanners/index.js', async (importOriginal) => {
  const scanners = await importOriginal<typeof Scanners>()
  const {loadChecks} = await import('../checks/index.js')
  const planned: Scanners.DeterministicCheckDefinition = {
    id: 'SQL_INJECTION',
    version: loadChecks().get('SQL_INJECTION')!.version,
    lifecycle: 'planned',
    analysisMode: 'regex',
    target: 'source',
  }
  return {...scanners, DETERMINISTIC_CHECKS: new Map([...scanners.DETERMINISTIC_CHECKS, [planned.id, planned]])}
})

describe('reportingSourcesByCheckId', () => {
  test('leaves out implementations that are not active', () => {
    const registered = getRegistry().filter((entry) => entry.id === 'SQL_INJECTION')
    expect(registered.map(({kind, status}) => ({kind, status}))).toEqual([
      {kind: 'agent', status: 'active'},
      {kind: 'deterministic', status: 'planned'},
    ])

    expect(reportingSourcesByCheckId().get('SQL_INJECTION')).toEqual(new Set(['agent']))
  })
})
