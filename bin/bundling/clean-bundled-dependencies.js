import { readFile, writeFile } from "fs/promises"

export default async function cleanBundledDependencies(external) {
  const file = await readFile('./package.json')
  const json = JSON.parse(file.toString())
  const dependencies = json.dependencies ?? {}

  const newDependencies = {}
  external.forEach((e) => {
    if (dependencies[e]) {
      newDependencies[e] = dependencies[e]
    }
  })

  json.dependencies = newDependencies

  console.log(newDependencies)

  await writeFile('./package.json', JSON.stringify(json, null, 2))
}
