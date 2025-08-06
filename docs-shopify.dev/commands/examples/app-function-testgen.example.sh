#!/bin/bash

# Generate test files from a specific function run log
shopify app function testgen --log abcdef

# Generate test files with a custom output directory
shopify app function testgen --log abcdef --output-dir my-test-files

# Generate test files by selecting from available logs
shopify app function testgen
