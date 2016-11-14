'use strict';

import suspend, { resume, resumeRaw } from 'suspend';
import ora from 'ora';
import chalk from 'chalk';
import fs from 'fs';
import targz from 'targz';
import Nes from 'nes';
import readline from 'readline';
import isemail from 'isemail';
import jsonFormat from 'json-format';
import crypto from 'crypto';
import packageJson from '../../package.json';

function shd() {
  // this._apiUrl = 'ws://localhost:10000';
  this._apiUrl = 'ws://sh.bacto.net:10000';
  this._apiClientVersion = packageJson.version;
}


shd.prototype.configurationLoad = suspend.callback(function*(configuration) {
  try {
    this._configuration = yield fs.readFile(
      this._serviceDir + '/.servicesHub.json',
      'utf8',
      resume()
    );
    this._configuration = JSON.parse(this._configuration);
  }
  catch (err) {
    throw new Error('No ".servicesHub.json" file found! Are you in a servicesHub directory? Have you run "npm start" for a first time?');
  }

});


shd.prototype.configurationSave = suspend.callback(function*(configuration) {
  this._configuration = Object.assign({}, configuration);

  yield fs.writeFile(
    this._serviceDir + '/.servicesHub.json',
    jsonFormat(this._configuration),
    'utf8',
    resume()
  );
});


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


shd.prototype.checkEmail = suspend.callback(function*() {
  if (this._configuration.email) {
    return;
  }


  // Ask for email
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let question = '\nYour email is required to deploy this service.\nWe will send you a link by email to validate it.\nWhat\'s your email? ';
  let email;
  while (!email) {
    email = yield rl.question(question, resumeRaw());
    email = email[0];

    if (!email || !isemail.validate(email)) {
      email = null;
      question = '\nYour email seems incorrect. What is your email? ';
    }
  }

  rl.close();

  // Create token
  let token = yield crypto.randomBytes(128, resume());
  token = token.toString('hex').substr(0, 128);

  // Save email and token
  const configuration = Object.assign({}, this._configuration, { email, token });
  yield this.configurationSave(configuration, resume());

  console.log('');
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


shd.prototype.packageCreate = suspend.callback(function*(serviceName) {
  const ignoreFiles = this._configuration.ignoreFiles || [];

  yield targz.compress({
    src: this._serviceDir,
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


shd.prototype.packageUpload = suspend.callback(function*(serviceName, email, token) {

  const packageDatas = yield fs.readFile(
    `/tmp/services-hub-${serviceName}.tar.gz`,
    resume()
  );


  this.spinnerStart('Upload package');


  yield this._apiClient.subscribe(
    '/spinner',
    (message) => {
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
    path: '/packageUpload',
    method: 'POST',
    payload: {
      name: serviceName,
      packageDatas: packageDatas.toString('base64'),
      email,
      token
    }
  }, resume());

  yield this._apiClient.unsubscribe('/spinner', null, resume());
});



shd.prototype.packageDelete = suspend.callback(function*(serviceName) {
  yield fs.unlink(
    `/tmp/services-hub-${serviceName}.tar.gz`,
    resume()
  );
});


shd.prototype.deploy = suspend.callback(function*(serviceDir) {
  serviceDir = serviceDir || process.env.PWD;
  this._serviceDir = serviceDir;

  console.log(chalk.green(`
Deploying service to servicesHub...
  `));

  yield this.configurationLoad(resume());
  yield this.checkEmail(resume());

  const { email, token } = this._configuration;
  const serviceName = this._configuration.name;


  yield this.spinning({
    label: 'Connect to servicesHub',
    func: this.wsConnect,
    args: []
  }, resume());

  yield this.spinning({
    label: 'Package micro service',
    func: this.packageCreate,
    args: [ serviceName ]
  }, resume());


  yield this.packageUpload(serviceName, email, token, resume());


  yield this.spinning({
    label: 'Delete local package',
    func: this.packageDelete,
    args: [ serviceName ]
  }, resume());

  yield this.spinning({
    label: 'Disconnect from servicesHub',
    func: this.wsDisconnect,
    args: []
  }, resume());

  return true;
});


module.exports = shd;
