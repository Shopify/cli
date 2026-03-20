/* eslint-disable no-restricted-imports */
/**
 * Playwright global teardown — runs once after all tests finish (pass or fail).
 *
 * Logs in once, then in a single browser session:
 * - Uninstalls + deletes fresh test apps (QA-E2E-1st-*, QA-E2E-2nd-*)
 * - Uninstalls (but keeps) pre-existing apps (QA-E2E-1st, QA-E2E-2nd)
 */

import {loadEnv} from '../helpers/load-env.js'
import * as path from 'path'
import {fileURLToPath} from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
loadEnv(path.join(__dirname, '..'))

export default async function globalTeardown() {
  if (!process.env.E2E_ACCOUNT_EMAIL || !process.env.E2E_ACCOUNT_PASSWORD) {
    process.stderr.write('\n[teardown] Skipping app cleanup: E2E_ACCOUNT_EMAIL and E2E_ACCOUNT_PASSWORD are not set.\n')
    return
  }

  process.stdout.write('\n[teardown] Cleaning up test apps...\n')

  const {execa} = await import('execa')
  const cleanupScript = path.join(__dirname, '../scripts/cleanup-test-apps.ts')

  try {
    await execa(
      'npx',
      [
        'tsx',
        cleanupScript,
        '--delete',
        'QA-E2E-1st-',
        '--delete',
        'QA-E2E-2nd-',
        '--uninstall',
        'QA-E2E-1st',
        '--uninstall',
        'QA-E2E-2nd',
      ],
      {stdio: 'inherit', env: process.env},
    )
    process.stdout.write('[teardown] App cleanup done.\n')
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (err) {
    process.stderr.write(`[teardown] App cleanup incomplete (non-fatal): ${err}\n`)
    process.stderr.write('           Delete leftover apps manually from https://dev.shopify.com/dashboard\n')
  }
}
