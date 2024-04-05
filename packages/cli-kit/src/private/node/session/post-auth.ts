import {moduleDirectory} from '../../../public/node/path.js'
import {readFile, findPathUp} from '../../../public/node/fs.js'
import {BugError} from '../../../public/node/error.js'

const HTMLFileNames = [
  'empty-url.html',
  'auth-error.html',
  'missing-code.html',
  'missing-state.html',
  'success.html',
] as const
const StylesheetFilename = 'style.css'
const FaviconFileName = 'favicon.svg'

/**
 * Finds the full path of the given file-name from the assets folder.
 *
 * @param fileName - The name of the file to look for.
 * @returns The full path of the file, or null if not found.
 */
const getFilePath = async (fileName: string): Promise<string> => {
  const filePath = await findPathUp(`assets/${fileName}`, {
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
  return readFile(filePath)
}

export const getAuthErrorHTML = async (): Promise<string> => {
  const filePath = await getFilePath(HTMLFileNames[1])
  return readFile(filePath)
}

export const getMissingCodeHTML = async (): Promise<string> => {
  const filePath = await getFilePath(HTMLFileNames[2])
  return readFile(filePath)
}

export const getMissingStateHTML = async (): Promise<string> => {
  const filePath = await getFilePath(HTMLFileNames[3])
  return readFile(filePath)
}

export const getSuccessHTML = async (): Promise<string> => {
  const filePath = await getFilePath(HTMLFileNames[4])
  return readFile(filePath)
}

export const getStylesheet = async (): Promise<string> => {
  const filePath = await getFilePath(StylesheetFilename)
  return readFile(filePath)
}

export const getFavicon = async (): Promise<string> => {
  const filePath = await getFilePath(FaviconFileName)
  return readFile(filePath)
}

export const EmptyUrlString = 'We received the authentication redirect but the URL is empty.'

export const MissingCodeString = "The authentication can't continue because the redirect doesn't include the code."

export const MissingStateString = "The authentication can't continue because the redirect doesn't include the state."

const RedirectPageAssetNotFoundError = () => new BugError(`Redirect page asset not found`)
