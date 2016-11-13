/* jshint node: true */
'use strict';

module.exports = {
  name: 'ember-cli-sfdc-deploy',

  includedCommands: function () {
    return {
      'sfdc:deploy': require('./lib/commands/deploy')
    };
  }
};