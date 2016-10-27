'use strict';

import suspend, { resume, resumeRaw } from 'suspend';
import ora from 'ora';
import chalk from 'chalk';
import WebSocket from 'ws';
import fs from 'fs';
import targz from 'tar.gz';

function shd() {
  const packageJson = require('../../package.json');
  this._apiUrl = 'ws://localhost:8080';
  this._clientVersion = packageJson.version;
  this._spinners = {};
}


shd.prototype.spinning = suspend.callback(function*(args) {
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



shd.prototype.checkConfigurationFile = suspend.callback(function*(serviceDir) {
  const lstat = yield fs.lstat(serviceDir + '/.servicesHub.json', resumeRaw());
  if (lstat[0]) {
    throw new Error('No ".servicesHub.json" file found! Are you in a servicesHub directory?');
  }
});


shd.prototype.wsConnect = suspend.callback(function*(serviceName) {
  this._ws = new WebSocket(this._apiUrl + '/?clientVersion=' + this._clientVersion);

  this._ws.on(
    'error',
    (err) => { throw new Error('Can\'t connect to servicesHub'); }
  );

  this._ws.on(
    'message',
    (message) => { this.wsOnMessage(message, () => {}); }
  );

  yield this._ws.on('open', resume());
});


shd.prototype.wsOnMessage = suspend.callback(function*(message) {
  message = JSON.parse(message);

  if (message.action === 'spinning') {
    if (!this._spinners[message.label]) {
      this._spinners[message.label] = ora(message.label).start();
    }
    else if (message.succeed) {
      this._spinners[message.label].succeed();
    }
    else if (message.error) {
      this._spinners[message.label].fail();
      console.error(message.error);
      throw new Error(message.error);
    }
  }
  else if (message.action === 'error') {
    console.error(message.error);
    throw new Error(message.error);
  }
  else {
    console.error('Unknown action');
    throw new Error('Unknown action');
  }
});


shd.prototype.archiveCreate = suspend.callback(function*(serviceName, serviceDir) {

  // TODO: remove files from .gitignore
  yield targz().compress(
    serviceDir,
    `/tmp/services-hub-${serviceName}.tar.gz`
  );
});



shd.prototype.archiveUpload = suspend.callback(function*(serviceName, serviceDir) {

  const archive = yield fs.readFile(
    `/tmp/services-hub-${serviceName}.tar.gz`,
    resume()
  );

  yield this._ws.send(
    JSON.stringify({
      action: 'deploy',
      name: serviceName,
      archive: archive.toString('base64'),
      sshKey: ''
    }),
    resume()
  );
});



shd.prototype.archiveDelete = suspend.callback(function*(serviceName, serviceDir) {
  yield fs.unlink(
    `/tmp/services-hub-${serviceName}.tar.gz`,
    resume()
  );
});


shd.prototype.deploy = suspend.callback(function*(serviceDir) {

  serviceDir = serviceDir || process.env.PWD;

  console.log(chalk.green(`
Deploying service to servicesHub...
  `));


  yield this.spinning({
    label: 'Check configuration file',
    func: this.checkConfigurationFile,
    args: [ serviceDir ]
  }, resume());

  const configuration = require(serviceDir + '/.servicesHub.json');
  const serviceName = configuration.name;

  yield this.spinning({
    label: 'Connect to servicesHub',
    func: this.wsConnect,
    args: [ serviceName ]
  }, resume());

  yield this.spinning({
    label: 'Archive micro service',
    func: this.archiveCreate,
    args: [ serviceName, serviceDir ]
  }, resume());

  yield this.spinning({
    label: 'Upload archive to servicesHub',
    func: this.archiveUpload,
    args: [ serviceName, serviceDir ]
  }, resume());

  yield this.spinning({
    label: 'Delete local archive',
    func: this.archiveDelete,
    args: [ serviceName, serviceDir ]
  }, resume());

  return true;
});


module.exports = shd;
