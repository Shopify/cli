import {defineThemeJsonOutputSchema} from '../json-output/schema.js'
import {zod} from '@shopify/cli-kit/node/schema'
import {isAbsolutePath, resolvePath} from '@shopify/cli-kit/node/path'

const ThemeCheckIssueSchema = zod
  .object({
    filePath: zod.string().refine(isAbsolutePath).describe('The absolute native path of the file.'),
    check: zod.string(),
    severity: zod.enum(['error', 'warning', 'info']),
    startRow: zod.number().int().nonnegative().describe('The zero-based starting line.'),
    startColumn: zod.number().int().nonnegative().describe('The zero-based starting column.'),
    endRow: zod.number().int().nonnegative().describe('The zero-based ending line.'),
    endColumn: zod.number().int().nonnegative().describe('The zero-based ending column.'),
    message: zod.string(),
  })
  .strict()

const ThemeCheckResultSchema = zod
  .object({
    valid: zod.boolean().describe('Whether the validation passes the selected blocking policy.'),
    issues: zod.array(ThemeCheckIssueSchema),
    errorCount: zod.number().int().nonnegative(),
    warningCount: zod.number().int().nonnegative(),
    infoCount: zod.number().int().nonnegative(),
  })
  .strict()

/** The Theme Check service model used by text rendering and compatibility callers. */
export type ThemeCheckResult = {
  environment?: string
  path: string
  offenses: {
    check: string
    severity: 'error' | 'warning' | 'info'
    start_row: number
    start_column: number
    end_row: number
    end_column: number
    message: string
  }[]
  errorCount: number
  warningCount: number
  infoCount: number
}[]

export const themeCheckJsonOutputSchema = defineThemeJsonOutputSchema({
  name: 'ThemeCheckResult',
  schema: ThemeCheckResultSchema,
  definitions: {ThemeCheckIssue: ThemeCheckIssueSchema},
  project: (value) => {
    const {files, valid} = Array.isArray(value)
      ? {files: value as ThemeCheckResult, valid: undefined}
      : (value as {files: ThemeCheckResult; valid: boolean})
    return {
      valid: valid ?? files.every((file) => file.errorCount === 0),
      issues: files.flatMap((file) =>
        file.offenses.map((offense) => ({
          filePath: resolvePath(file.path),
          check: offense.check,
          severity: offense.severity,
          startRow: offense.start_row,
          startColumn: offense.start_column,
          endRow: offense.end_row,
          endColumn: offense.end_column,
          message: offense.message,
        })),
      ),
      errorCount: files.reduce((count, file) => count + file.errorCount, 0),
      warningCount: files.reduce((count, file) => count + file.warningCount, 0),
      infoCount: files.reduce((count, file) => count + file.infoCount, 0),
    }
  },
})
