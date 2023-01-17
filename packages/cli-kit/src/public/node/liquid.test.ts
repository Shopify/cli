import {writeFile, mkdir, readFile, inTemporaryDirectory} from './fs.js'
import {renderLiquidTemplate, recursiveLiquidTemplateCopy} from './liquid.js'
import {join} from '../../path.js'
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
      const from = join(tmpDir, 'from')
      const fromPackages = join(from, 'packages')
      const to = join(tmpDir, 'to')
      await mkdir(from)
      await mkdir(fromPackages)
      await mkdir(to)

      const readmePath = join(from, 'first.md.liquid')
      const packageJsonPath = join(fromPackages, 'package.json')
      const packageJson = {name: 'package'}
      await writeFile(readmePath, '# {{variable}}')
      await writeFile(packageJsonPath, JSON.stringify(packageJson))

      // When
      await recursiveLiquidTemplateCopy(from, to, {variable: 'test'})

      // Then
      const outReadmePath = join(to, 'first.md')
      const outPackageJsonPath = join(to, 'packages/package.json')
      await expect(readFile(outReadmePath)).resolves.toEqual('# test')
      const outPackageJson = await readFile(outPackageJsonPath)
      expect(JSON.parse(outPackageJson)).toEqual(packageJson)
    })
  })
})
