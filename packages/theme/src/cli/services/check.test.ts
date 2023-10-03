import {
  formatOffenses,
  sortOffenses,
  formatSummary,
  renderOffensesText,
  formatOffensesJson,
  handleExit,
} from './check.js'
import {expect, describe, afterAll, vi, Mock, beforeEach, test, SpyInstance} from 'vitest'
import {Offense, Severity, SourceCodeType, Theme} from '@shopify/theme-check-common'
import {renderError, renderWarning} from '@shopify/cli-kit/node/ui'
import fs from 'fs'

vi.mock('fs', async () => {
  const actual: any = await vi.importActual('fs')
  return {
    default: {
      ...actual,
      readFileSync: vi.fn(),
    },
  }
})

vi.mock('@shopify/cli-kit/node/ui', async () => ({
  renderError: vi.fn(),
  renderWarning: vi.fn(),
}))

describe('formatOffenses', () => {
  beforeEach(() => {
    const readFileMock = fs.readFileSync as Mock
    readFileMock.mockReturnValue('Line1\nLine2\nLine3')
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  test('should format offenses correctly', () => {
    const offenses: Offense[] = [
      {
        type: SourceCodeType.LiquidHtml,
        check: 'LiquidHTMLSyntaxError',
        message: 'Attempting to close HtmlElement',
        absolutePath: '/path/to/file',
        severity: Severity.ERROR,
        start: {index: 0, line: 1, character: 0},
        end: {index: 10, line: 1, character: 10},
      },
    ]

    const result = formatOffenses(offenses)

    /**
     * Line numbers are 0-indexed to remain backwards compatible with the ruby theme-check output
     * Thats why given line:1 in the offense, we expect the second mocked line in the final output
     */
    expect(result).toEqual([{bold: '\nL1:'}, 'LiquidHTMLSyntaxError\nAttempting to close HtmlElement\n\nLine2\n\n'])
  })

  test('should format multiple offenses correctly', () => {
    const offenses: Offense[] = [
      {
        type: SourceCodeType.LiquidHtml,
        check: 'LiquidHTMLSyntaxError',
        message: 'Attempting to close HtmlElement',
        absolutePath: '/path/to/file',
        severity: Severity.ERROR,
        start: {index: 0, line: 1, character: 0},
        end: {index: 10, line: 1, character: 10},
      },
      {
        type: SourceCodeType.LiquidHtml,
        check: 'LiquidHTMLSyntaxError',
        message: 'Attempting to close HtmlElement',
        absolutePath: '/path/to/file',
        severity: Severity.WARNING,
        start: {index: 0, line: 2, character: 0},
        end: {index: 10, line: 2, character: 10},
      },
    ]

    const result = formatOffenses(offenses)

    expect(result).toEqual([
      {bold: '\nL1:'},
      'LiquidHTMLSyntaxError\nAttempting to close HtmlElement\n\nLine2\n\n',
      {bold: '\nL2:'},
      'LiquidHTMLSyntaxError\nAttempting to close HtmlElement\n\nLine3\n\n',
    ])
  })
})

describe('sortOffenses', () => {
  test('should sort offenses by file path', () => {
    const offenses: Offense[] = [
      {
        type: SourceCodeType.LiquidHtml,
        check: 'LiquidHTMLSyntaxError',
        message: 'Attempting to close HtmlElement',
        absolutePath: '/path/to/file2',
        severity: Severity.ERROR,
        start: {index: 0, line: 1, character: 0},
        end: {index: 10, line: 1, character: 10},
      },
      {
        type: SourceCodeType.LiquidHtml,
        check: 'LiquidHTMLSyntaxError',
        message: 'Attempting to close HtmlElement',
        absolutePath: '/path/to/file1',
        severity: Severity.WARNING,
        start: {index: 0, line: 1, character: 0},
        end: {index: 10, line: 1, character: 10},
      },
    ]

    const result = sortOffenses(offenses)

    expect(result).toEqual({
      '/path/to/file1': [offenses[1]],
      '/path/to/file2': [offenses[0]],
    })
  })

  test('should sort offenses by severity within each file', () => {
    const offenses: Offense[] = [
      {
        type: SourceCodeType.LiquidHtml,
        check: 'LiquidHTMLSyntaxError',
        message: 'Attempting to close HtmlElement',
        absolutePath: '/path/to/file',
        severity: Severity.WARNING,
        start: {index: 0, line: 1, character: 0},
        end: {index: 10, line: 1, character: 10},
      },
      {
        type: SourceCodeType.LiquidHtml,
        check: 'LiquidHTMLSyntaxError',
        message: 'Attempting to close HtmlElement',
        absolutePath: '/path/to/file',
        severity: Severity.ERROR,
        start: {index: 0, line: 2, character: 0},
        end: {index: 10, line: 2, character: 10},
      },
    ]

    const result = sortOffenses(offenses)

    expect(result).toEqual({
      '/path/to/file': [offenses[1], offenses[0]],
    })
  })
})

describe('formatSummary', () => {
  test('should format summary correctly when no offenses found', () => {
    const offenses: Offense[] = []
    const theme: unknown = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

    const result = formatSummary(offenses, theme as Theme)

    expect(result).toEqual(['10 files inspected', 'with no offenses found.'])
  })

  test('should format summary correctly when offenses found', () => {
    const offenses: Offense[] = [
      {
        type: SourceCodeType.LiquidHtml,
        check: 'LiquidHTMLSyntaxError',
        message: 'Attempting to close HtmlElement',
        absolutePath: '/path/to/file',
        severity: Severity.ERROR,
        start: {index: 0, line: 1, character: 0},
        end: {index: 10, line: 1, character: 10},
      },
      {
        type: SourceCodeType.LiquidHtml,
        check: 'LiquidHTMLSyntaxError',
        message: 'Attempting to close HtmlElement',
        absolutePath: '/path/to/file',
        severity: Severity.WARNING,
        start: {index: 0, line: 2, character: 0},
        end: {index: 10, line: 2, character: 10},
      },
    ]
    const theme: unknown = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

    const result = formatSummary(offenses, theme as Theme)

    expect(result).toEqual(['10 files inspected', 'with 2 total offenses found.', '\n1 errors.', '\n1 suggestions.'])
  })
})

describe('renderOffensesText', () => {
  beforeEach(() => {
    const readFileMock = fs.readFileSync as Mock
    readFileMock.mockReturnValue('Line1\nLine2\nLine3')
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  test('should call renderError for offenses with severity ERROR', () => {
    const offensesByFile = {
      '/path/to/file': [
        {
          type: SourceCodeType.LiquidHtml,
          check: 'LiquidHTMLSyntaxError',
          message: 'Attempting to close HtmlElement',
          absolutePath: '/path/to/file',
          severity: Severity.ERROR,
          start: {index: 0, line: 1, character: 0},
          end: {index: 10, line: 1, character: 10},
        },
      ],
    }
    const themeRootPath = '/path/to'

    renderOffensesText(offensesByFile, themeRootPath)

    expect(renderError).toHaveBeenCalledTimes(1)
    expect(renderWarning).toHaveBeenCalledTimes(0)
  })

  test('should call renderWarning for offenses with severity WARNING or INFO', () => {
    const offensesByFile = {
      '/path/to/file': [
        {
          type: SourceCodeType.LiquidHtml,
          check: 'LiquidHTMLSyntaxError',
          message: 'Attempting to close HtmlElement',
          absolutePath: '/path/to/file',
          severity: Severity.WARNING,
          start: {index: 0, line: 1, character: 0},
          end: {index: 10, line: 1, character: 10},
        },
      ],
    }
    const themeRootPath = '/path/to'

    renderOffensesText(offensesByFile, themeRootPath)

    expect(renderError).toHaveBeenCalledTimes(0)
    expect(renderWarning).toHaveBeenCalledTimes(1)
  })
})
describe('formatOffensesJson', () => {
  test('should format offenses into JSON correctly', () => {
    const offensesByFile = {
      '/path/to/file': [
        {
          type: SourceCodeType.LiquidHtml,
          check: 'LiquidHTMLSyntaxError',
          message: 'Attempting to close HtmlElement',
          absolutePath: '/path/to/file',
          severity: Severity.ERROR,
          start: {index: 0, line: 1, character: 0},
          end: {index: 10, line: 1, character: 10},
        },
        {
          type: SourceCodeType.LiquidHtml,
          check: 'LiquidHTMLSyntaxError',
          message: 'Attempting to close HtmlElement',
          absolutePath: '/path/to/file',
          severity: Severity.WARNING,
          start: {index: 0, line: 2, character: 0},
          end: {index: 10, line: 2, character: 10},
        },
      ],
    }

    const result = formatOffensesJson(offensesByFile)

    expect(result).toEqual([
      {
        path: '/path/to/file',
        offenses: [
          {
            check: 'LiquidHTMLSyntaxError',
            severity: Severity.ERROR,
            start_row: 1,
            start_column: 0,
            end_row: 1,
            end_column: 10,
            message: 'Attempting to close HtmlElement',
          },
          {
            check: 'LiquidHTMLSyntaxError',
            severity: Severity.WARNING,
            start_row: 2,
            start_column: 0,
            end_row: 2,
            end_column: 10,
            message: 'Attempting to close HtmlElement',
          },
        ],
        errorCount: 1,
        suggestionCount: 1,
        styleCount: 0,
      },
    ])
  })
})

describe('handleExit', () => {
  let exitSpy: SpyInstance

  beforeEach(() => {
    // Create a spy on process.exit
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(vi.fn())
  })

  afterAll(() => {
    // Restore the original process.exit function after each test
    exitSpy.mockRestore()
  })

  test('should exit with 0 when no fail level is set', () => {
    const offenses: Offense[] = []
    handleExit(offenses)
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  test('should exit with 1 when offenses severity is less than fail level', () => {
    const offenses: Offense[] = [
      {
        type: SourceCodeType.LiquidHtml,
        check: 'LiquidHTMLSyntaxError',
        message: 'Attempting to close HtmlElement',
        absolutePath: '/path/to/file',
        severity: Severity.ERROR,
        start: {index: 0, line: 1, character: 0},
        end: {index: 10, line: 1, character: 10},
      },
    ]
    handleExit(offenses, 'suggestion')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  test('should exit with 0 when offenses severity is not less than fail level', () => {
    const offenses: Offense[] = [
      {
        type: SourceCodeType.LiquidHtml,
        check: 'LiquidHTMLSyntaxError',
        message: 'Attempting to close HtmlElement',
        absolutePath: '/path/to/file',
        severity: Severity.ERROR,
        start: {index: 0, line: 1, character: 0},
        end: {index: 10, line: 1, character: 10},
      },
    ]
    handleExit(offenses, 'error')
    expect(exitSpy).toHaveBeenCalledWith(0)
  })
})
