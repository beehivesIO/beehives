'use strict';

import suspend from 'suspend';
import commander from 'commander';
import ServicesHub from './modules/ServicesHub';
import process from 'process';
import packageNpm from './package.json';
import chalk from 'chalk';

suspend(function*() {
  const servicesHub = new ServicesHub();

  const handleReturn = (err) => {
    if (err) { console.error(chalk.red.bold(err.toString())); }
  };


  // TODO: compare local cli version to npm version available

  commander
    .command('create <serviceName>')
    .description('Create a new micro service')
    .action((serviceName) => servicesHub.create(serviceName, handleReturn));

  commander
    .version(packageNpm.version)
    // .option('-d, --debug', 'Debug mode (increase verbosity)', debugMode)
    .parse(process.argv);

})();
