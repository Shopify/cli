import {describe, it, expect} from 'vitest'
import {temporary} from '@shopify/cli-testing'
import {file, path} from '@shopify/cli-kit'

import {zip} from './zip'

it('zips', async () => {
  await temporary.directory(async (tmpDir) => {
    // Given
    const zippableDirectory = path.join(tmpDir, 'directory-i-want-to-zip')
    const outputZipPath = path.join(tmpDir, 'zipPath.zip')
    await file.mkdir(zippableDirectory)
    await file.write(path.join(zippableDirectory, 'my-file'), 'test')

    // When
    await zip(zippableDirectory, outputZipPath)

    // Then
    const zipFileExists = await file.exists(outputZipPath)
    expect(zipFileExists).toBe(true)

    // use unzip method to make sure the zipped file has all expected files and directories
  })
})
