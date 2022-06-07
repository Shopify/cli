/* eslint-disable no-restricted-imports */
import fs from 'fs'
import path from 'path'

const DIRECTORY = path.join(path.resolve(), 'packages/cli-kit/src/html/')

export const getEmptyUrlHTML = (): Buffer => {
  return fs.readFileSync(path.join(DIRECTORY, 'empty-url.html'))
}
export const getMissingCodeHTML = (): Buffer => {
  return fs.readFileSync(path.join(DIRECTORY, 'missing-code.html'))
}

export const getMissingStateHTML = (): Buffer => {
  return fs.readFileSync(path.join(DIRECTORY, 'missing-state.html'))
}

export const getSuccessHTML = (): Buffer => {
  return fs.readFileSync(path.join(DIRECTORY, 'success.html'))
}

export const getStylesheet = (): Buffer => {
  return fs.readFileSync(path.join(DIRECTORY, 'style.css'))
}
