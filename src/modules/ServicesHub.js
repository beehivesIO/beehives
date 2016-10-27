'use strict';

import suspend, { resume } from 'suspend';
import ServicesHubCreate from './ServicesHubCreate';
import ServicesHubDeploy from './ServicesHubDeploy';


function ServicesHub() {}

ServicesHub.prototype.create = suspend.callback(function*(serviceName) {
  const servicesHubCreate = new ServicesHubCreate();
  return yield servicesHubCreate.create(serviceName, resume());
});



ServicesHub.prototype.deploy = suspend.callback(function*(serviceName) {
  const servicesHubDeploy = new ServicesHubDeploy();
  return yield servicesHubDeploy.deploy(resume());
});


module.exports = ServicesHub;
