import {writeFile, mkdir, readFile, inTemporaryDirectory} from './fs.js'
import {renderLiquidTemplate, recursiveLiquidTemplateCopy} from './liquid.js'
import {joinPath} from './path.js'
import {describe, expect, it} from 'vitest'

describe('create', () => {
  it('replaces passes the content through the liquid engine', async () => {
    // Given
    const templateContent = '{{variable}}'

    // When
    const got = await renderLiquidTemplate(templateContent, {variable: 'test'})

    // Then
    expect(got).toEqual('test')
  })
})

describe('recursiveLiquidTemplateCopy', () => {
  it('copies the template and only runs liquid on the files with the .liquid extension', async () => {
    // Given
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const from = joinPath(tmpDir, 'from')
      const fromPackages = joinPath(from, 'packages')
      const to = joinPath(tmpDir, 'to')
      await mkdir(from)
      await mkdir(fromPackages)
      await mkdir(to)

      const readmePath = joinPath(from, 'first.md.liquid')
      const packageJsonPath = joinPath(fromPackages, 'package.json')
      const packageJson = {name: 'package'}
      await writeFile(readmePath, '# {{variable}}')
      await writeFile(packageJsonPath, JSON.stringify(packageJson))

      // When
      await recursiveLiquidTemplateCopy(from, to, {variable: 'test'})

      // Then
      const outReadmePath = joinPath(to, 'first.md')
      const outPackageJsonPath = joinPath(to, 'packages/package.json')
      await expect(readFile(outReadmePath)).resolves.toEqual('# test')
      const outPackageJson = await readFile(outPackageJsonPath)
      expect(JSON.parse(outPackageJson)).toEqual(packageJson)
    })
  })
})
