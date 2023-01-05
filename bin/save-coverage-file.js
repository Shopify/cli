#!/usr/bin/env node
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const fs = require("fs");

/**
 * This takes a large combined Jest-format coverage file, and a collection of JSON test reports, and combines them into one master file.
 */

const coveragePackages = ["cli", "cli-kit", "app"];

const masterCoverageFile = process.cwd() + "/coverage.raw.json";
const masterReportFile = process.cwd() + "/report.json";

// Create the starting file -- the master coverage file and empty test results
const masterCoverage = {
  numTotalTestSuites: 0,
  numPassedTestSuites: 0,
  numFailedTestSuites: 0,
  numPendingTestSuites: 0,
  numTotalTests: 0,
  numPassedTests: 0,
  numFailedTests: 0,
  numPendingTests: 0,
  numTodoTests: 0,
  startTime: 999999999999999,
  success: true,
  testResults: [],
  coverageMap: require(masterCoverageFile),
};

// merge each package's test results into the master file
coveragePackages.forEach((pkg) => {
  const testReportFilename =
    process.cwd() + `/packages/${pkg}/coverage/report.json`;
  const testReport = require(testReportFilename);
  masterCoverage.numTotalTestSuites += testReport.numTotalTestSuites;
  masterCoverage.numPassedTestSuites += testReport.numPassedTestSuites;
  masterCoverage.numFailedTestSuites += testReport.numFailedTestSuites;
  masterCoverage.numPendingTestSuites += testReport.numPendingTestSuites;
  masterCoverage.numTotalTests += testReport.numTotalTests;
  masterCoverage.numPassedTests += testReport.numPassedTests;
  masterCoverage.numFailedTests += testReport.numFailedTests;
  masterCoverage.numPendingTests += testReport.numPendingTests;
  masterCoverage.numTodoTests += testReport.numTodoTests;
  masterCoverage.startTime = Math.min(
    masterCoverage.startTime,
    testReport.startTime
  );
  masterCoverage.success = masterCoverage.success && testReport.success;
  masterCoverage.testResults = [
    ...masterCoverage.testResults,
    ...testReport.testResults,
  ];
});

// write it out
fs.writeFile(masterReportFile, JSON.stringify(masterCoverage), (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }

  console.log("Coverage report appended to " + masterReportFile);
});
