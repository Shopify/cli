/* eslint-disable @nx/enforce-module-boundaries -- see app-management-api.ts */
/**
 * Subprocess entrypoint: print an App Management API token for the CLI
 * session in this process's XDG dirs, as JSON on stdout.
 *
 * Runs under tsx (see app-management-api.ts) because importing cli-kit's dist
 * inside Playwright's transpiled harness crashes Node's require(esm) path on
 * the Node versions CI uses ("Unexpected module status 3"). tsx's loader
 * handles the ESM/CJS interop, which is also why the cleanup scripts import
 * cli-kit this way without issues.
 */
import {ensureAuthenticatedAppManagementAndBusinessPlatform} from '../../cli-kit/dist/public/node/session.js'

const forceRefresh = process.argv.includes('--force-refresh')

const {appManagementToken} = await ensureAuthenticatedAppManagementAndBusinessPlatform({
  noPrompt: true,
  forceRefresh,
})
process.stdout.write(JSON.stringify({token: appManagementToken}))
