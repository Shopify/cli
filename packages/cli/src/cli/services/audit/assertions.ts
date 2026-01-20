import {fileExists, isDirectory, glob, readFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import type {AssertionResult} from './types.js'

export class AssertionCollector {
  private readonly results: AssertionResult[] = []

  getResults(): AssertionResult[] {
    return this.results
  }

  hasFailures(): boolean {
    return this.results.some((result) => !result.passed)
  }

  assertTrue(condition: boolean, description: string): void {
    this.results.push({
      description,
      passed: condition,
      expected: true,
      actual: condition,
    })
  }

  assertFalse(condition: boolean, description: string): void {
    this.results.push({
      description,
      passed: !condition,
      expected: false,
      actual: condition,
    })
  }

  assertEqual<T>(actual: T, expected: T, description: string): void {
    this.results.push({
      description,
      passed: actual === expected,
      expected,
      actual,
    })
  }

  async assertDirectoryExists(path: string, description?: string): Promise<void> {
    const exists = await fileExists(path)
    let isDir = false
    if (exists) {
      isDir = await isDirectory(path)
    }
    this.results.push({
      description: description ?? `Directory exists: ${path}`,
      passed: isDir,
      expected: 'directory exists',
      // eslint-disable-next-line no-nested-ternary
      actual: isDir ? 'directory exists' : exists ? 'file exists (not directory)' : 'does not exist',
    })
  }

  async assertFileExists(path: string, description?: string): Promise<void> {
    const exists = await fileExists(path)
    this.results.push({
      description: description ?? `File exists: ${path}`,
      passed: exists,
      expected: 'file exists',
      actual: exists ? 'file exists' : 'does not exist',
    })
  }

  async assertFilesExist(basePath: string, files: string[], description?: string): Promise<void> {
    const missing: string[] = []
    for (const file of files) {
      const fullPath = joinPath(basePath, file)
      // eslint-disable-next-line no-await-in-loop
      const exists = await fileExists(fullPath)
      if (!exists) {
        missing.push(file)
      }
    }
    this.results.push({
      description: description ?? `Required files exist in ${basePath}`,
      passed: missing.length === 0,
      expected: 'all files present',
      actual: missing.length === 0 ? 'all files present' : `missing: ${missing.join(', ')}`,
    })
  }

  async assertFileContains(path: string, content: string, description?: string): Promise<void> {
    try {
      const fileContent = await readFile(path)
      const contains = fileContent.includes(content)
      this.results.push({
        description: description ?? `File ${path} contains expected content`,
        passed: contains,
        expected: `contains "${content}"`,
        actual: contains ? 'content found' : 'content not found',
      })
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      this.results.push({
        description: description ?? `File ${path} contains expected content`,
        passed: false,
        expected: `contains "${content}"`,
        actual: 'file read error',
      })
    }
  }

  async assertGlobMatches(pattern: string, minCount: number, description?: string): Promise<void> {
    const matches = await glob(pattern)
    this.results.push({
      description: description ?? `Glob pattern ${pattern} matches at least ${minCount} files`,
      passed: matches.length >= minCount,
      expected: `>= ${minCount} matches`,
      actual: `${matches.length} matches`,
    })
  }
}
