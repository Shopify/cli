// Manual test script to verify bundling error visibility (issue #2092)
import {bundleExtension} from './src/cli/services/extensions/bundle.js'
import {Writable} from 'stream'
import {resolve} from 'path'

console.log('Testing bundling error visibility for issue #2092...\n');

// Capture stderr output
let stderrOutput = '';
const stderr = new Writable({
  write(chunk, _encoding, callback) {
    const text = chunk.toString();
    stderrOutput += text;
    // Also write to real stderr so we can see it
    process.stderr.write(chunk);
    callback();
  },
});

// Stdout for any warnings
const stdout = new Writable({
  write(chunk, _encoding, callback) {
    process.stdout.write(chunk);
    callback();
  },
});

async function testBundlingErrors() {
  console.log('1. Testing with syntax errors in the code...\n');
  
  try {
    await bundleExtension({
      env: {},
      outputPath: '/tmp/test-output.js',
      minify: false,
      environment: 'development',
      stdin: {
        contents: `
          // This code has intentional errors
          import { nonExistent } from 'missing-module';
          
          // Syntax error: missing closing parenthesis
          console.log('Hello world'
          
          // Reference error
          const x = undefinedVariable;
          
          // Type error
          const num: number = "not a number";
        `,
        resolveDir: process.cwd(),
        loader: 'tsx',
      },
      stdout,
      stderr,
    });
    
    console.log('\n❌ ERROR: Bundling should have failed but it succeeded!');
  } catch (error) {
    console.log('\n✅ Bundling failed as expected');
    console.log(`   Error message: ${error.message}`);
  }
  
  console.log('\n2. Checking if errors were displayed to stderr...\n');
  
  if (stderrOutput.trim()) {
    console.log('✅ Errors were displayed without --verbose flag:');
    console.log('   Total error output length:', stderrOutput.length, 'characters');
    
    // Check for specific error indicators
    const hasErrorMarker = /\[ERROR\]/.test(stderrOutput);
    const hasErrorDetails = stderrOutput.length > 50; // Should have substantial error details
    
    console.log(`   Contains [ERROR] marker: ${hasErrorMarker ? '✅' : '❌'}`);
    console.log(`   Has detailed error info: ${hasErrorDetails ? '✅' : '❌'}`);
    
    if (!hasErrorMarker || !hasErrorDetails) {
      console.log('\n❌ ERROR: Error output does not contain expected details');
      console.log('This means issue #2092 is NOT fixed!');
    } else {
      console.log('\n✅ SUCCESS: Issue #2092 is fixed - errors are visible without --verbose');
    }
  } else {
    console.log('❌ ERROR: No errors were written to stderr!');
    console.log('This means issue #2092 is NOT fixed!');
  }
  
  console.log('\n3. Testing with file import errors...\n');
  
  // Reset stderr output
  stderrOutput = '';
  
  try {
    await bundleExtension({
      env: {},
      outputPath: '/tmp/test-output2.js',
      minify: false,
      environment: 'development',
      stdin: {
        contents: `import './test-bundling-error-example.ts';`,
        resolveDir: process.cwd(),
        loader: 'tsx',
      },
      stdout,
      stderr,
    });
    
    console.log('\n❌ ERROR: Bundling should have failed but it succeeded!');
  } catch (error) {
    console.log('✅ Bundling failed as expected when importing error file');
    
    if (stderrOutput.trim()) {
      console.log('✅ Import errors were also displayed properly');
    } else {
      console.log('❌ ERROR: Import errors were not displayed!');
    }
  }
}

// Run the test
testBundlingErrors().then(() => {
  console.log('\n--- Test complete ---\n');
  process.exit(0);
}).catch((error) => {
  console.error('\nUnexpected error during test:', error);
  process.exit(1);
});