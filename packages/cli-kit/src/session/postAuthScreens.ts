import {findUp, moduleDirectory} from '../path'
import * as output from '../output'
import fs from 'fs'

const HTML_FILE_NAMES = ['empty-url', 'missing-code', 'missing-state', 'success']
const STYLESHEET_FILE_NAME = 'style.css'
const FAVICON_FILE_NAME = 'favicon.svg'
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
export const areFilesLoaded = (): boolean => {
  return Object.keys(filePathMap).length > 0
}

/**
 * Dyamically finds and stores all the file paths into the filePathMap.
 */
export const loadFiles = async () => {
  HTML_FILE_NAMES.forEach(async (fileName: string) => {
    const filePath = await getFilePath(`${fileName}.html`)
    output.info(filePath as string)
    output.info('ayo')
    if (filePath) filePathMap[fileName] = filePath as string
  })

  const stylesheetPath = await getFilePath(STYLESHEET_FILE_NAME)
  if (stylesheetPath) filePathMap.style = stylesheetPath as string

  const faviconPath = await getFilePath(FAVICON_FILE_NAME)
  if (faviconPath) filePathMap.favicon = faviconPath as string

  for (const key of Object.keys(filePathMap)) {
    output.info(`Found ${key} at ${filePathMap[key]}`)
  }
}

export const getEmptyUrlHTML = async (): Promise<Buffer> => {
  const filePath = filePathMap['empty-url']
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
