/* eslint-disable no-restricted-imports -- detector coverage uses real temporary repositories */
import {scanDirectory as scan} from './scan-directory.js'
import {afterEach, describe, expect, test} from 'vitest'
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

const CHECK_ID = 'THEME_EXTENSION_UNDECLARED_EGRESS'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, {recursive: true, force: true})))
})

async function app(files: {[path: string]: string}): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'app-security-theme-egress-'))
  directories.push(directory)
  await Promise.all(
    Object.entries(files).map(async ([path, content]) => {
      const fullPath = join(directory, path)
      await mkdir(join(fullPath, '..'), {recursive: true})
      await writeFile(fullPath, content)
    }),
  )
  return directory
}

const appConfig = `name = "Theme egress"\n[access_scopes]\nscopes = ""\n`
const themeFiles = {
  'extensions/theme/blocks/app.liquid': `<script src="https://api.example.com/app.js" defer></script>
<script src="https://cdn.other.example.net/lib.js" defer></script>
<a href="https://nav.example.com">Go</a>
{% schema %}{"name":"App","target":"section"}{% endschema %}`,
  'extensions/theme/assets/app.js': `fetch(endpoint)\nfetch('http://legacy.example.com/collect')`,
  'extensions/theme/assets/app.css': `.hero { background: url(https://img.example.org/hero.png); }`,
}
const themeConfig = (declaration = '') => `type = "theme"\nname = "Theme"\n${declaration}`

async function findings(files: {[path: string]: string}) {
  const result = await scan(await app({'shopify.app.toml': appConfig, ...files}))
  return {
    issues: result.issues.filter((issue) => issue.id === CHECK_ID),
    execution: result.scan.checks_executed.find((execution) => execution.id === CHECK_ID),
  }
}

describe('THEME_EXTENSION_UNDECLARED_EGRESS', () => {
  test('reports each undeclared egress origin where it is used when allowed_sources is declared', async () => {
    const {issues, execution} = await findings({
      ...themeFiles,
      'extensions/theme/shopify.extension.toml': themeConfig(
        `[capabilities.network_access]\nallowed_sources = ["https://api.example.com"]\n`,
      ),
    })

    expect(execution).toMatchObject({version: 1, status: 'executed', findings: 3, applicable: true})
    expect(execution?.inspected_files).toEqual(
      expect.arrayContaining(['extensions/theme/assets/app.css', 'extensions/theme/assets/app.js']),
    )
    expect(issues).toMatchObject([
      {
        pattern_id: 'undeclared-origin',
        severity: 'medium',
        location: {file: 'extensions/theme/assets/app.css', line: 1, column: 25},
        message:
          "CSS url() contacts https://img.example.org, which isn't in the extension's capabilities.network_access.allowed_sources.",
        rule_version: 1,
      },
      {
        pattern_id: 'insecure-origin',
        severity: 'medium',
        location: {file: 'extensions/theme/assets/app.js', line: 2, column: 7},
        message:
          "fetch() contacts http://legacy.example.com over an insecure scheme. capabilities.network_access.allowed_sources accepts only HTTPS origins, so this request can't be declared.",
        rule_version: 1,
      },
      {
        pattern_id: 'undeclared-origin',
        severity: 'medium',
        location: {file: 'extensions/theme/blocks/app.liquid', line: 2, column: 14},
        message:
          "<script src> contacts https://cdn.other.example.net, which isn't in the extension's capabilities.network_access.allowed_sources.",
        rule_version: 1,
      },
    ])
  })

  test('reports one finding on the configuration when allowed_sources is not declared', async () => {
    const {issues} = await findings({...themeFiles, 'extensions/theme/shopify.extension.toml': themeConfig()})

    expect(issues).toEqual([
      expect.objectContaining({
        pattern_id: 'allowed-sources-not-declared',
        location: {file: 'extensions/theme/shopify.extension.toml', line: 1, column: 1},
        message:
          "The theme app extension contacts 4 external origins (https://img.example.org, http://legacy.example.com, https://api.example.com and 1 more) but doesn't declare capabilities.network_access.allowed_sources.",
      }),
    ])
  })

  test('has no findings when every egress origin is declared, ignoring navigation', async () => {
    const {issues, execution} = await findings({
      ...themeFiles,
      'extensions/theme/assets/app.js': 'fetch(endpoint)',
      'extensions/theme/shopify.extension.toml': themeConfig(
        `[capabilities.network_access]\nallowed_sources = ["https://api.example.com", "https://*.other.example.net", "https://img.example.org"]\n`,
      ),
    })

    expect(issues).toEqual([])
    expect(execution).toMatchObject({status: 'executed', findings: 0})
  })

  test('marks the check unresolved when a Liquid file cannot be parsed', async () => {
    const {execution} = await findings({
      'extensions/theme/shopify.extension.toml': themeConfig(),
      'extensions/theme/blocks/broken.liquid': '{% if %}<div',
    })

    expect(execution).toMatchObject({
      status: 'unresolved',
      reason: {code: 'parser_unavailable', message: 'Liquid parser failed for: extensions/theme/blocks/broken.liquid'},
    })
  })

  test('does not apply without a theme app extension', async () => {
    const {execution} = await findings({'web/app.js': "fetch('https://api.example.com')"})

    expect(execution).toMatchObject({status: 'not_applicable', applicable: false})
  })
})
