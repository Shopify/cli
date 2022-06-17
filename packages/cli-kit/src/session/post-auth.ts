import {findUp, moduleDirectory} from '../path'
import {read} from '../file'
import {Bug} from '../error'

const HTMLFileNames = ['empty-url.html', 'auth-error.html', 'missing-code.html', 'missing-state.html', 'success.html']
const StylesheetFilename = 'style.css'
const FaviconFileName = 'favicon.svg'

/**
 * Finds the full path of the given file-name from the assets folder.
 *
 * @param {string} fileName The name of the file to look for.
 * @returns {string | null} The full path of the file, or null if not found.
 */
const getFilePath = async (fileName: string): Promise<string> => {
  const filePath = await findUp(`assets/${fileName}`, {
    type: 'file',
    cwd: moduleDirectory(import.meta.url),
  })
  if (!filePath) {
    throw RedirectPageAssetNotFoundError()
  }
  return filePath
}

export const getEmptyUrlHTML = async (): Promise<string> => {
  const filePath = await getFilePath(HTMLFileNames[0])
  return read(filePath)
}

export const getAuthErrorHTML = async (): Promise<string> => {
  const filePath = await getFilePath(HTMLFileNames[1])
  return read(filePath)
}

export const getMissingCodeHTML = async (): Promise<string> => {
  const filePath = await getFilePath(HTMLFileNames[2])
  return read(filePath)
}

export const getMissingStateHTML = async (): Promise<string> => {
  const filePath = await getFilePath(HTMLFileNames[3])
  return read(filePath)
}

export const getSuccessHTML = async (): Promise<string> => {
  const filePath = await getFilePath(HTMLFileNames[4])
  return read(filePath)
}

export const getStylesheet = async (): Promise<string> => {
  const filePath = await getFilePath(StylesheetFilename)
  return read(filePath)
}

export const getFavicon = async (): Promise<string> => {
  const filePath = await getFilePath(FaviconFileName)
  return read(filePath)
}

export const EmptyUrlString = 'We received the authentication redirect but the URL is empty.'

export const AuthErrorString = 'There was an issue while trying to authenticate.'

export const MissingCodeString = "The authentication can't continue because the redirect doesn't include the code."

export const MissingStateString = "The authentication can't continue because the redirect doesn't include the state."

export const RedirectPageAssetNotFoundError = () => {
  return new Bug(`Redirect page asset not found`)
}
