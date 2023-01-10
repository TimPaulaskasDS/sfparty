# @ds-sfdc/sfparty

[![NPM](https://img.shields.io/npm/v/@ds-sfdc/sfparty.svg?label=@ds-sfdc/sfparty)](https://www.npmjs.com/package/@ds-sfdc/sfparty) [![Downloads/week](https://img.shields.io/npm/dw/@ds-sfdc/sfparty.svg)](https://npmjs.org/package/@ds-sfdc/sfparty) [![License](https://img.shields.io/badge/License-BSD%203--Clause-brightgreen.svg)](https://github.com/TimPaulaskasDS/sfparty/blob/main/LICENSE.md)

## What is sfparty?

For those that are familiar with Salesforce metadata, you know that it uses large XML files. These XML files are difficult to diff, hard to read, and can cause conflicts and corrupted XML when merging. This tool will split Salesforce metadata XML files into YAML parts (or JSON), and combine them back into XML files. A great solution for your CI/CD needs.

## Install

```bash
npm i @ds-sfdc/sfparty
```
## Commands

### Split
```bash
sfparty split
```

### Combine
```bash
sfparty combine
```

### Options

```
  -n, --name     name of metadata file  
  -s, --source   package directory path specified in sfdx-project.json  
  -t, --target   target path to directory to create yaml/json files  
  -h, --help     Show help  
```
## Examples
### Custom Labels
```bash
sfparty split --type=label
```

### Permission Set
```bash
sfparty split --type=permset
sfparty split --type=permset --name="My Permission Set"
```
### Profile
```bash
sfparty split --type=profile
sfparty split --type=profile --name="My Profile"
```
### Workflow
```bash
sfparty split --type=workflow
sfparty split --type=workflow --name="Workflow"
```
### Source Directory
The source directory will use your default package folder as specified in the sfdx-project.json file, and therefore must be executed from your Salesforce project directory. It will create the main/default folders if they do not exist.

```
{
    "packageDirectories": [
        {
            "path": "force-app",
            "default": true
        },
        {
            "path": "my-package"
        }
    ],
    "namespace": "",
    "sfdcLoginUrl": "https://login.salesforce.com",
    "sourceApiVersion": "53.0"
}
```

```bash
sfparty split --source="my-package"
```

### Target Directory
The source directory will use your default package folder as specified in the sfdx-project.json file, and append `-party` to the end. For example, if the default source path is `force-app`, then the default target directory will be `force-app-party` unless otherwise specified. The target does not need to be specified in the sfdx-project.json, however the combine command will not work on folders that are not specified in the sfdx-project.json.

```bash
sfparty split --target="test"
```