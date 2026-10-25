import {executeBuildThemeStep} from './build-theme-step.js'
import {runThemeCheck} from '../theme-check.js'
import {findOutboundOrigins} from '../../../utilities/extensions/theme-egress.js'
import {BuildContext, LifecycleStep} from '../client-steps.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {dirname, joinPath} from '@shopify/cli-kit/node/path'

vi.mock('../theme-check.js')
vi.mock('../../../utilities/extensions/theme-egress.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../utilities/extensions/theme-egress.js')>()
  return {...original, findOutboundOrigins: vi.fn(original.findOutboundOrigins)}
})

const step: LifecycleStep = {id: 'build-theme', name: 'Build Theme Extension', type: 'build_theme', config: {}}

const FILES = {
  'blocks/app.liquid': `<script src="https://api.example.com/app.js"></script>
<script src="https://cdn.other.example.net/lib.js"></script>
<img src="https://cdn.other.example.net/pixel.gif">
<link rel="stylesheet" href="{{ 'app.css' | asset_url }}">`,
  'assets/app.js': `fetch('http://legacy.example.com/collect')\nfetch(endpoint)\nnew WebSocket('wss://live.example.org/socket')`,
  'assets/app.css': `.hero { background: url(https://img.example.org/hero.png); }`,
}

async function writeExtension(directory: string, files: {[path: string]: string}) {
  await Promise.all(
    Object.entries(files).map(async ([path, content]) => {
      const fullPath = joinPath(directory, path)
      await mkdir(dirname(fullPath))
      await writeFile(fullPath, content)
    }),
  )
}

function contextFor(directory: string, capabilities?: object) {
  const write = vi.fn()
  const context = {
    extension: {directory, configuration: {name: 'Theme', type: 'theme', capabilities}} as unknown as ExtensionInstance,
    options: {stdout: {write} as any, stderr: {write: vi.fn()} as any, app: {} as any, environment: 'production'},
    stepResults: new Map(),
  } as BuildContext
  return {context, output: () => write.mock.calls.map(([chunk]) => chunk).join('')}
}

describe('executeBuildThemeStep', () => {
  beforeEach(() => {
    vi.mocked(runThemeCheck).mockResolvedValue('')
  })

  test('warns about each undeclared origin when allowed_sources is declared', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeExtension(directory, FILES)
      const {context, output} = contextFor(directory, {
        network_access: {allowed_sources: ['https://api.example.com']},
      })

      await executeBuildThemeStep(step, context)

      expect(output()).toBe(`Running theme check on your Theme app extension...
[warning]: https://img.example.org (assets/app.css:1) isn't in allowed_sources.
[warning]: http://legacy.example.com (assets/app.js:1) uses an insecure scheme. allowed_sources accepts only HTTPS origins.
[warning]: wss://live.example.org (assets/app.js:3) isn't in allowed_sources. Declare it as https://live.example.org.
[warning]: https://cdn.other.example.net (blocks/app.liquid:2 and 1 more) isn't in allowed_sources.
Add the origins your extension needs to capabilities.network_access.allowed_sources in shopify.extension.toml. Requests to undeclared origins may be blocked on storefronts in the future.
[info]: 1 URL is built at runtime and can't be checked (assets/app.js:2).`)
    })
  })

  test('prints one info line when allowed_sources is not declared', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeExtension(directory, FILES)
      const {context, output} = contextFor(directory)

      await executeBuildThemeStep(step, context)

      expect(output()).toBe(`Running theme check on your Theme app extension...
[info]: This extension contacts 5 external origins. Consider declaring them in capabilities.network_access.allowed_sources in shopify.extension.toml.`)
    })
  })

  test('prints nothing more when every origin is declared', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeExtension(directory, {'blocks/app.liquid': FILES['blocks/app.liquid']})
      const {context, output} = contextFor(directory, {
        network_access: {allowed_sources: ['https://api.example.com', 'https://*.other.example.net']},
      })

      await executeBuildThemeStep(step, context)

      expect(output()).toBe('Running theme check on your Theme app extension...')
    })
  })

  test("doesn't report navigation links or form actions", async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeExtension(directory, {
        'blocks/app.liquid': `<a href="https://nav.example.com">Go</a>\n<form action="https://forms.example.com"></form>`,
      })
      const declared = contextFor(directory, {network_access: {allowed_sources: []}})
      const undeclared = contextFor(directory)

      await executeBuildThemeStep(step, declared.context)
      await executeBuildThemeStep(step, undeclared.context)

      expect(declared.output()).toBe('Running theme check on your Theme app extension...')
      expect(undeclared.output()).toBe('Running theme check on your Theme app extension...')
    })
  })

  test('never fails the build when the detector throws', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeExtension(directory, FILES)
      vi.mocked(findOutboundOrigins).mockImplementationOnce(() => {
        throw new Error('detector bug')
      })
      vi.mocked(runThemeCheck).mockResolvedValue('theme check offenses')
      const {context, output} = contextFor(directory, {network_access: {allowed_sources: []}})

      await expect(executeBuildThemeStep(step, context)).resolves.toBeUndefined()
      expect(output()).toBe('Running theme check on your Theme app extension...theme check offenses')
    })
  })
})
