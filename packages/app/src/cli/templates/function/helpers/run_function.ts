import {spawn} from 'child_process'
import path from 'path'

export async function runFunction(exportName: string, input: any) {
  try {
    const inputJson = JSON.stringify(input);

    // Calculate paths correctly:
    // __dirname = /path/to/function/tests/helpers
    // functionDir = /path/to/function (go up 2 levels from helpers)
    // appRootDir = /path/to (go up 1 more level to get to app root)
    const functionDir = path.dirname(path.dirname(__dirname));
    const appRootDir = path.dirname(functionDir);
    const functionName = path.basename(functionDir);

    return new Promise((resolve, reject) => {
      const shopifyProcess = spawn('shopify', [
        'app', 'function', 'run',
        '--export', exportName,
        '--json',
        '--path', functionName
      ], {
        cwd: appRootDir,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      shopifyProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      shopifyProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      shopifyProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Command failed with exit code ${code}: ${stderr}`));
          return;
        }

        let result: any;
        try {
          result = JSON.parse(stdout);

          let actualOutput;
          if (result?.output?.humanized) {
            actualOutput = JSON.parse(result.output.humanized);
          } else if (result?.output) {
            actualOutput = result.output;
          } else {
            actualOutput = result;
          }

          resolve({
            result: { output: actualOutput },
            error: null,
          });
        } catch (parseError) {
          resolve({
            result: { output: stdout.trim() },
            error: null,
          });
        }
      });

      shopifyProcess.on('error', (error) => {
        reject(new Error(`Failed to start shopify command: ${error.message}`));
      });

      shopifyProcess.stdin.write(inputJson);
      shopifyProcess.stdin.end();
    });

  } catch (error) {
    if (error instanceof Error) {
      return {
        result: null,
        error: error.message,
      };
    } else {
      return {
        result: null,
        error: 'Unknown error occurred',
      };
    }
  }
}

