import {execSync} from 'node:child_process'
import {writeFile} from 'node:fs/promises'

const json = execSync('node packages/cli/bin/dev.js commands --json', {
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
})

const commands = JSON.parse(json).filter((c) => !c.hidden && !/^(commands|help|plugins):/.test(c.id))

const out = {}
for (const c of commands) {
  const key = c.id.replace(/:/g, '-').toLowerCase()
  out[key] = c.description || c.summary || ''
}

await writeFile('./docs-shopify.dev/generated/cli-descriptions.json', `${JSON.stringify(out, null, 2)}\n`)
console.log(`Wrote cli-descriptions.json with ${Object.keys(out).length} entries`)
