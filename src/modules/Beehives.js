'use strict';

import suspend, { resume } from 'suspend';
import BeehivesCreate from './BeehivesCreate';
import BeehivesDeploy from './BeehivesDeploy';


function Beehives() {}

Beehives.prototype.create = suspend.callback(function*(serviceName) {
  const beehivesCreate = new BeehivesCreate();
  return yield beehivesCreate.create(serviceName, resume());
});



Beehives.prototype.deploy = suspend.callback(function*(serviceDir) {
  const beehivesDeploy = new BeehivesDeploy();
  return yield beehivesDeploy.deploy(serviceDir, resume());
});


module.exports = Beehives;
