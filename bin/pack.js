#!/usr/bin/env node

import { program } from "commander";
import {execa} from "execa";
import tempy from 'tempy';

program
    .argument('<cli>', 'The CLI to export')
    .option('-o, --output <directory>', 'The directory to export the CLI into');

program.parse()

await tempy.directory.task(async (temporaryDirectory) => {
    console.log(temporaryDirectory);
})

