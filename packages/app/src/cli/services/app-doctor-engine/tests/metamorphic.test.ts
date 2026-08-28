/* eslint-disable id-length, no-restricted-imports -- low-level scanner fixtures use Node paths and paired short aliases */
import {scan} from '../index.js'
import {scanRequestDerivedShopScope} from '../rules/request-scope-rules.js'
import {scanMissingTenantIsolation} from '../rules/tenant-rules.js'
import {scopeOverRequest} from '../rules/config-rules.js'
import {findAppTomls, findExtensions, findManifests, findAppSourceFiles} from '../scanners/discover.js'
import {detectCapabilities} from '../capabilities/detect.js'
import {describe, expect, afterAll, test} from 'vitest'
import {join, dirname} from 'node:path'
import {tmpdir} from 'node:os'
import {mkdtempSync, writeFileSync, rmSync, mkdirSync} from 'node:fs'
import type {ScanContext} from '../rules/types.js'
import type {Issue} from '../types.js'

/**
 * Metamorphic testing for scanner rules.
 *
 * Ground-truth fixtures only catch rules that miss a known vulnerability or
 * fire on a known-clean app. They cannot catch a rule that gets the right
 * answer for the wrong reason — which is how both false positives found so
 * far got through:
 *
 *   mcp-app  inferred "scope unused" from an empty evidence corpus
 *   Flow     inferred "value is request-tainted" from a name match across
 *            two different method scopes
 *
 * Metamorphic relations test the *reasoning* instead of the answer. Each
 * relation transforms an input in a way whose effect on the output is known
 * a priori, then asserts it. A violation means the rule depends on something
 * it shouldn't — no ground truth required, so these generalise to rules that
 * don't exist yet.
 */

const tempDirs: string[] = []
afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, {recursive: true, force: true})
})

const APP_TOML = `
name = "mr-app"
client_id = "abc123"
application_url = "https://example.com"

[access_scopes]
scopes = "read_orders"

[webhooks]
api_version = "2025-01"
`

const makeApp = (files: Record<string, string>): string => {
  const dir = mkdtempSync(join(tmpdir(), 'app-doctor-mr-'))
  tempDirs.push(dir)
  writeFileSync(join(dir, 'shopify.app.toml'), APP_TOML)
  for (const [name, content] of Object.entries(files)) {
    const full = join(dir, name)
    mkdirSync(dirname(full), {recursive: true})
    writeFileSync(full, content)
  }
  return dir
}

/** Findings reduced to rule + location, so line shifts are visible but noise isn't. */
const fingerprint = (issues: Issue[]): string[] => issues.map((i) => `${i.id}@${i.location.file}`).sort()

/** Findings reduced to rule id counts, ignoring position entirely. */
const countByRule = (issues: Issue[]): Record<string, number> => {
  const counts: Record<string, number> = {}
  for (const i of issues) counts[i.id] = (counts[i.id] ?? 0) + 1
  return counts
}

const scanFiles = async (files: Record<string, string>) => {
  const dir = makeApp(files)
  const staticResult = await scan(dir)
  // Also run semantic rules directly — scan() filters them out of the trace,
  // but metamorphic relations test the rules themselves, not the trace.
  const sourceFiles = findAppSourceFiles(dir)
  const semantic = [...scanRequestDerivedShopScope(sourceFiles), ...scanMissingTenantIsolation(sourceFiles)]
  return [...staticResult.issues, ...semantic]
}

/** Run scopeOverRequest directly on a directory (scan() filters it out now). */
const scopeOverRequestIssues = (dir: string) => {
  const appTomls = findAppTomls(dir)
  const extensions = findExtensions(dir)
  const sourceFiles = findAppSourceFiles(dir)
  const manifests = findManifests(dir)
  const appToml = appTomls[0] ?? null
  const capabilities = detectCapabilities(appToml, extensions, sourceFiles)
  const ctx: ScanContext = {
    appRoot: dir,
    appToml,
    extensions,
    sourceFiles,
    manifests,
    capabilities,
  }
  return scopeOverRequest.check(ctx)
}

// ---------------------------------------------------------------------------
// The Rails controller that exposed the scope bug, used as the primary probe.
// ---------------------------------------------------------------------------

const controller = (paramName: string) => `
class TokensController < ApplicationController
  def update_cookie
    shop_id = params[:shop_id]
    cookies.signed[:shop_id] = shop_id
  end

  def save_access_token(${paramName}, access_token)
    row = Token.find_or_initialize_by(shop_id: ${paramName}, app: app_type)
    row.save!
  end
end
`

describe('metamorphic: α-renaming invariance', () => {
  /**
   * Consistently renaming a variable cannot change whether code is
   * vulnerable. If findings differ, the rule matched a name rather than a
   * data flow.
   *
   * This is the relation that catches the Flow bug: with a file-global
   * binding map, `save_access_token(shop_id, ...)` was flagged only because
   * an unrelated method assigned a variable of the same name. Rename the
   * parameter and the finding vanishes — proving the match was a name
   * coincidence.
   */
  test('renaming a method parameter does not change findings', async () => {
    const original = await scanFiles({
      'app/controllers/tokens_controller.rb': controller('shop_id'),
    })
    const renamed = await scanFiles({
      'app/controllers/tokens_controller.rb': controller('sid'),
    })

    expect(countByRule(renamed)).toEqual(countByRule(original))
  })

  test('renaming a genuinely tainted local does not change findings', async () => {
    const base = (name: string) => `
class TokensController < ApplicationController
  def destroy
    ${name} = params[:shop_id]
    Token.where(shop_id: ${name}).delete_all
  end
end
`
    const a = await scanFiles({
      'app/controllers/t_controller.rb': base('shop_id'),
    })
    const b = await scanFiles({
      'app/controllers/t_controller.rb': base('target'),
    })

    expect(countByRule(b)).toEqual(countByRule(a))
    // And the finding must actually be present — the relation is only
    // meaningful if the rule fires at all.
    expect(countByRule(a).REQUEST_DERIVED_SHOP_SCOPE).toBe(1)
  })
})

describe('metamorphic: locality', () => {
  /**
   * Adding unrelated code must not change findings elsewhere. A rule that
   * leaks state across scopes or across files violates this.
   */
  test('an unrelated method does not create findings in another method', async () => {
    const withoutNeighbour = `
class TokensController < ApplicationController
  def save_access_token(shop_id, access_token)
    row = Token.find_or_initialize_by(shop_id: shop_id, app: app_type)
    row.save!
  end
end
`
    const withNeighbour = `
class TokensController < ApplicationController
  def unrelated
    shop_id = params[:shop_id]
    Rails.logger.info(shop_id)
  end

  def save_access_token(shop_id, access_token)
    row = Token.find_or_initialize_by(shop_id: shop_id, app: app_type)
    row.save!
  end
end
`
    const before = await scanFiles({
      'app/controllers/a_controller.rb': withoutNeighbour,
    })
    const after = await scanFiles({
      'app/controllers/a_controller.rb': withNeighbour,
    })

    expect(countByRule(after)).toEqual(countByRule(before))
  })

  test('a second unrelated file does not change findings in the first', async () => {
    const target = `
class TokensController < ApplicationController
  def destroy
    Token.where(shop_id: params[:shop_id]).delete_all
  end
end
`
    const alone = await scanFiles({
      'app/controllers/a_controller.rb': target,
    })
    const withOther = await scanFiles({
      'app/controllers/a_controller.rb': target,
      'app/controllers/b_controller.rb': `
class OtherController < ApplicationController
  def index
    render json: {}
  end
end
`,
    })

    // Compare only findings located in the shared file. Config-level rules
    // report against shopify.app.toml and legitimately see a wider corpus.
    const inTarget = (issues: Issue[]) => issues.filter((i) => i.location.file.includes('a_controller'))
    expect(countByRule(inTarget(withOther))).toEqual(countByRule(inTarget(alone)))
  })
})

describe('metamorphic: position invariance', () => {
  /** Shifting code down the file changes line numbers, never verdicts. */
  test('leading padding does not change which rules fire', async () => {
    const body = `
class TokensController < ApplicationController
  def destroy
    Token.where(shop_id: params[:shop_id]).delete_all
  end
end
`
    const plain = await scanFiles({'app/controllers/a_controller.rb': body})
    const padded = await scanFiles({
      'app/controllers/a_controller.rb': `# frozen_string_literal: true\n#\n#\n#\n${body}`,
    })

    expect(countByRule(padded)).toEqual(countByRule(plain))
    expect(fingerprint(padded)).toEqual(fingerprint(plain))
  })
})

describe('metamorphic: comment neutrality', () => {
  /**
   * Commented-out code is not executable, so it cannot be vulnerable.
   * A rule that fires on comments is pattern-matching text, not code.
   */
  test('commenting out the vulnerable line removes the finding', async () => {
    const live = `
class TokensController < ApplicationController
  def destroy
    Token.where(shop_id: params[:shop_id]).delete_all
  end
end
`
    const commented = `
class TokensController < ApplicationController
  def destroy
    # Token.where(shop_id: params[:shop_id]).delete_all
  end
end
`
    const a = countByRule(await scanFiles({'app/controllers/a_controller.rb': live}))
    const b = countByRule(await scanFiles({'app/controllers/a_controller.rb': commented}))

    expect(a.REQUEST_DERIVED_SHOP_SCOPE).toBe(1)
    expect(b.REQUEST_DERIVED_SHOP_SCOPE ?? 0).toBe(0)
  })
})

describe('metamorphic: negative-inference safety', () => {
  /**
   * Rules that conclude something from ABSENCE must have an evidence corpus
   * to be absent from. With zero source files, "X is never referenced" is
   * vacuously true for every X — which is exactly how mcp-app produced 29
   * false positives.
   *
   * Generalised: scanning a config-only app must not produce findings that
   * depend on searching code.
   */
  test('a config-only app produces no absence-derived findings', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'app-doctor-mr-'))
    tempDirs.push(dir)
    writeFileSync(
      join(dir, 'shopify.app.toml'),
      `
name = "config-only"
client_id = "abc123"
application_url = "https://example.com"

[access_scopes]
scopes = "read_orders,read_customers,read_analytics,read_reports"

[webhooks]
api_version = "2025-01"
`,
    )
    const result = await scan(dir)

    expect(result.scan.files_scanned).toBe(0)

    // Any rule whose verdict is "not found in the code" must abstain here.
    const absenceDerived = ['SCOPE_OVER_REQUEST', 'MISSING_COMPLIANCE_WEBHOOKS']
    for (const ruleId of absenceDerived) {
      const fired = result.issues.filter((i) => i.id === ruleId)
      expect(fired, `${ruleId} fired with zero files scanned — it inferred absence from an empty corpus`).toHaveLength(
        0,
      )
    }
  })

  test('adding code that uses a scope removes the over-request finding', async () => {
    const toml = `
name = "mr-app"
client_id = "abc123"
application_url = "https://example.com"

[access_scopes]
scopes = "read_orders,read_analytics"

[webhooks]
api_version = "2025-01"
`
    const dirA = mkdtempSync(join(tmpdir(), 'app-doctor-mr-'))
    tempDirs.push(dirA)
    writeFileSync(join(dirA, 'shopify.app.toml'), toml)
    writeFileSync(join(dirA, 'server.js'), 'const a = 1;')
    const before = countByRule(scopeOverRequestIssues(dirA))

    const dirB = mkdtempSync(join(tmpdir(), 'app-doctor-mr-'))
    tempDirs.push(dirB)
    writeFileSync(join(dirB, 'shopify.app.toml'), toml)
    writeFileSync(join(dirB, 'server.js'), 'const a = 1; // uses read_analytics reporting')
    const after = countByRule(scopeOverRequestIssues(dirB))

    // Referencing the scope must reduce, never increase, the finding count.
    expect(after.SCOPE_OVER_REQUEST ?? 0).toBeLessThan(before.SCOPE_OVER_REQUEST ?? 0)
  })
})

describe('metamorphic: duplication linearity', () => {
  /**
   * Two copies of the same vulnerable file contain two instances of the
   * vulnerability — not one (deduped away) and not three (double-counted).
   */
  test('duplicating a vulnerable file doubles the findings', async () => {
    const body = `
class TokensController < ApplicationController
  def destroy
    Token.where(shop_id: params[:shop_id]).delete_all
  end
end
`
    const single = countByRule(await scanFiles({'app/controllers/a_controller.rb': body}))
    const doubled = countByRule(
      await scanFiles({
        'app/controllers/a_controller.rb': body,
        'app/controllers/b_controller.rb': body.replace('TokensController', 'TokensTwoController'),
      }),
    )

    expect(doubled.REQUEST_DERIVED_SHOP_SCOPE).toBe((single.REQUEST_DERIVED_SHOP_SCOPE ?? 0) * 2)
  })
})
