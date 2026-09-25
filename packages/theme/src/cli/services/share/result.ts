import {themeShareJsonOutputSchema, type ThemeShareResult} from './types.js'
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

export function renderThemeShareEnvironmentResults(results: {environment: string; result: unknown}[]): void {
  const output: ThemeShareResult = results.flatMap(({environment, result}) =>
    result === undefined
      ? []
      : [{...themePushJsonResult({...themePushResultSchema.parse(result), environment}), environment}],
  )
  outputResult(themeShareJsonOutputSchema.encode(output))
}
