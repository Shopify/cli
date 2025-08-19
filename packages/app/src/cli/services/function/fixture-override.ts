import {readFile, writeFile} from '@shopify/cli-kit/node/fs'

export interface FixtureOverride {
  [key: string]: unknown
}

/**
 * Loads a fixture file and applies overrides to specific paths
 * @param fixturePath - Path to the fixture file
 * @param overrides - Object containing path-based overrides (e.g., {"input.cart.lines.0.quantity": 5})
 * @returns The modified fixture object
 */
export async function loadFixtureWithOverrides(fixturePath: string, overrides: FixtureOverride = {}): Promise<unknown> {
  try {
    const fixtureContent = await readFile(fixturePath)
    const fixture = JSON.parse(fixtureContent)

    if (Object.keys(overrides).length === 0) {
      return fixture
    }

    // Apply each override by setting the value at the specified path
    const modifiedFixture = {...fixture}

    for (const [path, value] of Object.entries(overrides)) {
      setNestedValue(modifiedFixture, path, value)
    }

    return modifiedFixture
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in fixture file ${fixturePath}: ${error.message}`)
    } else if (error instanceof Error) {
      throw new Error(`Failed to load fixture file ${fixturePath}: ${error.message}`)
    } else {
      throw new Error(`Unknown error loading fixture file ${fixturePath}`)
    }
  }
}

/**
 * Sets a value at a nested path in an object
 * @param obj - The object to modify
 * @param path - Dot-separated path (e.g., "input.cart.lines.0.quantity")
 * @param value - The value to set
 */
function setNestedValue(obj: any, path: string, value: unknown): void {
  const keys = path.split('.')
  let current: any = obj

  // Navigate to the parent of the target key
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]

    // Type guard to ensure key is defined
    if (key === undefined) {
      throw new Error(`Path ${path} is invalid: undefined key at position ${i}`)
    }

    // Handle array indices
    if (!isNaN(Number(key))) {
      const index = Number(key)
      if (!Array.isArray(current)) {
        throw new Error(`Path ${path} is invalid: ${key} is not an array index`)
      }
      if (index >= current.length) {
        throw new Error(`Path ${path} is invalid: array index ${index} is out of bounds`)
      }
      current = current[index]
    } else {
      if (!(key in current)) {
        throw new Error(`Path ${path} is invalid: key ${key} does not exist`)
      }
      current = current[key]
    }
  }

  // Set the value at the target key
  const lastKey = keys[keys.length - 1]

  // Type guard to ensure lastKey is defined
  if (lastKey === undefined) {
    throw new Error(`Path ${path} is invalid: undefined key at end of path`)
  }

  if (!isNaN(Number(lastKey))) {
    const index = Number(lastKey)
    if (!Array.isArray(current)) {
      throw new Error(`Path ${path} is invalid: ${lastKey} is not an array index`)
    }
    if (index >= current.length) {
      throw new Error(`Path ${path} is invalid: array index ${index} is out of bounds`)
    }
    current[index] = value
  } else {
    current[lastKey] = value
  }
}

/**
 * Creates a new fixture file with overrides applied
 * @param sourceFixturePath - Path to the source fixture file
 * @param targetFixturePath - Path where the new fixture should be saved
 * @param overrides - Object containing path-based overrides
 * @param fixtureName - Optional new name for the fixture
 */
export async function createFixtureWithOverrides(
  sourceFixturePath: string,
  targetFixturePath: string,
  overrides: FixtureOverride = {},
  fixtureName?: string
): Promise<void> {
  const modifiedFixture = await loadFixtureWithOverrides(sourceFixturePath, overrides) as any

  // Update the fixture name if provided
  if (fixtureName) {
    modifiedFixture.name = fixtureName
  }

  await writeFile(targetFixturePath, JSON.stringify(modifiedFixture, null, 2))
}
