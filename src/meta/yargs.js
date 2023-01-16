const options = {
    type: {
        demand: false,
        alias: 'y',
        description: 'type of metadata to $1',
        demandOption: false,
        type: 'string',
    },
    format: {
        demand: true,
        alias: 'f',
        default: 'yaml',
        description: 'type of output',
        demandOption: true,
        type: 'string',
    },
    name: {
        alias: 'n',
        description: 'name of metadata file to $1',
        demandOption: false,
        type: 'string',
    },
    source: {
        demand: false,
        alias: 's',
        description: 'package directory path specified in sfdx-project.json',
        type: 'string',
    },
    target: {
        demand: false,
        alias: 't',
        description: 'target path to directory to create yaml/json files',
        type: 'string',
    }
}

function getOptions(type) {
    let optionObj = {... options}
    Object.keys(optionObj).forEach(key => {
        Object.keys(optionObj[key]).forEach(subKey => {
            if (typeof optionObj[key][subKey] == 'string') {
                optionObj[key][subKey] = optionObj[key][subKey].replaceAll('$1', type)
            }
        })
    })

    if (type == 'combine') {
        optionObj.git = {
            alias: 'g',
            demand: false,
            description: 'process files based on git commits',
            type: 'string',
        }

        optionObj.append = {
            alias: 'a',
            demand: false,
            description: 'append package and destructive package instead of overwriting',
            type: 'boolean',
            implies: 'git'
        }

        optionObj.delta = {
            alias: 'l',
            demand: false,
            description: 'when possible create delta metadata files for CI/CD deployment',
            type: 'boolean',
            implies: 'git'
        }

        optionObj.package = {
            alias: 'pkg',
            demand: false,
            description: 'path to your change package XML file',
            type: 'string',
            implies: 'git'
        }

        optionObj.destructive = {
            alias: 'x',
            demand: false,
            description: 'path to your destructive change package XML file',
            type: 'string',
            implies: 'git'
        }
    }

    return optionObj
}

export const splitOptions = getOptions('split')
export const combineOptions = getOptions('combine')

const examples = [
    ['$0 $1'],
    ['$0 $1 --type=profile'],
    ['$0 $1 --type="profile,label"'],
    ['$0 $1 --type=permset --name="Permission Set Name"'],
    ['--source=packageDir --target=dir/dir'],
    ['name portion of file: [name].profile-meta.xml'],
    ['Example: --name="Admin" for Admin.profile-meta.xml'],
    ['\nCommands not supporting name or all parameters:'],
    ['$0 $1 --type=label'],
]

function getExamples(type) {
    let exArr = [...examples]
    exArr.forEach(arrItem => {
        arrItem[0] = arrItem[0].replaceAll('$1', type)
    })

    return exArr
}

export const splitExamples = getExamples('split')
export const combineExamples = getExamples('combine')