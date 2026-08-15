import {exec, expectSuccess} from '../proc.js'
import type {SectionDef} from '../types.js'

/** Pull the semver out of `shopify version` output (it may be followed by an upgrade-notice box). */
export function extractVersion(stdout: string): string {
  const match = stdout.match(/^\s*(\d+\.\d+\.\d+(?:-[\w.]+)?)\s*$/m)
  return match?.[1] ?? stdout.trim().split('\n')[0]?.trim() ?? ''
}

export const prepSection: SectionDef = {
  title: 'Preparation',
  steps: [
    {
      id: 'prep.release',
      doc: 'Make a nightly release before starting the QA flow',
      kind: 'manual',
      reason: 'CI provides the artifact under test (repo build on CI runs, published nightly on manual runs)',
    },
    {
      id: 'prep.version',
      doc: 'Run `shopify version`, the version should match the nightly you just created',
      kind: 'auto',
      run: async (ctx) => {
        const result = expectSuccess(await exec(ctx, ['version'], {timeoutMs: 60_000}), 'shopify version')
        const observed = extractVersion(result.stdout)
        if (ctx.expectedVersion && observed !== ctx.expectedVersion) {
          throw new Error(`Expected version ${ctx.expectedVersion}, got ${observed}`)
        }
        return `version ${observed}${ctx.expectedVersion ? ' (matches expected)' : ''}`
      },
    },
    {
      id: 'prep.review-changes',
      doc: 'Review the changes in the new release and take detours in the QA steps to exercise them',
      kind: 'manual',
      reason: 'human judgement — review the Version Packages PR',
    },
  ],
}

export const generalSection: SectionDef = {
  title: 'General',
  steps: [
    {
      id: 'general.lockdown',
      doc: 'Turn off Shopify Lockdown (blocks adhoc-signed binaries via AMFI, used by functions)',
      kind: 'manual',
      reason: 'not applicable on CI runners (no Shopify Lockdown installed); required only on Shopify-issued Macs',
    },
  ],
}
