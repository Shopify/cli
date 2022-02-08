The `os` module from `@shopify/cli-kit` provides utilities for reading information and interacting with the operative system in which the CLI is running:

### Get the username

If you need to get the current user, you can call the following function:

```ts
import { os } from "@shopify/cli-kit"

const username = await os.username();
```
