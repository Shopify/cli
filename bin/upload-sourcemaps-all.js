#!/usr/bin/env node

import fs from 'fs';
import fsPromise from 'fs/promises'
import path from 'node:path';
import { fileURLToPath } from 'url';
import { node } from "@bugsnag/source-maps";
import reportBuild from 'bugsnag-build-reporter';
import tmp from 'tmp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appVersion = JSON.parse(fs.readFileSync(`${__dirname}/../packages/cli/package.json`)).version;
const apiKey = '9e1e6889176fd0c795d5c659225e0fae';

// List of packages that contribute to runtime and need sourcemaps uploaded
const PACKAGES_TO_UPLOAD = [
  'cli',
  'cli-kit',
  'app',
  'theme',
  'store',
  'create-app',
  'plugin-cloudflare',
  'plugin-did-you-mean',
  'ui-extensions-dev-console',
  'ui-extensions-server-kit',
];

async function uploadPackageSourcemaps(packageName, temporaryDirectory) {
  const sourceDirectory = path.join(__dirname, '..', 'packages', packageName);
  
  // Check if package exists
  if (!fs.existsSync(sourceDirectory)) {
    console.log(`Package ${packageName} not found, skipping`);
    return;
  }
  
  // Check if package has a dist directory
  const distPath = path.join(sourceDirectory, 'dist');
  if (!fs.existsSync(distPath)) {
    console.log(`Package ${packageName} has no dist directory, skipping`);
    return;
  }
  
  console.log(`Preparing @shopify/${packageName}`);
  
  const temporaryShopifyPackage = path.join(temporaryDirectory, '@shopify');
  await fsPromise.mkdir(temporaryShopifyPackage, { recursive: true });
  const temporaryPackageCopy = path.join(temporaryShopifyPackage, packageName);
  await fsPromise.mkdir(temporaryPackageCopy, { recursive: true });
  
  // Copy dist folder (compiled files + sourcemaps)
  const targetDistPath = path.join(temporaryPackageCopy, 'dist');
  await fsPromise.mkdir(targetDistPath, { recursive: true });
  fs.cpSync(distPath, targetDistPath, {recursive: true});
  
  // Copy src folder (original source files for surrounding code extraction)
  const srcPath = path.join(sourceDirectory, 'src');
  if (fs.existsSync(srcPath)) {
    const targetSrcPath = path.join(temporaryPackageCopy, 'src');
    await fsPromise.mkdir(targetSrcPath, { recursive: true });
    fs.cpSync(srcPath, targetSrcPath, {recursive: true});
    
    // Count files to verify copy
    const { default: glob } = await import('fast-glob');
    const srcFiles = glob.sync(`${targetSrcPath}/**/*.ts`, {onlyFiles: true});
    console.log(`  Copied ${srcFiles.length} TypeScript files to @shopify/${packageName}/src`);
  } else {
    console.log(`  Warning: No src directory found for ${packageName}`);
  }
  
  // Copy bin folder (entry point scripts)
  const binPath = path.join(sourceDirectory, 'bin');
  if (fs.existsSync(binPath)) {
    const targetBinPath = path.join(temporaryPackageCopy, 'bin');
    await fsPromise.mkdir(targetBinPath, { recursive: true });
    fs.cpSync(binPath, targetBinPath, {recursive: true});
  }
  
  // Copy package.json for metadata
  const packageJsonPath = path.join(sourceDirectory, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    fs.cpSync(packageJsonPath, path.join(temporaryPackageCopy, 'package.json'));
  }
  
  console.log(`Prepared structure for @shopify/${packageName}`);
}


(async () => {
  try {
    await new Promise((resolve, reject) => {
      tmp.dir({unsafeCleanup: true}, async (err, temporaryDirectory) => {
        if (err) {
          reject(err);
        }
        try {
          // Upload sourcemaps for all packages
          for (const packageName of PACKAGES_TO_UPLOAD) {
            await uploadPackageSourcemaps(packageName, temporaryDirectory);
          }
          
          // Debug: List what we're about to upload
          console.log('\n=== Upload Summary ===');
          const { default: glob } = await import('fast-glob');
          const allFiles = glob.sync('**/*', {cwd: temporaryDirectory, onlyFiles: true});
          const tsFiles = allFiles.filter(f => f.endsWith('.ts'));
          const mapFiles = allFiles.filter(f => f.endsWith('.map'));
          const jsFiles = allFiles.filter(f => f.endsWith('.js'));
          
          console.log(`Total files to upload: ${allFiles.length}`);
          console.log(`  - TypeScript files: ${tsFiles.length}`);
          console.log(`  - Sourcemap files: ${mapFiles.length}`);
          console.log(`  - JavaScript files: ${jsFiles.length}`);
          
          // Show directory structure
          const dirs = glob.sync('**/', {cwd: temporaryDirectory, onlyDirectories: true});
          const srcDirs = dirs.filter(d => d.includes('/src'));
          console.log(`\nSource directories (${srcDirs.length}):`, srcDirs.slice(0, 10));
          
          if (tsFiles.length === 0) {
            console.error('\n⚠️  WARNING: No TypeScript files found! Sourcemap resolution may fail.');
          }
          console.log('==================\n');
          
          console.log('Uploading all sourcemaps to Bugsnag/Observe');
          process.chdir(temporaryDirectory);
          
          await node.uploadMultiple({
            apiKey,
            appVersion,
            overwrite: true,
            directory: '.',
            endpoint: 'https://error-analytics-production.shopifysvc.com/api/v1/sourcemap/browser'
          });
          
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });
    
    // Clean sourcemaps from all packages after upload
    console.log('Cleaning sourcemaps from packages');
    for (const packageName of PACKAGES_TO_UPLOAD) {
      const packageDist = path.join(__dirname, '..', 'packages', packageName, 'dist');
      if (!fs.existsSync(packageDist)) continue;
      
      // Use dynamic import for fast-glob
      const { default: glob } = await import('fast-glob');
      const sourcemaps = glob.sync(`${packageDist}/**/*.map`, {onlyFiles: true});
      
      for (const sourcemap of sourcemaps) {
        fs.rmSync(sourcemap);
      }
      console.log(`Cleaned ${sourcemaps.length} sourcemaps from @shopify/${packageName}`);
    }
    
    await reportBuild({apiKey, appVersion}, {})
    console.log('Build reported!')
  } catch (err) {
    console.log('Failed to upload sourcemaps!', err.message)
    process.exit(1);
  }
})();