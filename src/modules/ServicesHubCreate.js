'use strict';

import suspend, { resume, resumeRaw } from 'suspend';
import fs from 'fs';
import { exec } from 'child_process';
import ora from 'ora';
import chalk from 'chalk';


function shc() {}


shc.prototype.spinning = suspend.callback(function*(args) {
  const spinner = ora(args.label).start();

  try {
    yield args.func.apply(this, [ ...args.args, resume() ]);
    spinner.succeed();
  }
  catch (err) {
    spinner.fail();
    throw err;
  }
});


shc.prototype.checkServiceName = suspend.callback(function*(serviceName) {
  if (!/^[a-z0-9\-]+$/.test(serviceName)) {
    throw new Error('Name has to be /^[a-z0-9\-]+$/');
  }
});


shc.prototype.checkFile = suspend.callback(function*(serviceName) {
  const lstat = yield fs.lstat(serviceName, resumeRaw());
  if (!lstat[0]) {
    throw new Error(`File or directory with name "${serviceName}" exists yet`);
  }
});


shc.prototype.createDirectory = suspend.callback(function*(serviceName) {
  yield fs.mkdir(serviceName, resume());
});


shc.prototype.createPackageJson = suspend.callback(function*(serviceName) {
  const packageJson = {
    name: serviceName,
    version: '0.0.1',
    private: true,
    scripts: {
      start: './start.sh'
    }
  };
  yield fs.writeFile(serviceName + '/package.json', JSON.stringify(packageJson), resume());
});


shc.prototype.modulesInstall = suspend.callback(function*(serviceName) {
  process.chdir(serviceName);
  yield exec('npm i --save services-hub-boilerplate-nodejs', resume());
});


shc.prototype.create = suspend.callback(function*(serviceName) {

  console.log(chalk.green(`
Creating micro service ${serviceName}...
  `));

  yield this.spinning({
    label: 'Check micro service name',
    func: this.checkServiceName,
    args: [ serviceName ]
  }, resume());


  yield this.spinning({
    label: 'Check file',
    func: this.checkFile,
    args: [ serviceName ]
  }, resume());


  yield this.spinning({
    label: 'Create directory',
    func: this.createDirectory,
    args: [ serviceName ]
  }, resume());


  yield this.spinning({
    label: 'Create package.json',
    func: this.createPackageJson,
    args: [ serviceName ]
  }, resume());


  yield this.spinning({
    label: 'Install modules (it could take a few minutes)',
    func: this.modulesInstall,
    args: [ serviceName ]
  }, resume());

  console.log(chalk.green(`
Your micro service has been successfully created. Awesome!

Now you can:

1. go to your micro service folder:
  # cd ${serviceName}

2. start your micro service:
  # npm start

3. edit routes in directory "routes/"

4. deploy it to the world:
  # services-hub deploy

Have fun :)
`));

  return true;
});


module.exports = shc;
