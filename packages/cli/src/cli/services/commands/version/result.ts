import {versionJsonOutputSchema, type VersionResult} from './types.js'
import {outputResult} from '@shopify/cli-kit/node/output'

export function presentVersionResult(result: VersionResult, format: 'json' | 'text'): void {
  outputResult(format === 'json' ? versionJsonOutputSchema.encode(result) : result.version)
}
