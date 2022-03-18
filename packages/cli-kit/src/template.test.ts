import {join} from './path'
import {write, mkdir, read} from './file'
import {create, recursiveDirectoryCopy} from './template'
import {temporary} from '@shopify/cli-testing'
import {describe, expect, it} from 'vitest'

describe('create', () => {
  it('replaces passes the content through the liquid engine', async () => {
    // Given
    const templateContent = '{{variable}}'

    // When
    const got = await create(templateContent)({variable: 'test'})

    // Then
    expect(got).toEqual('test')
  })
})

describe('recursiveDirectoryCopy', () => {
  it('copies the template and only runs liquid on the files with the .liquid extension', async () => {
    // Given
    await temporary.directory(async (tmpDir) => {
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
      await write(readmePath, '# {{variable}}')
      await write(packageJsonPath, JSON.stringify(packageJson))

      // When
      await recursiveDirectoryCopy(from, to, {variable: 'test'})

      // Then
      const outReadmePath = join(to, 'first.md')
      const outPackageJsonPath = join(to, 'packages/package.json')
      await expect(read(outReadmePath)).resolves.toEqual('# test')
      const outPackageJson = await read(outPackageJsonPath)
      expect(JSON.parse(outPackageJson)).toEqual(packageJson)
    })
  })
})
