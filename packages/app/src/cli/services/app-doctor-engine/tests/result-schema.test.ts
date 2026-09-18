import {agentResultInput, scopeDescriptor, staticResultInput, VOLUME_TOKEN} from './fixtures/result-contract.js'
import {
  formatAppDoctorEvidencePath,
  isAppDoctorEvidencePath,
  parseAppDoctorScopeDescriptor,
  AppDoctorPathReferenceSchema,
} from '../results/scope.js'
import {AppDoctorResultInputSchema, AppDoctorResultSchema, CHECK_ID_PATTERN} from '../results/schema.js'
import {loadChecks} from '../checks/index.js'
import {createAppDoctorResult} from '../results/index.js'
import {isBoundedJson} from '../results/json.js'
import {describe, expect, test} from 'vitest'
import type {AppDoctorPathReference} from '../results/scope.js'

const anchor = (path: string, up = 0): AppDoctorPathReference => ({base: 'storage_anchor', up, path})
const volume = (path: string): AppDoctorPathReference => ({base: 'external_volume', volume_token: VOLUME_TOKEN, path})

const acceptsPath = (path: string) => AppDoctorPathReferenceSchema.safeParse(anchor(path)).success

describe('bounded JSON preflight', () => {
  test('accepts finite plain JSON values', () => {
    expect(isBoundedJson({items: [1, 'two', null, true, {ratio: 0.5}]})).toBe(true)
    expect(isBoundedJson(Object.create(null))).toBe(true)
  })

  test('rejects undefined, non-finite numbers, class instances, functions, and cycles', () => {
    expect(isBoundedJson(undefined)).toBe(false)
    expect(isBoundedJson({value: undefined})).toBe(false)
    expect(isBoundedJson({value: Number.POSITIVE_INFINITY})).toBe(false)
    expect(isBoundedJson({value: Number.NaN})).toBe(false)
    expect(isBoundedJson(new Date())).toBe(false)
    expect(isBoundedJson(new Map())).toBe(false)
    expect(isBoundedJson({value: () => 1})).toBe(false)
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(isBoundedJson(cyclic)).toBe(false)
  })

  test('rejects structures beyond the depth limit', () => {
    let deep: unknown = 'leaf'
    for (let level = 0; level < 200; level++) deep = [deep]
    expect(isBoundedJson(deep)).toBe(false)
  })
})

describe('reference-v1 path references', () => {
  test('accepts canonical percent-encoded components and the root marker', () => {
    expect(acceptsPath('.')).toBe(true)
    expect(acceptsPath('app/routes/webhooks.tsx')).toBe(true)
    expect(acceptsPath('app/with%20space/file%20name.ts')).toBe(true)
    expect(acceptsPath('app/back%5Cslash.ts')).toBe(true)
    expect(acceptsPath('app/routes/%5Bid%5D.tsx')).toBe(true)
    expect(acceptsPath('app/100%25.ts')).toBe(true)
    expect(acceptsPath('app/*.ts')).toBe(true)
    expect(acceptsPath('app/caf%C3%A9.ts')).toBe(true)
  })

  test('rejects non-canonical encodings', () => {
    // encodeURIComponent leaves `*` and `.` unescaped, so escaped forms are not canonical.
    expect(acceptsPath('app/%2A.ts')).toBe(false)
    expect(acceptsPath('app/routes%2Ffile.ts')).toBe(false)
    expect(acceptsPath('app/%2E%2E/file.ts')).toBe(false)
    expect(acceptsPath('app/caf%c3%a9.ts')).toBe(false)
    expect(acceptsPath('app/bad%zz.ts')).toBe(false)
    expect(acceptsPath('app/raw space.ts')).toBe(false)
  })

  test('rejects empty, dot, dot-dot, separator, and control-character components', () => {
    expect(acceptsPath('')).toBe(false)
    expect(acceptsPath('app//file.ts')).toBe(false)
    expect(acceptsPath('app/')).toBe(false)
    expect(acceptsPath('./app')).toBe(false)
    expect(acceptsPath('app/./file.ts')).toBe(false)
    expect(acceptsPath('../app')).toBe(false)
    expect(acceptsPath('app/../file.ts')).toBe(false)
    expect(acceptsPath('app\\file.ts')).toBe(false)
    expect(acceptsPath('app/file%00.ts')).toBe(false)
    expect(acceptsPath('app/file%0A.ts')).toBe(false)
    expect(acceptsPath('app/file%7F.ts')).toBe(false)
  })

  test('rejects absolute paths, drive letters, and UNC authorities', () => {
    expect(acceptsPath('/app/file.ts')).toBe(false)
    expect(acceptsPath('C:/app/file.ts')).toBe(false)
    expect(acceptsPath('C%3A/app/file.ts')).toBe(false)
    expect(acceptsPath('C%3A%5Capp%5Cfile.ts')).toBe(false)
    expect(acceptsPath('//server/share/file.ts')).toBe(false)
    expect(acceptsPath('%5C%5Cserver/share/file.ts')).toBe(false)
  })

  test('rejects components that redaction would rewrite', () => {
    expect(acceptsPath(`app/shpat_${'a'.repeat(32)}.ts`)).toBe(false)
  })

  test('validates reference bases', () => {
    expect(AppDoctorPathReferenceSchema.safeParse(anchor('app', 2)).success).toBe(true)
    expect(AppDoctorPathReferenceSchema.safeParse(anchor('app', -1)).success).toBe(false)
    expect(AppDoctorPathReferenceSchema.safeParse(anchor('app', 1.5)).success).toBe(false)
    expect(AppDoctorPathReferenceSchema.safeParse(volume('app')).success).toBe(true)
    expect(AppDoctorPathReferenceSchema.safeParse({...volume('app'), volume_token: 'sha256:abc'}).success).toBe(false)
    expect(AppDoctorPathReferenceSchema.safeParse({...anchor('app'), volume_token: VOLUME_TOKEN}).success).toBe(false)
    expect(AppDoctorPathReferenceSchema.safeParse({base: 'cwd', path: 'app'}).success).toBe(false)
  })
})

describe('evidence paths', () => {
  test('formats anchor and volume references with canonical decimal up', () => {
    expect(formatAppDoctorEvidencePath(anchor('app/file.ts'))).toBe('anchor/0/app/file.ts')
    expect(formatAppDoctorEvidencePath(anchor('app/file.ts', 3))).toBe('anchor/3/app/file.ts')
    expect(formatAppDoctorEvidencePath(anchor('.', 2), 'file.ts')).toBe('anchor/2/file.ts')
    expect(formatAppDoctorEvidencePath(anchor('app'), 'routes/file.ts')).toBe('anchor/0/app/routes/file.ts')
    expect(formatAppDoctorEvidencePath(volume('src/index.ts'))).toBe(`volume/${'b'.repeat(64)}/src/index.ts`)
  })

  test('rejects formatting a bare directory, an invalid reference, or an invalid file', () => {
    expect(() => formatAppDoctorEvidencePath(anchor('.'))).toThrow('Invalid App Doctor file reference')
    expect(() => formatAppDoctorEvidencePath(anchor('../app'))).toThrow('Invalid App Doctor file reference')
    expect(() => formatAppDoctorEvidencePath(anchor('app'), '.')).toThrow('Invalid App Doctor file reference')
    expect(() => formatAppDoctorEvidencePath(anchor('app'), '../x.ts')).toThrow('Invalid App Doctor file reference')
    expect(() => formatAppDoctorEvidencePath(anchor('app'), '/x.ts')).toThrow('Invalid App Doctor file reference')
  })

  test('validates evidence path strings', () => {
    expect(isAppDoctorEvidencePath('anchor/0/app/file.ts')).toBe(true)
    expect(isAppDoctorEvidencePath('anchor/12/file.ts')).toBe(true)
    expect(isAppDoctorEvidencePath(`volume/${'0'.repeat(64)}/file.ts`)).toBe(true)
    expect(isAppDoctorEvidencePath('anchor/00/file.ts')).toBe(false)
    expect(isAppDoctorEvidencePath('anchor/+0/file.ts')).toBe(false)
    expect(isAppDoctorEvidencePath('anchor/-1/file.ts')).toBe(false)
    expect(isAppDoctorEvidencePath('anchor/1e3/file.ts')).toBe(false)
    expect(isAppDoctorEvidencePath('anchor/0/.')).toBe(false)
    expect(isAppDoctorEvidencePath('anchor/0')).toBe(false)
    expect(isAppDoctorEvidencePath('anchor/0/')).toBe(false)
    expect(isAppDoctorEvidencePath(`volume/${'B'.repeat(64)}/file.ts`)).toBe(false)
    expect(isAppDoctorEvidencePath(`volume/sha256:${'b'.repeat(64)}/file.ts`)).toBe(false)
    expect(isAppDoctorEvidencePath('cwd/0/file.ts')).toBe(false)
    expect(isAppDoctorEvidencePath('app/file.ts')).toBe(false)
    expect(isAppDoctorEvidencePath('anchor/0/app\\file.ts')).toBe(false)
    expect(isAppDoctorEvidencePath('/anchor/0/file.ts')).toBe(false)
  })
})

describe('scope descriptor', () => {
  test('accepts a consistent in-app descriptor', () => {
    const parsed = parseAppDoctorScopeDescriptor(scopeDescriptor())
    expect(parsed.ok).toBe(true)
  })

  test('rejects wrong or missing descriptor version and unknown fields', () => {
    expect(parseAppDoctorScopeDescriptor({...scopeDescriptor(), descriptor_version: 2}).ok).toBe(false)
    const {descriptor_version: _version, ...withoutVersion} = scopeDescriptor()
    expect(parseAppDoctorScopeDescriptor(withoutVersion).ok).toBe(false)
    expect(parseAppDoctorScopeDescriptor({...scopeDescriptor(), label: 'my app'}).ok).toBe(false)
    expect(parseAppDoctorScopeDescriptor({...scopeDescriptor(), boundary: {app: 'inside'}}).ok).toBe(false)
    expect(parseAppDoctorScopeDescriptor(null).ok).toBe(false)
    expect(parseAppDoctorScopeDescriptor('descriptor').ok).toBe(false)
  })

  test('requires app_directory and selected_config to be in-anchor references', () => {
    expect(parseAppDoctorScopeDescriptor({...scopeDescriptor(), app_directory: anchor('.', 1)}).ok).toBe(false)
    expect(parseAppDoctorScopeDescriptor({...scopeDescriptor(), app_directory: volume('.')}).ok).toBe(false)
    expect(parseAppDoctorScopeDescriptor({...scopeDescriptor(), selected_config: anchor('.')}).ok).toBe(false)
    expect(parseAppDoctorScopeDescriptor({...scopeDescriptor(), selected_config: anchor('a.toml', 1)}).ok).toBe(false)
  })

  test('checks boundary classification against the references', () => {
    const inside = scopeDescriptor()
    expect(parseAppDoctorScopeDescriptor({...inside, boundary: {app: 'outside', anchor: 'inside'}}).ok).toBe(false)
    expect(parseAppDoctorScopeDescriptor({...inside, boundary: {app: 'inside', anchor: 'outside'}}).ok).toBe(false)

    const subdirectory = {...scopeDescriptor(), directory: anchor('extensions/theme')}
    expect(parseAppDoctorScopeDescriptor(subdirectory).ok).toBe(true)

    const nestedApp = {...scopeDescriptor(), app_directory: anchor('apps/storefront')}
    expect(parseAppDoctorScopeDescriptor({...nestedApp, directory: anchor('apps/storefront')}).ok).toBe(true)
    expect(parseAppDoctorScopeDescriptor({...nestedApp, directory: anchor('apps/storefront/web')}).ok).toBe(true)
    // Prefix matching is by component, not by string: `apps/storefront-legacy` is outside the app.
    expect(parseAppDoctorScopeDescriptor({...nestedApp, directory: anchor('apps/storefront-legacy')}).ok).toBe(false)
    expect(
      parseAppDoctorScopeDescriptor({
        ...nestedApp,
        directory: anchor('apps/storefront-legacy'),
        boundary: {app: 'outside', anchor: 'inside'},
      }).ok,
    ).toBe(true)
    expect(
      parseAppDoctorScopeDescriptor({
        ...nestedApp,
        directory: anchor('.'),
        boundary: {app: 'outside', anchor: 'inside'},
      }).ok,
    ).toBe(true)

    const parent = {...scopeDescriptor(), directory: anchor('.', 1)}
    expect(parseAppDoctorScopeDescriptor(parent).ok).toBe(false)
    expect(parseAppDoctorScopeDescriptor({...parent, boundary: {app: 'outside', anchor: 'outside'}}).ok).toBe(true)
    expect(parseAppDoctorScopeDescriptor({...parent, boundary: {app: 'inside', anchor: 'outside'}}).ok).toBe(false)

    const external = {...scopeDescriptor(), directory: volume('.')}
    expect(parseAppDoctorScopeDescriptor(external).ok).toBe(false)
    expect(parseAppDoctorScopeDescriptor({...external, boundary: {app: 'outside', anchor: 'outside'}}).ok).toBe(true)
  })

  test('validates exclusion metadata and entries', () => {
    const descriptor = scopeDescriptor()
    expect(
      parseAppDoctorScopeDescriptor({...descriptor, exclusions: {...descriptor.exclusions, semantics: 'glob-v1'}}).ok,
    ).toBe(false)
    expect(
      parseAppDoctorScopeDescriptor({...descriptor, exclusions: {...descriptor.exclusions, entries: ['node_modules']}})
        .ok,
    ).toBe(false)
    expect(
      parseAppDoctorScopeDescriptor({...descriptor, exclusions: {...descriptor.exclusions, entries: [anchor('../x')]}})
        .ok,
    ).toBe(false)
    expect(
      parseAppDoctorScopeDescriptor({...descriptor, exclusions: {...descriptor.exclusions, entries: [volume('dist')]}})
        .ok,
    ).toBe(true)
  })

  test('errors are fixed text that never echo input values', () => {
    const secret = `shpat_${'f'.repeat(32)}`
    const parsed = parseAppDoctorScopeDescriptor({...scopeDescriptor(), [secret]: true, directory: anchor(secret)})
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.errors.length).toBeGreaterThan(0)
    expect(parsed.errors.join('\n')).not.toContain(secret)
  })
})

describe('result envelope schemas', () => {
  test('accepts representative static and agent stored results', () => {
    expect(AppDoctorResultSchema.safeParse(createAppDoctorResult(staticResultInput())).success).toBe(true)
    expect(AppDoctorResultSchema.safeParse(createAppDoctorResult(agentResultInput())).success).toBe(true)
  })

  test('rejects unknown fields at every level', () => {
    const stored = createAppDoctorResult(staticResultInput())
    expect(AppDoctorResultSchema.safeParse({...stored, extra: 1}).success).toBe(false)
    expect(AppDoctorResultSchema.safeParse({...stored, engine: {...stored.engine, extra: 1}}).success).toBe(false)
    expect(AppDoctorResultSchema.safeParse({...stored, execution: {...stored.execution, extra: 1}}).success).toBe(false)
    expect(AppDoctorResultSchema.safeParse({...stored, findings: [{...stored.findings[0], extra: 1}]}).success).toBe(
      false,
    )
    expect(
      AppDoctorResultSchema.safeParse({
        ...stored,
        findings: [{...stored.findings[0], location: {...stored.findings[0]!.location, extra: 1}}],
      }).success,
    ).toBe(false)
    expect(
      AppDoctorResultSchema.safeParse({
        ...stored,
        scope: {...stored.scope, directory: {...stored.scope.directory, x: 1}},
      }).success,
    ).toBe(false)
  })

  test('rejects wrong versions and missing descriptor', () => {
    const stored = createAppDoctorResult(staticResultInput())
    expect(AppDoctorResultSchema.safeParse({...stored, schema_version: 2}).success).toBe(false)
    expect(AppDoctorResultSchema.safeParse({...stored, diagnostic_paths: 'reference-v2'}).success).toBe(false)
    expect(AppDoctorResultSchema.safeParse({...stored, scope: {...stored.scope, descriptor_version: 2}}).success).toBe(
      false,
    )
    const {scope: _scope, ...withoutScope} = stored
    expect(AppDoctorResultSchema.safeParse(withoutScope).success).toBe(false)
    expect(AppDoctorResultSchema.safeParse({...stored, check_version: 0}).success).toBe(false)
  })

  test('input schema refuses stored-only fields', () => {
    const stored = createAppDoctorResult(staticResultInput())
    expect(AppDoctorResultInputSchema.safeParse(staticResultInput()).success).toBe(true)
    expect(AppDoctorResultInputSchema.safeParse(agentResultInput()).success).toBe(true)
    expect(AppDoctorResultInputSchema.safeParse(stored).success).toBe(false)
    const input = staticResultInput()
    expect(
      AppDoctorResultInputSchema.safeParse({...input, findings: [{...input.findings[0], fingerprint: 'sha256:x'}]})
        .success,
    ).toBe(false)
    expect(
      AppDoctorResultInputSchema.safeParse({
        ...input,
        findings: [{...input.findings[0], key: {namespace: 'diagnostic-v1', value: `sha256:${'0'.repeat(64)}`}}],
      }).success,
    ).toBe(false)
    expect(
      AppDoctorResultInputSchema.safeParse({
        ...input,
        findings: [{...input.findings[0], key: {namespace: 'semantic-v1', value: 'route:webhooks'}}],
      }).success,
    ).toBe(true)
  })

  test('mode-specific fields are exclusive', () => {
    const staticInput = staticResultInput()
    const agentInput = agentResultInput()
    if (staticInput.mode !== 'static' || agentInput.mode !== 'agent') throw new Error('fixture modes')
    expect(AppDoctorResultInputSchema.safeParse({...agentInput, coverage: staticInput.coverage}).success).toBe(false)
    expect(AppDoctorResultInputSchema.safeParse({...agentInput, required: true}).success).toBe(false)
    expect(AppDoctorResultInputSchema.safeParse({...agentInput, applicable: true}).success).toBe(false)
    expect(
      AppDoctorResultInputSchema.safeParse({...agentInput, implementations: staticInput.implementations}).success,
    ).toBe(false)
    expect(AppDoctorResultInputSchema.safeParse({...staticInput, prompt: 'x', prompt_hash: 'y'}).success).toBe(false)
    expect(
      AppDoctorResultInputSchema.safeParse({
        ...staticInput,
        execution: {...staticInput.execution, analysis_mode: 'agent'},
      }).success,
    ).toBe(false)
    expect(
      AppDoctorResultInputSchema.safeParse({
        ...agentInput,
        execution: {...agentInput.execution, analysis_mode: 'regex'},
      }).success,
    ).toBe(false)
    const {guidance: _guidance, ...withoutGuidance} = agentInput.execution
    expect(AppDoctorResultInputSchema.safeParse({...agentInput, execution: withoutGuidance}).success).toBe(false)
    const {prompt: _prompt, ...withoutPrompt} = agentInput
    expect(AppDoctorResultInputSchema.safeParse(withoutPrompt).success).toBe(false)
  })

  test('pins the owner identity formats the store layout depends on', () => {
    const input = staticResultInput()
    const accepts = (patch: Partial<typeof input>) => AppDoctorResultInputSchema.safeParse({...input, ...patch}).success
    expect(accepts({configuration_identity: 'f'.repeat(32)})).toBe(true)
    expect(accepts({configuration_identity: `prefixed-${'f'.repeat(64)}`})).toBe(false)
    expect(accepts({configuration_identity: 'f'.repeat(64)})).toBe(false)
    expect(accepts({configuration_identity: 'F'.repeat(32)})).toBe(false)
    expect(accepts({scope_identity: `sha256:${'0'.repeat(64)}`})).toBe(true)
    expect(accepts({scope_identity: 'scope-a'})).toBe(false)
    expect(accepts({scope_identity: '0'.repeat(64)})).toBe(false)
    expect(accepts({check_id: 'A'})).toBe(true)
    expect(accepts({check_id: `A${'0'.repeat(63)}`})).toBe(true)
    expect(accepts({check_id: `A${'0'.repeat(64)}`})).toBe(false)
    expect(accepts({check_id: 'check_a'})).toBe(false)
    expect(accepts({check_id: '1CHECK'})).toBe(false)
    expect(accepts({check_id: 'CHECK-A'})).toBe(false)
    expect(accepts({check_id: ''})).toBe(false)
  })

  test('accepts every check id in the real catalogue', () => {
    const ids = [...loadChecks().keys()]
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) {
      expect(id).toMatch(CHECK_ID_PATTERN)
    }
  })

  test('validates scalar formats', () => {
    const input = staticResultInput()
    expect(AppDoctorResultInputSchema.safeParse({...input, produced_at: '2026-09-16T12:00:00Z'}).success).toBe(false)
    expect(AppDoctorResultInputSchema.safeParse({...input, produced_at: 'yesterday'}).success).toBe(false)
    expect(AppDoctorResultInputSchema.safeParse({...input, configuration_identity: '   '}).success).toBe(false)
    expect(AppDoctorResultInputSchema.safeParse({...input, configuration_identity: ' padded '}).success).toBe(false)
    expect(AppDoctorResultInputSchema.safeParse({...input, engine: {...input.engine, name: 'other'}}).success).toBe(
      false,
    )
    expect(
      AppDoctorResultInputSchema.safeParse({...input, findings: [{...input.findings[0], severity: 'critical'}]})
        .success,
    ).toBe(false)
    expect(
      AppDoctorResultInputSchema.safeParse({...input, findings: [{...input.findings[0], points: Number.NaN}]}).success,
    ).toBe(false)
    expect(
      AppDoctorResultInputSchema.safeParse({
        ...input,
        findings: [{...input.findings[0], location: {file: 'app/file.ts', line: 1}}],
      }).success,
    ).toBe(false)
    expect(
      AppDoctorResultInputSchema.safeParse({
        ...input,
        findings: [{...input.findings[0], location: {file: 'anchor/0/app/file.ts', line: 0}}],
      }).success,
    ).toBe(false)
  })
})
