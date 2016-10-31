'use strict';

import suspend, { resume, resumeRaw } from 'suspend';
import ora from 'ora';
import chalk from 'chalk';
import fs from 'fs';
import targz from 'targz';
import Nes from 'nes';

function shd() {
  const packageJson = require('../../package.json');
  this._apiUrl = 'ws://localhost:8080';
  this._apiClientVersion = packageJson.version;
}


shd.prototype.spinnerStart = function(label) {
  this._spinner = ora(label).start();
};


shd.prototype.spinnerFail = function(error) {
  this._spinner.fail();
  console.error(chalk.red(error));
  process.exit();
};


shd.prototype.spinnerSucceed = function() {
  this._spinner.succeed();
};


shd.prototype.spinning = suspend.callback(function*(args) {
  this.spinnerStart(args.label);

  try {
    yield args.func.apply(this, [ ...args.args, resume() ]);
    this.spinnerSucceed();
  }
  catch (err) {
    this.spinnerFail(err);
  }
});


shd.prototype.checkConfigurationFile = suspend.callback(function*(serviceDir) {
  const lstat = yield fs.lstat(serviceDir + '/.servicesHub.json', resumeRaw());
  if (lstat[0]) {
    throw new Error('No ".servicesHub.json" file found! Are you in a servicesHub directory? Have you yet run "npm start"?');
  }
});


shd.prototype.wsConnect = suspend.callback(function*() {
  // TODO: pass clientVersion through payload or header
  this._apiClient = new Nes.Client(this._apiUrl + '/?clientVersion=' + this._apiClientVersion);

  this._apiClient.onError = () => { console.log('error'); process.exit(); };

  yield this._apiClient.connect({}, resume());
});


shd.prototype.wsDisconnect = suspend.callback(function*() {
  this._apiClient.disconnect();
});


shd.prototype.archiveCreate = suspend.callback(function*(serviceName, serviceDir) {

  const configuration = require(serviceDir + '/.servicesHub.json');
  const ignoreFiles = configuration.ignoreFiles || [];

  yield targz.compress({
    src: serviceDir,
    dest: `/tmp/services-hub-${serviceName}.tar.gz`,
    tar: {
      ignore: (name) => {
        for (const ignoreFile of ignoreFiles) {
          const reg = new RegExp(ignoreFile);
          if (reg.test(name) === true) {
            return true;
          }
        }
        return false;
      }
    },
    gz: {
      level: 9,
      memLevel: 9
    }
  }, resume());
});



shd.prototype.archiveUpload = suspend.callback(function*(serviceName, serviceDir) {

  const archive = yield fs.readFile(
    `/tmp/services-hub-${serviceName}.tar.gz`,
    resume()
  );


  this.spinnerStart('Upload archive');


  yield this._apiClient.subscribe(
    '/',
    (message, flags) => {
      message = JSON.parse(message);

      if (message.label) {
        this.spinnerStart(message.label);
      }
      else if (message.error) {
        this.spinnerFail(message.error);
      }
      else {
        this.spinnerSucceed();
      }
    },
    resume()
  );


  yield this._apiClient.request({
    path: '/archiveUpload',
    method: 'POST',
    payload: {
      name: serviceName,
      archive: archive.toString('base64')
    }
  }, resume());


  yield this._apiClient.unsubscribe('/', null, resume());
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
    args: []
  }, resume());

  yield this.spinning({
    label: 'Archive micro service',
    func: this.archiveCreate,
    args: [ serviceName, serviceDir ]
  }, resume());

  // yield this.spinning({
  //   label: 'Upload archive to servicesHub',
  //   func: this.archiveUpload,
  //   args: [ serviceName, serviceDir ]
  // }, resume());

  yield this.archiveUpload(serviceName, serviceDir, resume());


  yield this.spinning({
    label: 'Delete local archive',
    func: this.archiveDelete,
    args: [ serviceName, serviceDir ]
  }, resume());

  yield this.spinning({
    label: 'Disconnect from servicesHub',
    func: this.wsDisconnect,
    args: []
  }, resume());

  return true;
});


module.exports = shd;
