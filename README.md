# angular-cli-sfdc-deploy

Angular CLI addon for deploying apps to Salesforce.

## Installation & Setup

This addon has the following prerequisites:

- Node.js 6.9.x
- Angular project created via [angular-cli](https://github.com/angular/angular-cli)

To install this addon all you need to do is install angular-cli-sfdc-deploy via npm:

```sh
npm install --save-dev angular-cli-sfdc-deploy
```

## Usage

Once that's done, you run `ng sfdc:deploy` to build your app and deploy to Salesforce as a static resource.

## Authentication

If you do not provide any credentials you will be prompted for them.
If this annoys your CI build then you can use the `--no-prompt` flag to disable.

## Options

You can display all options with the command `ng --help sfdc:deploy`. It will output the text below:

```
ng sfdc:deploy <options...>
  Deploy your app to Salesforce as a static resource
  --environment (String) The Angular environment to create a build for
  --verbose (Boolean) Print lots of details
  --skip-build (Boolean) skip ng build
  --name (String) name of the static resource
  --description (String) description of the static resource
  --poll-interval (Number) polling interval
  --poll-timeout (Number) polling timeout
  --login-url (String) salesforce server url (i.e. https://login.salesforce.com)
  --username (String) salesforce username
  --password (String) salesforce password
  --no-prompt (Boolean) do not prompt for salesforce credentials
  --config-file (String) (Default: sfdcDeploy.json) location of a config file for this command
  --deploy-dir (String) location of the deploy folder
  ```

## Configuration

There are several ways to configure the sfdc:deploy command. I will list them below in order of precedence:

1. options flags passed directly to the command.
2. options configuration file - looks for sfdcDeploy.json by default.
3. addon configuraton section in angular-cli.json.

### Options configuration file

This is a json file that you can use to default any option that can be passed to the command.
This is most useful for when you want to override any configuration options specificed in angular-cli.json, but you don't want to check them into version control.
By convention these options use camelCase over kebab-case.
Example File:

```json
{
  "name": "myApp",
  "description": "My Angular 2 app",
  "environment": "prod",
  "verbose": true,
  "skipBuild": false,
  "pollInterval": 5000,
  "pollTimeout": 60000,
  "loginUrl": "https://login.salesforce.com",
  "username": "gbutt@rallydev.com",
  "password": "secret",
  "noPrompt": true
}
```

### angular-cli.json addon configuration

You can specify the same options above in your angular-cli.json config.
Example:
```
{
  "project": {...},
  "apps": [{...}],
  "addons": [{
    "sfdc": {
      "name": "contactsApp",
      "description": "My Angular 2 app"
    }
  }],
  ...
}
```
I'm not really sure if the angular-cli team expects this kind of configuration, so it could break in future versions of angular-cli.

## Tips

### Deploy Merging
Note that this plugin does not delete your existing `deploy` directory.
It will instead attempt to merge your code into it and update the package.xml.
If you don't like this behavior you can add the following script to your package.json: `"deploy": "rm -rf deploy && ng sfdc:deploy"`
The reason for doing a merge is so you can also include other assets in your deploy folder such as a visualforce page.
These assets will also get deployed with your static resource.

## License

[Licensed under the MIT license](http://www.opensource.org/licenses/mit-license.php)
