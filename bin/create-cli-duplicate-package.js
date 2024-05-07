import { copyFile, cp, readFile, writeFile } from "fs/promises"

await cp('./packages/cli', './packages/cli-copy', { recursive: true })

const file = await readFile('./packages/cli-copy/package.json')
const json = JSON.parse(file.toString())
json.name = "shopify"
await writeFile('./packages/cli-copy/package.json', JSON.stringify(json, null, 2))

