'use strict';

import suspend, { resume } from 'suspend';
import ServicesHubCreate from './ServicesHubCreate';


function ServicesHub() {}

ServicesHub.prototype.create = suspend.callback(function*(serviceName) {
  const servicesHubCreate = new ServicesHubCreate();
  return yield servicesHubCreate.create(serviceName, resume());
});


module.exports = ServicesHub;
