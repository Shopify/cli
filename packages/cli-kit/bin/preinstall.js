import {readFileSync, writeFile, writeFileSync} from 'fs';

const version = JSON.parse(readFileSync('package.json')).version
const content = `export const CLI_KIT_VERSION = '${version}'\n`
writeFileSync('src/public/common/version.ts', content)
