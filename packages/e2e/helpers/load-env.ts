/* eslint-disable no-restricted-imports */
import * as fs from 'fs'
import * as path from 'path'
import {fileURLToPath} from 'url'

/**
 * Load a .env file into process.env (without overwriting existing values).
 * Handles quotes and inline comments (e.g. "VALUE # comment" → "VALUE").
 */
export function loadEnv(dirOrUrl: string): void {
  const dir = dirOrUrl.startsWith('file://') ? path.dirname(fileURLToPath(dirOrUrl)) : dirOrUrl
  const envPath = path.join(dir, '.env')
  if (!fs.existsSync(envPath)) return

  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let value = trimmed.slice(eqIdx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    } else {
      const commentIdx = value.indexOf(' #')
      if (commentIdx !== -1) value = value.slice(0, commentIdx).trim()
    }
    process.env[key] ??= value
  }
}
