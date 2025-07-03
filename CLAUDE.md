## WRITING TESTS
DO NOT ADD COMMENTS UNLESS TO OVERRIDE ESLINT DIRECTIVES
DO NOT us vi.clearAllMocks()
ALWAYS LINT THE TESTS AND CLEAN UP PRETTIER ERRORS ETC
ALWAYS TYPECHECK
ALWAYS RUN KNIP AND CHECK FOR UNUSED EXPORTS ETC

## TOOLS

### CLEAN A PACKAGE (e.g. store package)
pnpm nx run store:clean

### BUILD A PACKAGE (e.g. store package)
pnpm nx run store:build

### TEST A PACKAGE (e.g. store package)
pnpm nx run store:test

### TYPECHECK A PACKAGE (e.g. store package)
nx run store:type-check

### LINT A PACKAGE (e.g. store package)
pnpm nx run store:lint

### CHECK TEST COVERAGE FOR A PACKAGE (e.g. store package)
nx run store:test --coverage

### RUN FEATURES/CUCUMBER/ACCEPTANCE TEST FOR A PACKAGE (e.g store package)
FEATURE=features/store.feature pnpm nx run features:test

### RUN KNIP / CHECK FOR UNUSED EXPORTS
pnpm run knip

### UPDATE GRAPQHL SCHEMAS
pnpm graphql-codegen:get-graphql-schemas

### GENERATE GRAPHQL TYPES
pnpm graphql-codegen
