import {REPORT_COMPONENT_NAMES, reportCatalog, reportComponentDefinitions} from './catalog.js'
import {describe, expect, test} from 'vitest'

describe('reportCatalog', () => {
  test('contains exactly the closed display-only component set and no actions', () => {
    expect(reportCatalog.componentNames).toEqual(REPORT_COMPONENT_NAMES)
    expect(Object.keys(reportComponentDefinitions)).toEqual(REPORT_COMPONENT_NAMES)
    expect(reportCatalog.actionNames).toEqual([])
  })
})
