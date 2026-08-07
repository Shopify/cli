import {writeFile, mkdir, readFile, inTemporaryDirectory, chmod, fileHasExecutablePermissions} from './fs.js'
import {renderLiquidTemplate, recursiveLiquidTemplateCopy} from './liquid.js'
import {joinPath} from './path.js'
import {describe, expect, test} from 'vitest'

describe('create', () => {
  test('replaces passes the content through the liquid engine', async () => {
    // Given
    const templateContent = '{{variable}}'

    // When
    const got = await renderLiquidTemplate(templateContent, {variable: 'test'})

    // Then
    expect(got).toEqual('test')
  })
})

describe('recursiveLiquidTemplateCopy', () => {
  test('copies the template and only runs liquid on the files with the .liquid extension', async () => {
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
      const rawLiquid = joinPath(from, 'second.liquid.raw')
      const packageJsonPath = joinPath(fromPackages, 'package.json')
      const packageJson = {name: 'package'}
      await writeFile(readmePath, '# {{variable}}')
      await writeFile(rawLiquid, '# {{literal}}')
      await writeFile(packageJsonPath, JSON.stringify(packageJson))

      // When
      await recursiveLiquidTemplateCopy(from, to, {variable: 'test'})

      // Then
      const outReadmePath = joinPath(to, 'first.md')
      await expect(readFile(outReadmePath)).resolves.toEqual('# test')

      const outRawLiquid = joinPath(to, 'second.liquid')
      await expect(readFile(outRawLiquid)).resolves.toEqual('# {{literal}}')

      const outPackageJsonPath = joinPath(to, 'packages/package.json')
      const outPackageJson = await readFile(outPackageJsonPath)
      expect(JSON.parse(outPackageJson)).toEqual(packageJson)
    })
  })

  test('ignores files and folders in .cli-liquid-bypass', async () => {
    const bypassPatterns = ['ignored.liquid', 'ignored-folder']

    // Given
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const from = joinPath(tmpDir, 'from')
      const ignoredFolder = joinPath(from, 'ignored-folder')
      const to = joinPath(tmpDir, 'to')
      await mkdir(from)
      await mkdir(ignoredFolder)
      await mkdir(to)

      const bypassFile = joinPath(from, '.cli-liquid-bypass')
      const ignoredFile = joinPath(from, 'ignored.liquid')
      const folderIgnoredFile = joinPath(ignoredFolder, 'ignored2.liquid')
      const processedFile = joinPath(from, 'processed.md.liquid')
      await writeFile(bypassFile, bypassPatterns.join('\n'))
      await writeFile(ignoredFile, '# {{variable}}')
      await writeFile(folderIgnoredFile, '# {{variable}}')
      await writeFile(processedFile, '# {{variable}}')

      // When
      await recursiveLiquidTemplateCopy(from, to, {variable: 'test'})

      // Then
      const outFile = joinPath(to, 'ignored.liquid')
      const outFolderFile = joinPath(to, 'ignored-folder/ignored2.liquid')
      const outProcessedFile = joinPath(to, 'processed.md')

      await expect(readFile(outFile)).resolves.toEqual('# {{variable}}')
      await expect(readFile(outFolderFile)).resolves.toEqual('# {{variable}}')
      await expect(readFile(outProcessedFile)).resolves.toEqual('# test')
    })
  })

  test('processes and replaces variables in directory and file names', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const from = joinPath(tmpDir, 'from')
      const to = joinPath(tmpDir, 'to')
      await mkdir(from)
      await mkdir(to)

      const variableDirName = joinPath(from, '{{name}}_dir')
      await mkdir(variableDirName)

      const variableFileName = joinPath(variableDirName, '{{name}}_file.txt.liquid')
      await writeFile(variableFileName, 'Hello {{name}}')

      // When
      await recursiveLiquidTemplateCopy(from, to, {name: 'shopify'})

      // Then
      const expectedDir = joinPath(to, 'shopify_dir')
      const expectedFile = joinPath(expectedDir, 'shopify_file.txt')

      await expect(readFile(expectedFile)).resolves.toEqual('Hello shopify')
    })
  })

  test('preserves executable permissions on .liquid files', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const from = joinPath(tmpDir, 'from')
      const to = joinPath(tmpDir, 'to')
      await mkdir(from)
      await mkdir(to)

      const scriptPath = joinPath(from, 'script.sh.liquid')
      await writeFile(scriptPath, '#!/bin/bash\necho "{{message}}"')
      await chmod(scriptPath, 0o755)

      // When
      await recursiveLiquidTemplateCopy(from, to, {message: 'hello'})

      // Then
      const outScriptPath = joinPath(to, 'script.sh')
      await expect(readFile(outScriptPath)).resolves.toEqual('#!/bin/bash\necho "hello"')
      await expect(fileHasExecutablePermissions(outScriptPath)).resolves.toBe(true)
    })
  })

  test('correctly copies non-liquid files and files with non-liquid names', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      const from = joinPath(tmpDir, 'from')
      const to = joinPath(tmpDir, 'to')
      await mkdir(from)
      await mkdir(to)

      const imagePath = joinPath(from, 'logo.png')
      await writeFile(imagePath, 'binary content or static template')

      // When
      await recursiveLiquidTemplateCopy(from, to, {})

      // Then
      const outImagePath = joinPath(to, 'logo.png')
      await expect(readFile(outImagePath)).resolves.toEqual('binary content or static template')
    })
  })
})
