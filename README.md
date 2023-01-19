# @ds-sfdc/sfparty

[![NPM](https://img.shields.io/npm/v/@ds-sfdc/sfparty.svg?label=@ds-sfdc/sfparty)](https://www.npmjs.com/package/@ds-sfdc/sfparty) [![Downloads/week](https://img.shields.io/npm/dw/@ds-sfdc/sfparty.svg)](https://npmjs.org/package/@ds-sfdc/sfparty) [![License](https://img.shields.io/badge/License-BSD%203--Clause-brightgreen.svg)](https://github.com/TimPaulaskasDS/sfparty/blob/main/LICENSE.md)

## Why use sfparty?

Salesforce metadata is typically stored in large XML files, which can take some effort to work with. These XML files are hard to read, challenging to diff, and can lead to conflicts and corrupted XML when merging. sfparty is a utility that improves the developer and DevOps experience by splitting Salesforce metadata XML files into smaller YAML or JSON parts. This makes it much easier to understand and manage the metadata and eliminates the risk of conflicts and corrupted XML. Additionally, sfparty's ability to combine these parts back into XML files makes it an ideal solution for CI/CD needs. It allows for easy version control and streamlined deployment processes.

## Install

```bash
npm i -g @ds-sfdc/sfparty
```

### NPM Installation Issues
`command not found: sfparty`  
sfparty is an executable that is meant to be installed globally.

`EACCESS: permission denied`
There are several options on how to resolve the NPM EACCESS issue.The simplest way if you can is to use `sudo`
```bash
sudo npm i -g @ds-sfdc/sfparty
```
Depending on your system, you may have some issues installing sfparty using NPM. These are typically file system permission issues. Here are some links to various articles with suggestions on how to resolve the issue.

[Fixing npm permission issue](https://kaustubhtalathi.medium.com/fixing-npm-permission-issue-f3d88a7a4ab4)  
[Always use sudo to install global packages](https://stackoverflow.com/questions/16151018/how-to-fix-npm-throwing-error-without-sudo#:~:text=always%20use%20sudo%20%2Di%20or,they%20are%20owned%20by%20root)  
[Use npm config instead of using chown or chmod](https://stackoverflow.com/questions/16151018/how-to-fix-npm-throwing-error-without-sudo/41395398#41395398)
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
-y, --type     type(s) of metadata to process
-n, --name     name of metadata file  
-f, --format   format to use yaml (default) or json
-s, --source   package directory path specified in sfdx-project.json  
-t, --target   target path to directory to create yaml/json files  
-g, --git      combine files based on git commits
-h, --help     Show help  
```

### Combine Options
The following options are available when using the combine command:

#### git

```
-g, --git      process files based on git commits. This option does not require a value.
```


##### Git Options
The following options are available when using the combine command:

```
-a, --append      append package and destructive package instead of overwriting.
-l, --delta       when possible create delta metadata files for CI/CD deployment.
-p, --package     path to your change package XML file.
-x, --destructive path to your destructive change package XML file.
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
### Multiple Types
```bash
sfparty split --type="workflow,label"
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
    "sourceApiVersion": "56.0"
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

## Husky Git Hooks
If you are using a git hook utility such as `husky`, you can add a post-merge hook to automate running the `combine` command whenever you execute a `merge` or `git pull` command.
### post-merge

```
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

sfparty combine --git
```
## CI/CD
sfparty is meant to be a supplemental addition to your CI/CD process. Your pipeline should already build out a `package.xml` and `destructiveChanges.xml`. When sfparty runs it will do a `git diff` and append changes to the files. You can use a utility like [sfdx-git-delta](https://www.npmjs.com/package/sfdx-git-delta) to build out the package.
```
Command:
sfparty combine --git

Required:  
-g, --git         process files based on git commits. This option does not require a value.

Optional:  
-a, --append      append package and destructive package instead of overwriting.
-l, --delta       when possible create delta metadata files for CI/CD deployment.
-p, --package     path to your change package XML file.
-x, --destructive path to your destructive change package XML file.
```

### Example

#### Previous Commit to Current

```
sfparty combine --git=HEAD~1..HEAD --append --delta --package=deploy/package.xml --destructive=deploy/destructiveChanges/destructiveChanges.xml
```

The default target is the default package file that is specified in the `sfdx-project.json` file. If you want the files to be created in a different location, you can use the `--target` parameter. sfparty will create the /main/default/* directories accordingly.

```
sfparty combine --git=HEAD~1..HEAD --append --delta --package=deploy/package.xml --destructive=deploy/destructiveChanges/destructiveChanges.xml --target=deployDir/force-app
```
