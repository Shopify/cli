---
title: Troubleshooting
---


# Vitest Mocking

We found out some issues with Vitest mocks, here is a list of detected problems and the solutions/workarounds:


## Mocks not clearing between tests
When mocking a function, always make sure to clear the mock after each test. There is an open issue where mocks are not cleared automatically even if you call `clearAllMocks()` or with the `clearMocks` config. [Issue Link](https://github.com/vitest-dev/vitest/issues/872)



### Problem

This is an example:

```ts
import foo from './path'
vi.mock('./path');
test('1', async () => {
  foo()
  expect(foo).toHaveBeenCalledTimes(1);
})

test('2', async () => {
  foo()
  expect(foo).toHaveBeenCalledTimes(1); //Will fail here, expected 1, received 2
  // Mock should have been cleared between tests
})
```

### Solution
Manually clear all mocks after each test:
```ts
import foo from './path'
vi.mock('./path');

afterEach(() => {
  vi.mocked(foo).clearMock()
})

// WARNING: This won't work:
afterEach(() => {
  vi.clearAllMocks()
})
```


## Mocking Module functions

### Problem

Usually you would create a module mock like this:

```typescript
// Option 1, all exported functions are mocked to vi.fn()
vi.mock('my-module')

// Option 2, customize the mocks for each module function
vi.mock('my-module', () => {
  functionA: vi.fn(),
  functionB: () => "foo",
  functionC: vi.fn(() => "foo")
})
```


- `functionA` has a default `vi.fn()` implementation that you can spy on, but returns nothing so it might not work with your current implementation if your code depends on the result.

- `functionB` has a custom mock implementation, that means you can put the result you need, BUT you can't spy on it, because it is not a `vi` function.

- `functionC` is a mix of both, a custom implementation inside a `vi.fn()` method that would allow you to also spy on it. This is the intended way ([link](https://vitest.dev/api/#vi-fn)).
But it doesn't work for us, looks like there is some bug that won't let us mock and spy at the same time.



### Solution

The correct (and cleaner!) approach would be:

```typescript
const import {functionA} from 'my-module'

// This will mock all functions with vi.fn() by default
vi.mock('my-module')

// Then we can specify our custom mock implementation
vi.mocked(functionA).mockImplementation(() => {foo: "bar"})

// OR:
// When the function returns a promise, we can also mock the resolved value
vi.mocked(functionA).mockResolvedValue({foo: "bar"})

// When the function doesn't return a promise we can just set a return value
vi.mocked(functionA).mockReturnValue({foo: "bar"})
```


This is the only way to have functions with custom mock implementations that can be spied on.
