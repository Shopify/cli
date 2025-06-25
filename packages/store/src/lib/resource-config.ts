import {ResourceConfigs, ResourceConfig} from './types.js'

const METAFIELD_KEYWORD = 'metafield'
const RESOURCES_SUPPORTING_UNIQUE_METAFIELD_IDENTIFIERS = ['products']
const METAFIELD_FLAG_PARTS_COUNT = 4
const MIN_FLAG_PARTS_COUNT = 2

function createFieldBasedConfig(field: string): ResourceConfig {
  return {
    identifier: {
      field: field.toUpperCase(),
    },
  }
}

function createMetafieldBasedConfig(namespace: string, key: string): ResourceConfig {
  return {
    identifier: {
      customId: {
        namespace,
        key,
      },
    },
  }
}

function validateFlagFormat(flag: string, parts: string[]): void {
  if (parts.length < MIN_FLAG_PARTS_COUNT) {
    throw new Error(`Invalid flag format: ${flag}. Expected format: resource:key or resource:metafield:namespace:key`)
  }
}

function validateMetafieldFormat(flag: string, parts: string[]): void {
  if (parts.length !== METAFIELD_FLAG_PARTS_COUNT) {
    throw new Error(`Invalid flag format: ${flag}. Expected format: resource:metafield:namespace:key`)
  }
}

function validateMetafieldResource(resource: string): void {
  if (!RESOURCES_SUPPORTING_UNIQUE_METAFIELD_IDENTIFIERS.includes(resource)) {
    throw new Error(`Invalid resource: ${resource} don't support unique metafields as identifiers.`)
  }
}

export function parseResourceConfigFlags(flags: string[]): ResourceConfigs {
  const resourceConfigs: ResourceConfigs = {}

  if (!flags || flags.length === 0) {
    return resourceConfigs
  }

  flags.forEach((flag: string) => {
    const parts = flag.split(':')
    validateFlagFormat(flag, parts)

    const resource = parts[0]!
    const secondPart = parts[1]!

    if (secondPart === METAFIELD_KEYWORD) {
      validateMetafieldFormat(flag, parts)
      validateMetafieldResource(resource)

      const namespace = parts[2]!
      const key = parts[3]!
      resourceConfigs[resource] = createMetafieldBasedConfig(namespace, key)
    } else {
      resourceConfigs[resource] = createFieldBasedConfig(secondPart)
    }
  })

  return resourceConfigs
}
