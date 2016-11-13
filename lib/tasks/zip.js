(function () {
  'use strict';

  var fs = require('fs-extra');
  var Task = require('ember-cli/lib/models/task');
  var path = require('path');
  var archiver = require('archiver');

  module.exports = Task.extend({
    run: function (runTaskOptions) {
      return zipDir(runTaskOptions.zipFile, runTaskOptions.srcDir, runTaskOptions.verbose);
    }
  });

  function zipDir(zipFile, srcDir, verbose) {
    return new Promise(function (resolve, reject) {
      try {
        var archive = archiver('zip');
        archive.on('entry', function (data) {
          if (!!verbose) {
            console.log('adding file ' + data.name);
          }
        });
        archive.directory(srcDir, '');
        archive.finalize();
        archive.pipe(fs.createWriteStream(zipFile))
          .on('close', function () {
            if (!!verbose) {
              console.log('contents written to ' + zipFile);
            }
            resolve();
          });
      } catch (err) {
        console.log(err);
        reject();
      }
    });
  }
})();