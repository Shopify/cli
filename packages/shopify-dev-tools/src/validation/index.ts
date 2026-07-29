// Component-code validation. Importing this pulls in `typescript` + `html-tags`
// via createVirtualTSEnvironment; import "./graphql" instead if you only need
// GraphQL validation and want to avoid those.
export { validateComponentCodeBlock } from "./validateComponentCodeBlock";

// GraphQL operation validation lives in its own module so it can be imported
// without dragging in the TypeScript-based component validator.
export {
  validateGraphQLOperation,
  hasFailedValidation,
  type GraphQLValidationOptions,
} from "./graphql.js";
