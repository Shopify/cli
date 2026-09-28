import {themePackageJsonOutputSchema, type ThemePackageResult} from './types.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {relativizePath} from '@shopify/cli-kit/node/path'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

export function renderThemePackageResult(result: ThemePackageResult, format: 'text' | 'json'): void {
  if (format === 'json') {
    outputResult(themePackageJsonOutputSchema.encode(result))
    return
  }

  renderSuccess({body: ['Your local theme was packaged in', {filePath: relativizePath(result.path)}]})
}
