#!/usr/bin/env node

const { execSync } = require('child_process');

const SCRIPT_PATH = './scripts/smartpy-cli/SmartPy.sh';

const args = process.argv.join(' ') ;

var CMD = `${SCRIPT_PATH} originate-contract`;

try {
    console.log();
    console.log(execSync(`${CMD} ${args} --private-key ${process.env.DEP_PR_KEY} `).toString());
    console.log();
} catch (e) {
    console.error(e.output.toString() || e);
}
