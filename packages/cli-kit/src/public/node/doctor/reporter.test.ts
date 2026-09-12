import {initReporter, reportSuiteStart, reportTestStart, reportTestResult, reportSummary} from './reporter.js'
import {outputInfo} from '../output.js'
import {describe, expect, test, vi} from 'vitest'

vi.mock('../output.js', () => ({
  outputInfo: vi.fn(),
}))

vi.mock('../colors.js', () => ({
  default: {
    bold: (x: string) => x,
    cyan: (x: string) => x,
    dim: (x: string) => x,
    blue: (x: string) => x,
    green: (x: string) => x,
    red: (x: string) => x,
    yellow: (x: string) => x,
  },
}))

describe('reporter', () => {
  test('reportSuiteStart outputs suite name and description', () => {
    reportSuiteStart('My Suite', 'Description of My Suite')

    expect(outputInfo).toHaveBeenCalledWith('')
    expect(outputInfo).toHaveBeenCalledWith('Suite: My Suite')
    expect(outputInfo).toHaveBeenCalledWith('Description of My Suite')
  })

  test('reportTestStart outputs test name', () => {
    reportTestStart('My Test')

    expect(outputInfo).toHaveBeenCalledWith('Running: My Test')
  })

  test('reportTestResult outputs passed result with assertions', () => {
    const result = {
      name: 'Successful Test',
      status: 'passed' as const,
      duration: 1250,
      assertions: [
        {passed: true, description: 'Assert 1'},
        {passed: true, description: 'Assert 2'},
      ],
    }

    reportTestResult(result)

    expect(outputInfo).toHaveBeenCalledWith('PASSED: Successful Test (1.25s)')
    expect(outputInfo).toHaveBeenCalledWith('  [OK] Assert 1')
    expect(outputInfo).toHaveBeenCalledWith('  [OK] Assert 2')
  })

  test('reportTestResult outputs failed result without base path', () => {
    // empty/falsy base path
    initReporter('')

    const result = {
      name: 'Failing Test No Base Path',
      status: 'failed' as const,
      duration: 500,
      assertions: [],
      error: new Error('File exists: /workspace/project/src/file.ts'),
    }

    reportTestResult(result)

    expect(outputInfo).toHaveBeenCalledWith('FAILED: Failing Test No Base Path (0.50s)')
    expect(outputInfo).toHaveBeenCalledWith('  Error: File exists: /workspace/project/src/file.ts')
  })

  test('reportTestResult outputs failed result with assertions and truncated paths in error message', () => {
    initReporter('/workspace/project')

    const result = {
      name: 'Failing Test',
      status: 'failed' as const,
      duration: 500,
      assertions: [
        {passed: true, description: 'Assert 1'},
        {passed: false, description: 'Assert 2', expected: 'foo', actual: 'bar'},
      ],
      error: new Error('File exists: /workspace/project/src/file.ts'),
    }

    reportTestResult(result)

    expect(outputInfo).toHaveBeenCalledWith('FAILED: Failing Test (0.50s)')
    expect(outputInfo).toHaveBeenCalledWith('  [OK] Assert 1')
    expect(outputInfo).toHaveBeenCalledWith('  [FAIL] Assert 2 (expected: foo, actual: bar)')
    expect(outputInfo).toHaveBeenCalledWith('  Error: File exists: src/file.ts')
  })

  test('reportTestResult outputs skipped status', () => {
    const result = {
      name: 'Skipped Test',
      status: 'skipped' as const,
      duration: 0,
      assertions: [],
    }

    reportTestResult(result)

    expect(outputInfo).toHaveBeenCalledWith('SKIPPED: Skipped Test')
  })

  test('reportSummary outputs correct counts and duration when all pass', () => {
    const results = [
      {name: 'T1', status: 'passed' as const, duration: 100, assertions: []},
      {name: 'T2', status: 'passed' as const, duration: 200, assertions: []},
    ]

    reportSummary(results)

    expect(outputInfo).toHaveBeenCalledWith('Doctor Complete: 2/2 tests passed')
    expect(outputInfo).toHaveBeenCalledWith('  Passed: 2')
    expect(outputInfo).toHaveBeenCalledWith('  Failed: 0')
    expect(outputInfo).toHaveBeenCalledWith('  Total time: 0.30s')
  })

  test('reportSummary outputs correct counts and duration when some fail and some are skipped', () => {
    const results = [
      {name: 'T1', status: 'passed' as const, duration: 100, assertions: []},
      {name: 'T2', status: 'failed' as const, duration: 200, assertions: []},
      {name: 'T3', status: 'skipped' as const, duration: 0, assertions: []},
    ]

    reportSummary(results)

    expect(outputInfo).toHaveBeenCalledWith('Doctor Complete: 1/3 tests failed')
    expect(outputInfo).toHaveBeenCalledWith('  Passed: 1')
    expect(outputInfo).toHaveBeenCalledWith('  Failed: 1')
    expect(outputInfo).not.toHaveBeenCalledWith('  Skipped: 3')
    expect(outputInfo).toHaveBeenCalledWith('  Skipped: 1')
    expect(outputInfo).toHaveBeenCalledWith('  Total time: 0.30s')
  })
})
