import {AbortError} from './error.js'
import {fetch} from '../../http.js'
import {debug, token} from '../../output.js'
import md5File from 'md5-file'

/**
 * An error that's thrown when a file's MD5 doesn't match the expected value.
 * @param options - An options object that includes the file path, and the expected and actual MD5.
 * @returns An instance of Abort.
 */
export const InvalidChecksumError = ({file, expected, got}: {file: string; expected: string; got: string}) => {
  return new AbortError(`The validation of ${file} failed. We expected the checksum ${expected}, but got ${got})`)
}
/**
 * Given a local file and a URL pointing to a remote file representing the MD5 of a local file,
 * it validates the authenticity of the binary using an MD5 checksum.
 * @param options - The file to validate and the URL that points to the file containing the MD5.
 */
export async function validateMD5({file, md5FileURL}: {file: string; md5FileURL: string}) {
  debug(`Checking MD5 of file ${token.path(file)} against the MD5 in ${token.link('URL', md5FileURL)}`)
  const md5Digest = await md5File(file)
  const md5Response = await fetch(md5FileURL)
  const md5Contents = await md5Response.text()
  const canonicalMD5 = md5Contents.split(' ')[0]!
  if (!(canonicalMD5 === md5Digest)) {
    throw InvalidChecksumError({
      file,
      got: md5Digest,
      expected: canonicalMD5,
    })
  }
}
