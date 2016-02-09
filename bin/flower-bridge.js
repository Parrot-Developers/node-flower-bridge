#!/usr/bin/env node
"use strict";
let argv = require('minimist')(process.argv.slice(2));
let commander = require('commander');
let FlowerBridge = require('../lib/FlowerBridge');
let credentials = require('../credentials');

commander
  .usage('[-slu] [options] [-A] <uuid1 uuid2 ...>')
  .option('-s, --synchronize', 'synchronize flower powers')
  .option('-l, --live', 'active live mode for a flower power for 10 seconds by default')
  .option('-u, --update [file]', 'update the firmware [lastest version]')
  .option('-A, --all', 'use all flower powers in the account')
  .parse(process.argv)

let brooklyn = new FlowerBridge();

// brooklyn.loginToApi(credentials, function(err) {
// 	if (err) {
// 		console.error(err.toString());
// 		process.exit(1);
// 	}

  brooklyn.for(commander.all || commander.agrs, commander)
// });

console.log(' + sync: %j', commander.synchronize || false);
console.log(' + update: %j', commander.update || false);
