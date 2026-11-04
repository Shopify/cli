/* eslint-disable no-restricted-imports -- repository markers are planted in real temporary directories */
import {findRepositoryMarker} from '../scanners/repository-marker.js'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {describe, expect, test} from 'vitest'
import {mkdir, symlink, writeFile} from 'node:fs/promises'
import {join} from 'node:path'

describe('findRepositoryMarker', () => {
  test('finds a .git directory in the starting directory', async () => {
    await inTemporaryDirectory(async (root) => {
      await mkdir(join(root, '.git'))

      expect(findRepositoryMarker(root)).toEqual({status: 'found', directory: root})
    })
  })

  test("finds a worktree's .git file in the starting directory", async () => {
    await inTemporaryDirectory(async (root) => {
      await writeFile(join(root, '.git'), 'gitdir: /somewhere/else/.git/worktrees/app\n')

      expect(findRepositoryMarker(root)).toEqual({status: 'found', directory: root})
    })
  })

  test('finds the nearest .git above the starting directory, not a higher one', async () => {
    await inTemporaryDirectory(async (root) => {
      const nearest = join(root, 'apps')
      const start = join(nearest, 'web', 'src')
      await mkdir(start, {recursive: true})
      await mkdir(join(root, '.git'))
      await mkdir(join(nearest, '.git'))

      expect(findRepositoryMarker(start)).toEqual({status: 'found', directory: nearest})
    })
  })

  test.skipIf(process.platform === 'win32')(
    'is ambiguous for a symbolic-linked .git, which it does not follow',
    async () => {
      await inTemporaryDirectory(async (root) => {
        await inTemporaryDirectory(async (outside) => {
          await mkdir(join(outside, '.git'))
          await symlink(join(outside, '.git'), join(root, '.git'), 'dir')

          const marker = findRepositoryMarker(root)

          expect(marker).toEqual({status: 'ambiguous', reason: expect.any(String)})
          expect(marker).not.toMatchObject({directory: expect.anything()})
        })
      })
    },
  )

  test('reports none when no .git exists at or above the starting directory', async () => {
    await inTemporaryDirectory(async (root) => {
      const start = join(root, 'apps', 'web')
      await mkdir(start, {recursive: true})

      expect(findRepositoryMarker(start)).toEqual({status: 'none'})
    })
  })
})
