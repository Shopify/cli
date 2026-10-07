import {REACT_ROUTER_TEMPLATE_FILES, REACT_ROUTER_TEMPLATE_REF} from './fixtures/react-router-template.js'
import {git, isolateGitConfig} from './git-test-helpers.js'
import {scanAppDirectory} from './scan-directory.js'
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'
import {afterEach, beforeEach, describe, expect, test} from 'vitest'

let restoreGitConfig: (() => void) | undefined
beforeEach(() => {
  restoreGitConfig = isolateGitConfig()
})
afterEach(() => {
  restoreGitConfig?.()
})

/** Writes the template and initializes Git the way `shopify app init` does, without a commit. */
async function writeTemplate(appDirectory: string): Promise<void> {
  await Promise.all(
    Object.entries(REACT_ROUTER_TEMPLATE_FILES).map(async ([path, content]) => {
      const filePath = joinPath(appDirectory, path)
      await mkdir(dirname(filePath))
      await writeFile(filePath, content)
    }),
  )
  git(appDirectory, ['init', '-q'])
  git(appDirectory, ['checkout', '-q', '-b', 'main'])
}

describe(`fresh React Router app template (${REACT_ROUTER_TEMPLATE_REF.slice(0, 7)})`, () => {
  /**
   * A fresh `shopify app init` app must not raise deterministic findings beyond these two, which the template ships
   * on purpose: its compliance webhook subscriptions are commented out ("for public apps only") and `app init`
   * removes the template's `.github` directory, including its Dependabot configuration. Adding a deterministic
   * check means deciding its status for this app too.
   */
  test('has only the expected deterministic findings and no unresolved checks', async () => {
    await inTemporaryDirectory(async (appDirectory) => {
      await writeTemplate(appDirectory)

      const {deterministicFindings} = await scanAppDirectory(appDirectory)

      expect(deterministicFindings.detection).toMatchObject({framework: 'react_router', surface: 'react_router'})
      expect(deterministicFindings.coverage.files_skipped).toEqual([])
      expect(deterministicFindings.coverage.gaps).toEqual([])
      expect(
        Object.fromEntries(
          deterministicFindings.checks.map((check) => [
            check.id,
            {status: check.status, findings: check.findings.map((finding) => finding.location.file)},
          ]),
        ),
      ).toEqual({
        APP_PROXY_LIQUID_INJECTION: {status: 'not_applicable', findings: []},
        COMMITTED_SECRET: {status: 'executed', findings: []},
        CREDENTIAL_BROWSER_LEAKAGE: {status: 'executed', findings: []},
        CREDENTIAL_LOG_LEAKAGE: {status: 'executed', findings: []},
        DEPRECATED_SCRIPT_TAG_SCOPE: {status: 'executed', findings: []},
        EOL_API_VERSION: {status: 'executed', findings: []},
        EXPIRING_OFFLINE_TOKEN: {status: 'executed', findings: []},
        INSECURE_WEBHOOK_URL: {status: 'executed', findings: []},
        LIQUID_UNSAFE_RENDER: {status: 'not_applicable', findings: []},
        MISSING_COMPLIANCE_WEBHOOKS: {status: 'executed', findings: ['shopify.app.toml']},
        MISSING_DEPENDENCY_SECURITY_AUTOMATION: {status: 'executed', findings: ['package.json']},
        REQUEST_CONTROLLED_ADMIN_CONTEXT: {status: 'executed', findings: []},
        STATIC_FRAME_ANCESTORS: {status: 'executed', findings: []},
        UNAUTHENTICATED_ENDPOINT: {status: 'executed', findings: []},
        UNSAFE_INNERHTML: {status: 'executed', findings: []},
      })
    })
  })
})
