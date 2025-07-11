export function checkForUndefinedFieldError(error: Error): boolean {
  if (error.name === 'GraphQLClientError') {
    const graphQLError = error as Error & {
      errors?: {message: string; extensions?: {code: string; fieldName: string}}[]
    }
    if (graphQLError.errors && graphQLError.errors.length > 0) {
      const undefinedField = graphQLError.errors.find((err) => err.extensions?.code === 'undefinedField')
      if (undefinedField && undefinedField.extensions?.fieldName.includes('bulkDataStore')) {
        return true
      }
    }
  }
  return false
}
