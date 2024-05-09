import {readFunctionRunsDirectory} from './replay.js'
import {describe, expect, test} from 'vitest'
import {joinPath} from '@shopify/cli-kit/node/path'
import {writeFile, inTemporaryDirectory, mkdir} from '@shopify/cli-kit/node/fs'

const runOneData = {
  payload: {
    input:
      '{"cart":{"lines":[{"quantity":1,"merchandise":{"__typename":"ProductVariant","id":"gid:\\/\\/shopify\\/ProductVariant\\/1"}}]}}',
    invocationId: '11111111-ed53-4377-b30f-14e8f4653cfe',
  },
}

const runTwoData = {
  payload: {
    input:
      '{"cart":{"lines":[{"quantity":1,"merchandise":{"__typename":"ProductVariant","id":"gid:\\/\\/shopify\\/ProductVariant\\/1"}}]}}',
    invocationId: '22222222-ed53-4377-b30f-14e8f4653cfe',
  },
}

describe('readFunctionRunsDirectory', () => {
  test('determines the correct dir to read from', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      // Given
      await mkdir(joinPath(tmpDir, 'runs'))
      await writeFile(joinPath(tmpDir, 'runs/run_one.json'), JSON.stringify(runOneData))
      await writeFile(joinPath(tmpDir, 'runs/run_two.json'), JSON.stringify(runTwoData))

      // When
      const got = await readFunctionRunsDirectory(tmpDir)

      // Then
      await expect(got).toEqual([runOneData, runTwoData])
    })
  })
})
