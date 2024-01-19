// eslint-disable-next-line @shopify/cli/specific-imports-in-bootstrap-code
import {writeFileSync, readFileSync} from 'fs'

const originalManifest = JSON.parse(readFileSync(new URL('../oclif.manifest.json', import.meta.url)))

const newManifest = JSON.parse(readFileSync(new URL('../oclif-hydrogen.json', import.meta.url)))

originalManifest.commands = {...originalManifest.commands, ...newManifest}

writeFileSync(new URL('../oclif.manifest.json', import.meta.url), JSON.stringify(originalManifest, null, 2), 'utf8')
