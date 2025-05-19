#!/usr/bin/env node
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const fs = require("fs");

/**
 * This takes a combined coverage file and creates a report in the format expected by our coverage tools.
 */

const masterCoverageFile = process.cwd() + "/coverage/coverage-final.json";
const sourceReportFile = process.cwd() + "/coverage/report.json";
const masterReportFile = process.cwd() + "/report.json";

// Read the coverage report from vitest
const coverageData = require(masterCoverageFile);

// Read the test results from the report
const masterCoverage = require(sourceReportFile);
masterCoverage.coverageMap = coverageData;

// write it out
fs.writeFile(masterReportFile, JSON.stringify(masterCoverage), (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }

  console.log("Coverage report saved to " + masterReportFile);
});
