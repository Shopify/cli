import {ESLint} from 'eslint'

interface RunESLintOptions {
  files: string[]
  rulePaths: string[]
  rules: Record<string, 'off' | 'warn' | 'error'>
}

export async function runESLint({files, rulePaths, rules}: RunESLintOptions) {
  const eslint = new ESLint({
    useEslintrc: false,
    baseConfig: {},
    overrideConfig: {
      parser: '@typescript-eslint/parser',
      parserOptions: {
        requireConfigFile: false,
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
        warnOnUnsupportedTypeScriptVersion: false,
        // babelOptions: {
          // presets: [
            // ["@babel/preset-env", { "modules": false }],
            // "@babel/preset-react",
            // "@babel/preset-typescript",
          // ],
        // },
      },
      rules,
    },
    rulePaths,
  })

  const results = await eslint.lintFiles(files);

  const structuredResults = results.map((result: any) => ({
    filePath: result.filePath,
    messages: result.messages.map((message: any) => ({
      severity: message.severity,
      message: message.message,
      line: message.line,
      column: message.column,
    })),
  })).filter((result: any) => result.messages.length > 0)
  const formatter = await eslint.loadFormatter("stylish")
  const resultText = formatter.format(results)

  return {
    text: resultText,
    json: structuredResults,
  }
}
