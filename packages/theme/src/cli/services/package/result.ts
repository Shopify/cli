import {themePackageJsonOutputSchema, type ThemePackageResult} from './types.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {relativizePath} from '@shopify/cli-kit/node/path'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
// Native JSON paths must preserve Windows separators instead of pathe normalization.
// eslint-disable-next-line no-restricted-imports
import {resolve as resolvePath} from 'node:path'

export function renderThemePackageResult(result: ThemePackageResult, format: 'text' | 'json'): void {
  if (format === 'json') {
    outputResult(themePackageJsonOutputSchema.encode({...result, path: resolvePath(result.path)}))
    return
  }

  renderSuccess({body: ['Your local theme was packaged in', {filePath: relativizePath(result.path)}]})
}
