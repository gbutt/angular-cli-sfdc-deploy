(function () {
  'use strict';

  var path = require('path');
  var fs = require('fs-extra');
  var xml2js = require('xml2js');
  var inquire = require('inquirer');
  var jsforceMetadataTools = require('jsforce-metadata-tools');


  var CliConfig = require('angular-cli/models/config').CliConfig;
  var Command = require('ember-cli/lib/models/command');
  var ZipTask = require('../tasks/zip');
  var ExecTask = require('../tasks/exec');

  module.exports = Command.extend({
    name: 'sfdc:deploy',
    description: 'Deploy your app to Salesforce as a static resource',
    works: 'insideProject',

    availableOptions: buildAvailableOptions(),

    run: function (options, rawArgs) {
      var self = this;
      this.project.ngConfig = CliConfig.fromProject().config;
      var outDir = this.project.ngConfig.apps[0].outDir;

      // build addon configuration
      var addonConfig = buildAddonConfiguration('sfdc');

      return runDeploy().then(function (success) {
          if (!success) {
            process.exit(1);
          } else {
            process.exit(0);
          }
        })
        .catch(function () {
          process.exit(1);
        });

      function buildAddonConfiguration(addonName) {
        var config = {
          name: self.project.pkg.name,
          description: self.project.pkg.description,
          environment: 'prod',
          deployDir: 'deploy'
        };
        // merge angular-cli config
        Object.assign(config, (self.project.ngConfig.addons.find(addon => {
          return addon[addonName] !== undefined;
        }) || {})[addonName]);
        // merge config file
        try {
          var configFile = JSON.parse(fs.readFileSync(options.configFile));
          Object.assign(config, configFile);
        } catch (err) {}
        // merge commandline options
        Object.assign(config, options);
        return config;
      }

      function runDeploy() {
        // ng build
        return buildApp()
          .then(preparePackage)
          .then(promptForCredentials)
          .then(deployPackageDirectory);
      }

      function buildApp() {
        if (addonConfig.skipBuild) {
          console.log('Skipping ng build');
          return Promise.resolve();
        }
        console.log('Running ng build');
        var env = addonConfig.environment;
        return runCommand('ng', ['build', '--environment=' + env], addonConfig);
      }

      function preparePackage() {
        console.log('Preparing deployment package');
        // create deploy folder
        fs.ensureDirSync(path.resolve(addonConfig.deployDir, 'src/staticresources'));
        // create deploy/src/staticresources/package.name.resource-meta.xml
        var xmlBuilder = new xml2js.Builder({
          xmldec: {
            vresion: '1.0',
            standalone: undefined,
            encoding: 'UTF-8'
          }
        });
        fs.writeFileSync(path.resolve(addonConfig.deployDir, 'src/staticresources', addonConfig.name + '.resource-meta.xml'),
          xmlBuilder.buildObject({
            StaticResource: {
              '$': {
                xmlns: 'http://soap.sforce.com/2006/04/metadata'
              },
              cacheControl: 'Public',
              contentType: 'application/zip',
              description: addonConfig.description
            }
          })
        );
        // create deploy/src/package.xml
        return createPackageXml(xmlBuilder).then(function () {
          // zip contents into deploy/src/staticresources/package.name.resource
          return zipDir(path.resolve(addonConfig.deployDir, 'src/staticresources', addonConfig.name + '.resource'), outDir, addonConfig);
        })
      }

      // this function will try to parse an existing package.xml and merge the static resource into it.
      function createPackageXml(xmlBuilder) {
        return new Promise(function (resolve, reject) {
            var parser = new xml2js.Parser();
            fs.readFile(path.resolve(addonConfig.deployDir, 'src/package.xml'), function (err, data) {
              if (data) {
                parser.parseString(data, function (err, result) {
                  resolve(result);
                });
              } else {
                resolve({
                  Package: {
                    '$': {
                      xmlns: 'http://soap.sforce.com/2006/04/metadata'
                    },
                    types: [],
                    version: '37.0'
                  }
                });
              }
            });
          })
          .then(function (packageXml) {
            var srTypes = packageXml.Package.types.find(function (type) {
              return type.name[0] === 'StaticResource';
            });
            if (!srTypes) {
              packageXml.Package.types.push({
                members: [addonConfig.name],
                name: ['StaticResource']
              });
            } else if (!srTypes.members.find(function (member) {
                return member === addonConfig.name || member === '*'
              })) {
              srTypes.members.push(addonConfig.name);
            }
            return xmlBuilder.buildObject(packageXml)
          })
          .then(function (xmlContent) {
            return new Promise(function (resolve, reject) {
              fs.writeFile(path.resolve(addonConfig.deployDir, 'src/package.xml'), xmlContent, function (err) {
                err ? reject(err) : resolve();
              });
            });
          });
      }

      function promptForCredentials() {
        console.log('Gathering SF credentials');
        var questions = [];
        if (!addonConfig.loginUrl || !addonConfig.noPrompt) {
          questions.push({
            type: 'list',
            name: 'loginUrl',
            message: 'Login URL',
            choices: ['https://test.salesforce.com', 'https://login.salesforce.com'],
            default: addonConfig.loginUrl
          });
        }
        if (!addonConfig.username || !addonConfig.noPrompt) {
          questions.push({
            type: 'input',
            name: 'username',
            message: 'Username',
            default: addonConfig.username
          });
        }
        if (!addonConfig.password || !addonConfig.noPrompt) {
          questions.push({
            type: 'password',
            name: 'password',
            message: 'Password'
          });
        }
        if (questions.length > 0) {
          return inquire.prompt(questions).then(function (answers) {
            Object.assign(addonConfig, answers);
          });
        } else {
          return Promise.resolve();
        }
      }

      function deployPackageDirectory() {
        var deployOpts = {
          allowMissingFiles: true,
          pollInterval: addonConfig.pollInterval,
          pollTimeout: addonConfig.pollTimeout,
          username: addonConfig.username,
          password: addonConfig.password,
          loginUrl: addonConfig.loginUrl
        };
        return jsforceMetadataTools.deployFromDirectory(path.resolve(addonConfig.deployDir, 'src'), deployOpts)
          .then(function (res) {
            console.log('');
            jsforceMetadataTools.reportDeployResult(res, console, addonConfig.verbose);
            return res.success;
          })
          .catch(function (err) {
            console.error(err.message);
            return false;
          });
      }

    }
  });

  function runCommand(command, commandArgs, options) {
    return new ExecTask().run({
      command: command,
      commandArgs: commandArgs,
      verbose: options.verbose
    });
  }

  function zipDir(zipFile, srcDir, options) {
    return new ZipTask().run({
      zipFile: zipFile,
      srcDir: srcDir,
      verbose: options.verbose
    });
  }

  // defaults are bad because they override properties merged from the configs
  function buildAvailableOptions() {
    return [{
      name: 'environment',
      type: String,
      default: undefined,
      description: 'The Angular environment to create a build for'
    }, {
      name: 'verbose',
      type: Boolean,
      default: undefined,
      description: 'Print lots of details'
    }, {
      name: 'skip-build',
      type: Boolean,
      default: undefined,
      description: 'skip ng build'
    }, {
      name: 'name',
      type: String,
      default: undefined,
      description: 'name of the static resource'
    }, {
      name: 'description',
      type: String,
      default: undefined,
      description: 'description of the static resource'
    }, {
      name: 'poll-interval',
      type: Number,
      default: undefined,
      description: 'polling interval'
    }, {
      name: 'poll-timeout',
      type: Number,
      default: undefined,
      description: 'polling timeout'
    }, {
      name: 'login-url',
      type: String,
      default: undefined,
      description: 'salesforce server url (i.e. https://login.salesforce.com)'
    }, {
      name: 'username',
      type: String,
      default: undefined,
      description: 'salesforce username'
    }, {
      name: 'password',
      type: String,
      default: undefined,
      description: 'salesforce password'
    }, {
      name: 'no-prompt',
      type: Boolean,
      default: undefined,
      description: 'do not prompt for salesforce credentials'
    }, {
      name: 'config-file',
      type: String,
      default: "sfdcDeploy.json",
      description: 'location of a config file for this command'
    }, {
      name: 'deploy-dir',
      type: String,
      default: undefined,
      description: 'location of the deploy folder'
    }];
  }
})();