(function () {
  'use strict';

  var Task = require('ember-cli/lib/models/task');
  var spawn = require('child_process').spawn;

  module.exports = Task.extend({
    run: function (runTaskOptions) {
      return new Promise(function (resolve, reject) {
        var logOutput = runTaskOptions.verbose;
        var command = runTaskOptions.command;
        var commandArgs = runTaskOptions.commandArgs;
        var commandOptions = runTaskOptions.commandOptions;
        console.log('running command ' + command + ' with args ' + JSON.stringify(commandArgs));
        var cmd = spawn(command, commandArgs, commandOptions);
        if (logOutput) {
          cmd.stdout.pipe(process.stdout);
        }
        cmd.stderr.pipe(process.stderr);
        cmd.on('close', function (code) {
          code === 0 ? resolve(code) : reject(code);
        });
      });
    }
  });


})();