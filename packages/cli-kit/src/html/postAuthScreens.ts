import fs from 'fs'

export const getEmptyUrlHTML = (): Buffer => {
  return fs.readFileSync('./empty-url.html')
}
export const getMissingCodeHTML = (): Buffer => {
  return fs.readFileSync('./missing-code.html')
}

export const getMissingStateHTML = (): Buffer => {
  return fs.readFileSync('./missing-state.html')
}

export const getSuccessHTML = (): Buffer => {
  return fs.readFileSync('./success.html')
}
