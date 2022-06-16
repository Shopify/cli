import {findUp, moduleDirectory} from '../path'
import fs from 'fs'

const HTMLFileNames = ['empty-url', 'auth-error', 'missing-code', 'missing-state', 'success']
const StylesheetFilename = 'style.css'
const FaviconFileName = 'favicon.svg'
const filePathMap: {[key: string]: string} = {}

/**
 * Finds the full path of the given file-name from the assets folder.
 *
 * @param {string} fileName The name of the file to look for.
 * @returns {string | null} The full path of the file, or null if not found.
 */
const getFilePath = async (fileName: string): Promise<string | null> => {
  return (
    (await findUp(`assets/${fileName}`, {
      type: 'file',
      cwd: moduleDirectory(import.meta.url),
    })) ?? null
  )
}

/**
 * Checks to see whether or not the file paths have been loaded or not.
 *
 * @returns {boolean} True if the file paths have been loaded, false otherwise.
 */
export const areFilesLoaded = (): boolean => Object.keys(filePathMap).length > 0

/**
 * Dyamically finds and stores all the file paths into the filePathMap.
 */
export const loadFiles = async () => {
  HTMLFileNames.forEach(async (fileName: string) => {
    const filePath = await getFilePath(`${fileName}.html`)
    if (filePath) filePathMap[fileName] = filePath as string
  })

  const stylesheetPath = await getFilePath(StylesheetFilename)
  if (stylesheetPath) filePathMap.style = stylesheetPath as string

  const faviconPath = await getFilePath(FaviconFileName)
  if (faviconPath) filePathMap.favicon = faviconPath as string
}

export const getEmptyUrlHTML = async (): Promise<Buffer> => {
  const filePath = filePathMap['empty-url']
  return fs.readFileSync(filePath)
}

export const getAuthErrorHTML = async (): Promise<Buffer> => {
  const filePath = filePathMap['auth-error']
  return fs.readFileSync(filePath)
}

export const getMissingCodeHTML = async (): Promise<Buffer> => {
  const filePath = filePathMap['missing-code']
  return fs.readFileSync(filePath)
}

export const getMissingStateHTML = async (): Promise<Buffer> => {
  const filePath = filePathMap['missing-state']
  return fs.readFileSync(filePath)
}

export const getSuccessHTML = async (): Promise<Buffer> => {
  const filePath = filePathMap.success
  return fs.readFileSync(filePath)
}

export const getStylesheet = async (): Promise<Buffer> => {
  const filePath = filePathMap.style
  return fs.readFileSync(filePath)
}

export const getFavicon = async (): Promise<Buffer> => {
  const filePath = filePathMap.favicon
  return fs.readFileSync(filePath)
}

export const EmptyUrlString = 'We received the authentication redirect but the URL is empty.'

export const AuthErrorString = 'There was an issue while trying to authenticate.'

export const MissingCodeString = "The authentication can't continue because the redirect doesn't include the code."

export const MissingStateString = "The authentication can't continue because the redirect doesn't include the state."
