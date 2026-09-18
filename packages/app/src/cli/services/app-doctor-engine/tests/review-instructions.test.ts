import {
  inCanonicalTemporaryDirectory,
  linkedConfiguration,
  makeFixtureDirectory,
  writeFixtureFile,
} from './context-test-helpers.js'
import {loadChecks} from '../checks/index.js'
import {
  buildAppDoctorReviewScopes,
  createAppDoctorContext,
  discoverAppDoctorApps,
  inspectAppDoctorConfigurations,
  selectAppDoctorApp,
  selectAppDoctorConfiguration,
} from '../index.js'
import {decodeAppDoctorReviewBinding} from '../review/binding.js'
import {buildAppDoctorInstructions} from '../review/instructions.js'
import {describe, expect, test} from 'vitest'
import {joinPath} from '@shopify/cli-kit/node/path'
import type {AppDoctorInstructionsInput} from '../review/instructions.js'
import type {AppDoctorContext, AppDoctorReviewScope} from '../index.js'

const ENGINE = {name: 'shopify-app-doctor', version: '3.99.0'}
const quote = (value: string) => `<${value}>`

async function createContext(root: string, repositoryName = 'repo'): Promise<AppDoctorContext> {
  const repository = await makeFixtureDirectory(root, repositoryName)
  await makeFixtureDirectory(repository, '.git')
  await writeFixtureFile(repository, 'packages/app/shopify.app.toml', linkedConfiguration('app-id'))
  await makeFixtureDirectory(repository, 'packages/app/web')
  await makeFixtureDirectory(repository, 'packages/app/extensions')
  const discovery = await discoverAppDoctorApps({directory: joinPath(repository, 'packages/app')})
  const configurations = await inspectAppDoctorConfigurations(selectAppDoctorApp(discovery).directory)
  const decision = selectAppDoctorConfiguration(configurations, {interactive: false})
  if (decision.type !== 'selected') throw new Error('unexpected selection-required decision')
  return createAppDoctorContext(decision.selection)
}

async function createInput(
  root: string,
  reviewDirectories?: string[],
  repositoryName?: string,
): Promise<AppDoctorInstructionsInput & {scopes: AppDoctorReviewScope[]}> {
  const context = await createContext(root, repositoryName)
  const scopes = await buildAppDoctorReviewScopes(context, {reviewDirectories, invocationDirectory: context.appRoot})
  const checks = [...loadChecks().values()].sort((left, right) => left.id.localeCompare(right.id, 'en'))
  return {context, scopes, checks, quote, engine: ENGINE}
}

describe('buildAppDoctorInstructions', () => {
  test('emits one record command per scope with distinct, decodable tokens', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const input = await createInput(root, ['web', 'extensions'])

      const instructions = buildAppDoctorInstructions(input)

      expect(instructions.scopes).toHaveLength(2)
      expect(new Set(instructions.scopes.map((scope) => scope.token)).size).toBe(2)
      instructions.scopes.forEach((scope, index) => {
        const reviewScope = input.scopes[index]!
        expect(scope.scope_identity).toBe(reviewScope.scopeIdentity)
        expect(scope.directory).toBe(reviewScope.directory)
        expect(scope.findings_path).toBe(
          joinPath(
            input.context.appRoot,
            '.shopify',
            'app-doctor',
            'review',
            `${reviewScope.scopeIdentity.slice(7, 23)}.json`,
          ),
        )
        expect(scope.record_command).toEqual({
          command: 'shopify',
          args: [
            'app',
            'doctor',
            'record',
            '--path',
            input.context.appRoot,
            '--config',
            input.context.configurationFileName,
            '--review',
            scope.token,
            '--findings',
            scope.findings_path,
          ],
        })
        expect(decodeAppDoctorReviewBinding(scope.token)).toEqual({
          version: 1,
          configuration_identity: input.context.configurationIdentity,
          scope_identity: reviewScope.scopeIdentity,
          scope: reviewScope.descriptor,
          checks: input.checks.map((check) => ({id: check.id, version: check.version, prompt_hash: check.prompt_hash})),
          engine: ENGINE,
        })
        expect(instructions.markdown).toContain(
          `shopify app doctor record --path <${input.context.appRoot}> --config <${input.context.configurationFileName}> --review <${scope.token}> --findings <${scope.findings_path}>`,
        )
      })
      expect(instructions.markdown).toContain(
        `shopify app doctor status --path <${input.context.appRoot}> --config <${input.context.configurationFileName}>`,
      )
    })
  })

  test('includes every check prompt verbatim with its provenance', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const input = await createInput(root)

      const instructions = buildAppDoctorInstructions(input)

      expect(instructions.checks).toEqual(
        input.checks.map((check) => ({
          id: check.id,
          version: check.version,
          prompt_hash: check.prompt_hash,
          prompt: check.prompt,
        })),
      )
      expect(instructions.checks.length).toBeGreaterThan(20)
      for (const check of input.checks) {
        expect(instructions.markdown).toContain(check.prompt)
        expect(instructions.markdown).toContain(check.prompt_hash)
        expect(instructions.markdown).toContain(`### ${check.id}`)
      }
    })
  })

  test('replaces every placeholder and drops the legacy scan narrative', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const input = await createInput(root)

      const {markdown} = buildAppDoctorInstructions(input)

      // Liquid `{{ setting.value }}` inside check prompts is legitimate; template placeholders are UPPER_SNAKE.
      expect(markdown).not.toMatch(/\{\{[A-Z_]+\}\}/)
      expect(markdown).not.toMatch(/review pack/i)
      expect(markdown).not.toMatch(/review\.json|trace\.json|findings\.json/)
      expect(markdown).not.toMatch(/--findings\s+\S*\.shopify\/app-doctor\/findings\.json/)
      expect(markdown).not.toMatch(/compile/i)
      expect(markdown).not.toMatch(/(?:compiled|local|final|generate an App Doctor) trace/i)
      expect(markdown).toContain('No prior `shopify app doctor` scan is required')
      expect(markdown).toContain("Recording overwrites that scope's previous agent result")
      expect(markdown).toContain('copied verbatim')
      expect(markdown).toContain('"schema_version": 1')
      expect(markdown).toContain('## Review scopes')
      expect(markdown).toContain('## Checks')
      expect(markdown).toMatch(/^## Scope$/m)
      expect(markdown.endsWith('\n')).toBe(false)
    })
  })

  test('is deterministic for the same input', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const input = await createInput(root, ['web', '.'])

      const first = buildAppDoctorInstructions(input)
      const second = buildAppDoctorInstructions({...input, checks: [...input.checks].reverse()})

      expect(second).toEqual(first)
    })
  })

  test('quotes values with the injected quote function only', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const input = await createInput(root)
      const upper = buildAppDoctorInstructions({...input, quote: (value) => `"${value.toUpperCase()}"`})

      expect(upper.markdown).toContain(`--path "${input.context.appRoot.toUpperCase()}"`)
      expect(upper.scopes[0]!.record_command.args).toContain(input.context.appRoot)
    })
  })

  test('quotes every path value, including ones with shell-significant characters', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const input = await createInput(root, undefined, 'my $repo dir')
      const {appRoot} = input.context

      const {markdown, scopes} = buildAppDoctorInstructions(input)

      expect(appRoot).toContain('my $repo dir')
      expect(markdown).toContain(`--path <${appRoot}>`)
      expect(markdown).toContain(`--findings <${scopes[0]!.findings_path}>`)
      expect(markdown).not.toContain(`--path ${appRoot}`)
      expect(markdown).not.toContain(`--findings ${scopes[0]!.findings_path}`)
    })
  })

  test('describes the app-root scope and nested scopes', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const input = await createInput(root, ['.', 'web'])

      const {markdown} = buildAppDoctorInstructions(input)

      expect(markdown).toContain('### Scope 1 of 2')
      expect(markdown).toContain('### Scope 2 of 2')
      expect(markdown).toContain(`Directory: \`${input.context.appRoot}\` (the app root)`)
      expect(markdown).toContain(`Directory: \`${joinPath(input.context.appRoot, 'web')}\` (inside the app)`)
    })
  })
})
