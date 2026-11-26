import {themeShareJsonOutputSchema} from './types.js'
import {ThemeEnvironmentResult} from '../json-output/schema.js'
import {themePushJsonResult, renderThemePushResult} from '../push/result.js'
import {themePushResultSchema, type ThemePushResult} from '../push/types.js'
import {outputResult} from '@shopify/cli-kit/node/output'

export function renderThemeShareResult(result: ThemePushResult, format: 'text' | 'json'): void {
  if (format === 'json') {
    outputResult(themeShareJsonOutputSchema.encode(themePushJsonResult(result)))
  } else {
    renderThemePushResult(result, 'text')
  }
}

export function renderThemeShareEnvironmentResults(results: ThemeEnvironmentResult[]): void {
  const environments = results.map((entry) => {
    if ('error' in entry) return entry
    if (themePushResultSchema.safeParse(entry.result).data?.hasErrors) process.exitCode = 1
    return {...entry, result: entry.result ?? {status: 'skipped', reason: 'unsafe-directory'}}
  })
  outputResult(themeShareJsonOutputSchema.encode({environments}))
}
