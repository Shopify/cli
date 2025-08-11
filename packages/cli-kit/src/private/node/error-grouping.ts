/**
 * Error grouping module for generating consistent grouping keys for errors.
 * This module provides utilities to sanitize sensitive data and generate
 * stable keys for error grouping in Observe.
 */

// Main functions - only export what's actually used externally
export {generateGroupingKey} from './error-grouping/key-generator.js'
export {extractErrorContext} from './error-grouping/context-extractor.js'
