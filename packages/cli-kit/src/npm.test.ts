import {file, npm, os, path} from '.'
import {updateAppData} from './npm.js'
import {inTemporaryDirectory} from './file.js'
import {describe, it, expect, vi} from 'vitest'

vi.mock('node:os')
vi.mock('node:process')

describe('readPackageJSON()', () => {
  async function mockPackageJSON(callback: (tmpDir: string) => Promise<void>) {
    await inTemporaryDirectory(async (tmpDir) => {
      const packageJSON = {name: 'mock name'}
      await file.write(path.join(tmpDir, 'package.json'), JSON.stringify(packageJSON))

      return callback(tmpDir)
    })
  }

  it('reads the package.json and returns it parsed', async () => {
    await mockPackageJSON(async (tmpDir: string) => {
      const packageJSON = await npm.readPackageJSON(tmpDir)

      expect(packageJSON).toEqual({name: 'mock name'})
    })
  })
})

describe('writePackageJSON()', () => {
  it('writes the package.json and returns it parsed', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      vi.spyOn(file, 'write')

      const packageJSON = {name: 'mock name'}
      await npm.writePackageJSON(tmpDir, packageJSON)

      const filePath = path.join(tmpDir, 'package.json')
      const content = '{\n  "name": "mock name"\n}'

      expect(file.write).toHaveBeenCalledWith(filePath, content)
    })
  })
})

describe('updateAppData()', () => {
  it('updates the name', async () => {
    const packageJSON = {} as {name: string}
    await updateAppData(packageJSON, 'mock name')

    expect(packageJSON.name).toBe('mock name')
  })

  it('updates the author', async () => {
    const packageJSON = {} as {author: string}

    vi.spyOn(os, 'username').mockImplementation(async () => 'mock os.username')

    await updateAppData(packageJSON, '')

    expect(packageJSON.author).toBe('mock os.username')
  })
})
