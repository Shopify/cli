import { readFile, writeFile } from "fs/promises"

// This function removes all dependencies from the package.json file that are not in the external array
// This is useful when bundling with esbuild, we only leave the dependencies that are not bundled.
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
