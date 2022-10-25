## Debugging

The CLI works well with VS Code's built-in debugger -- feel free to use breakpoints across the constituent packages and Typescript files.

The current recommended practise for testing is to run the "Javascript Debug Terminal" command in VS Code. This launches a terminal where the debugger is automatically attached to any node process. If you there execute `yarn shopify` (build and run) or `yarn shopify:run` (just run), the CLI will be launched and you can provide any desired arguments for the feature you are testing. As the debugger is automatically attached, any breakpoints you've set will be triggered when they're encountered.
