#!/usr/bin/env node

// npm build && clear &&  npm start -- create test

'use strict';

import 'babel-polyfill';
import suspend from 'suspend';
import commander from 'commander';
import Beehives from './modules/Beehives';
import process from 'process';
import packageNpm from '../package.json';
import chalk from 'chalk';
import updateNotifier from 'update-notifier';

suspend(function*() {
  process.env.NODE_ENV = process.env.NODE_ENV === 'production' ? 'production' : 'development';

  const beehives = new Beehives();

  const handleReturn = (err) => {
    if (err) { console.error(chalk.red.bold(err.toString())); }
  };


  // Check if an update is available
  const pkg = require('../package.json');
  const notifier = new updateNotifier({
    pkg,
    updateCheckInterval: 1000 * 60 * 60 // Every hour
  });

  notifier.notify();

  if (notifier.update) {
    process.exit();
  }


  commander
    .command('create <serviceName>')
    .description('Create a new micro service')
    .action((serviceName) => beehives.create(serviceName, handleReturn));

  commander
    .command('deploy [directory]')
    .description('Deploy the micro service to beehives')
    .action((serviceDir) => beehives.deploy(serviceDir, handleReturn));

  commander
    .version(packageNpm.version)
    // .option('-d, --debug', 'Debug mode (increase verbosity)', debugMode)
    .parse(process.argv);


  if (!process.argv.slice(2).length) {
    commander.outputHelp();
  }

})();
