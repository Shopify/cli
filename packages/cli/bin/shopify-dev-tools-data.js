import {cpSync, mkdirSync, rmSync, statSync} from 'fs'
import {basename} from 'path'

const shouldCopyDataPath = (sourcePath, internalApiIds) => {
  const sourceName = basename(sourcePath)

  if (internalApiIds.some((apiId) => sourceName.includes(apiId))) return false
  if (statSync(sourcePath).isDirectory()) return true

  return sourceName === 'supported-versions-schema.json' || sourceName === 'index.json' || sourceName.endsWith('.gz')
}

export const copyShopifyDevToolsData = ({sourceDataDirectory, targetDataDirectory, internalApiIds}) => {
  rmSync(targetDataDirectory, {recursive: true, force: true})
  mkdirSync(targetDataDirectory, {recursive: true})
  cpSync(sourceDataDirectory, targetDataDirectory, {
    recursive: true,
    filter: (sourcePath) => shouldCopyDataPath(sourcePath, internalApiIds),
  })
}

export const shopifyDevToolsDataPlugin = ({sourceDataDirectory, targetDataDirectory, internalApiIds}) => ({
  name: 'copy-shopify-dev-tools-data',
  setup(build) {
    build.onEnd(({errors}) => {
      if (errors.length > 0) return
      copyShopifyDevToolsData({sourceDataDirectory, targetDataDirectory, internalApiIds})
    })
  },
})
