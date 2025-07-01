// Test file with intentional errors to verify bundling error visibility
// This file is used to test that issue #2092 is resolved

// Error 1: Import from non-existent module
import { someFunction } from 'non-existent-module';

// Error 2: Syntax error - missing closing parenthesis
console.log('This has a syntax error'

// Error 3: Reference error - undefined variable
const config = {
  apiKey: undefinedVariable,
  setting: true
};

// Error 4: Type error in TypeScript
const numberValue: number = "this should be a number";

// Error 5: Missing closing brace
function brokenFunction() {
  if (true) {
    console.log('Missing closing brace');
  // Missing closing brace here

export default function() {
  someFunction();
  return config;
}