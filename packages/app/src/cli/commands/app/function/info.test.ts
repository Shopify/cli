import FunctionInfo from './info.js'
import {describe, expect, test} from 'vitest'

describe('FunctionInfo', () => {
  test('includes the JSON result type in its help description', () => {
    expect(FunctionInfo.descriptionWithMarkdown).toContain(
      'With `--json`, the command returns `FunctionInfoResult`, described by these TypeScript types:',
    )
    expect(FunctionInfo.descriptionWithMarkdown).toContain('targeting: Record<string, FunctionTargeting>')
  })
})
