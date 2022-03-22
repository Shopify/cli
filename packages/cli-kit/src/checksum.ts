import {read as readFile} from './file'
import {fetch} from './http'
import {Abort} from './error'
import md5File from 'md5-file'

export const InvalidChecksumError = ({file, expected, got}: {file: string; expected: string; got: string}) => {
  return new Abort(`The validation of ${file} failed. We expected the checksum ${expected}, but got ${got})`)
}
/**
 * Given a local file and a URL pointing to a remote file representing the MD5 of a local file,
 * it validates the authenticity of the binary using an MD5 checksum.
 * @param options: The file to validate and the URL that points to the file containing the MD5.
 */
export async function validateMD5({file, md5FileURL}: {file: string; md5FileURL: string}) {
  const md5Digest = await md5File(file)
  const md5Response = await fetch(md5FileURL)
  const md5Contents = await md5Response.text()
  const canonicalMD5 = md5Contents.split(' ')[0]
  if (!(canonicalMD5 === md5Digest)) {
    throw InvalidChecksumError({
      file,
      got: md5Digest,
      expected: canonicalMD5,
    })
  }
}
