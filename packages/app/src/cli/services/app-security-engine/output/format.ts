import {redactText} from '../rules/secret-rules.js'
import type {ScanResult} from '../types.js'

export function formatJson(result: ScanResult): string {
  return JSON.stringify(result, (_key, value) => (typeof value === 'string' ? redactText(value) : value), 2)
}
