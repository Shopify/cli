import {ResourceConfigs, ResourceConfig} from './types.js'
import {ValidationError, ErrorCodes} from '../services/store/errors/errors.js'

const METAFIELD_KEYWORD = 'metafield'
const RESOURCES_SUPPORTING_UNIQUE_METAFIELD_IDENTIFIERS = ['products']
const METAFIELD_FLAG_PARTS_COUNT = 4

const VALID_RESOURCE_FIELDS: {[key: string]: string[]} = {
  products: ['handle'],
}

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

function validateKeyFormat(flag: string): void {
  const colonCount = (flag.match(/:/g) ?? []).length
  if (colonCount !== 1 && colonCount !== 3) {
    throw new ValidationError(ErrorCodes.INVALID_KEY_FORMAT, {key: flag})
  }
}

function validateResourceAndField(resource: string, field: string): void {
  if (!VALID_RESOURCE_FIELDS[resource]) {
    throw new ValidationError(ErrorCodes.KEY_NOT_SUPPORTED, {resource})
  }

  if (!VALID_RESOURCE_FIELDS[resource].includes(field)) {
    throw new ValidationError(ErrorCodes.KEY_DOES_NOT_EXIST, {field})
  }
}

export function parseResourceConfigFlags(flags: string[]): ResourceConfigs {
  const resourceConfigs: ResourceConfigs = {}

  if (!flags || flags.length === 0) {
    return resourceConfigs
  }

  flags.forEach((flag: string) => {
    validateKeyFormat(flag)

    const parts = flag.split(':')
    const resource = parts[0]
    const secondPart = parts[1]

    if (!resource || !secondPart) {
      throw new ValidationError(ErrorCodes.INVALID_KEY_FORMAT, {key: flag})
    }

    if (secondPart === METAFIELD_KEYWORD) {
      validateMetafieldFormat(flag, parts)
      validateMetafieldResource(resource)

      const namespace = parts[2]
      const key = parts[3]

      if (!namespace || !key) {
        throw new ValidationError(ErrorCodes.INVALID_KEY_FORMAT, {key: flag})
      }

      resourceConfigs[resource] = createMetafieldBasedConfig(namespace, key)
    } else {
      validateResourceAndField(resource, secondPart)
      resourceConfigs[resource] = createFieldBasedConfig(secondPart)
    }
  })

  return resourceConfigs
}
