'use strict'

import path from 'path'
import fs from 'fs'
import os from 'os'
import { readFile } from 'fs'
import { Parser } from 'xml2js'
import logUpdate from 'log-update';
import chalk from 'chalk'
import convertHrtime from 'convert-hrtime'
import cliSpinners from 'cli-spinners'
import * as yaml from 'js-yaml'
import * as fileUtils from '../fileUtils.js'
import { profileDefinition } from '../../meta/Profiles.js'

const spinner = cliSpinners['dots']
let spinnerFrame = spinner.frames[0]
let index = 0

// TODO replace global logger with error message
export class Profile {
    #fileName = ''
    #spinnerMessage = ''
    #profileInfo = {
        name: undefined,
        fullName: undefined,
        userLicense: undefined,
        custom: undefined,
        description: undefined,
    }

    constructor(config) {
        this.sourceDir = config.sourceDir
        this.targetDir = config.targetDir
        this.metaFilePath = config.metaFilePath
    }

    get metaFilePath() {
        return this._metaFilePath
    }

    set metaFilePath(value) {
        value = value.trim()
        if (value === '') {
            throw 'The file path cannot be empty'
        }
        this._metaFilePath = value
        this.#fileName = fileUtils.fileInfo(value).filename
        this.#spinnerMessage = `[%1] of ${global.processed.total} - Profile: ${chalk.yellowBright(this.#fileName)}[%2]`
    }

    split() {
        return new Promise((resolve, reject) => {
            if (!this.#fileName || !this.sourceDir || !this.targetDir || !this.metaFilePath) {
                global.logger.error('Invalid information passed to split')
                process.exit(1)
            }
            if (!fileUtils.fileExists(this.metaFilePath)) {
                global.logger.error(`file not found: ${this.metaFilePath}`)
                process.exit(1)
            }

            this.profileInfo = fileUtils.fileInfo(this.metaFilePath)
            this.#profileInfo.name = this.profileInfo.filename.replace('.profile-meta.xml', '')
            this.targetDir = path.join(this.targetDir, this.#profileInfo.name)
            let spinnerMessage = this.#spinnerMessage.toString()
            logUpdate(spinnerMessage.toString().replace('[%2]', '').replace('[%1]', global.processed.current.toString().padStart(global.processed.total.toString().length, ' ')))
            let parser = new Parser();
            const getJSON = new Promise((resolve, reject) => {
                readFile(this.metaFilePath, function (err, data) {
                    parser.parseString(data, function (err, result) {
                        if (result) {
                            resolve(result)
                        } else {
                            global.logger.error(`error converting xml to json: ${filePath}`)
                            process.exit(1)
                        }
                    })
                })
            })
            getJSON.then((result) => {
                resolve(processProfile(result, this.#profileInfo, this.targetDir, this.#spinnerMessage, process.hrtime.bigint()))
            })
        })

        function processProfile(profileJSON, profileInfo, targetDir, spinnerMessage, startTime) {
            fileUtils.deleteDirectory(targetDir, true) // recursive delete existing directory
            fileUtils.createDirectory(targetDir) // create directory
            let keys = Object.keys(profileJSON.Profile)

            keys.forEach(key => {
                logUpdate(spinnerMessage.replace('[%2]', `\n${chalk.magentaBright(nextFrame())} ${key}`).replace('[%1]', global.processed.current.toString().padStart(global.processed.total.toString().length, ' ')))
                processKeys: if (profileDefinition.main.includes(key)) {
                    profileInfo[key] = profileJSON.Profile[key][0]
                } else if (profileDefinition.directories.includes(key)) {
                    fileUtils.createDirectory(path.join(targetDir, key)) // create directory
                    switch (key) {
                        case 'fieldLevelSecurities':
                            fieldLevelSecurities(profileJSON.Profile.fieldLevelSecurities, targetDir)
                            break
                        case 'fieldPermissions':
                            fieldPermissions(profileJSON.Profile.fieldPermissions, targetDir)
                            break
                        case 'loginFlows':
                            loginFlows(profileJSON.Profile.loginFlows, targetDir)
                            break
                        case 'objectPermissions':
                            objectPermissions(profileJSON.Profile.objectPermissions, targetDir)
                            break
                        case 'recordTypeVisibilities':
                            recordTypeVisibilities(profileJSON.Profile.recordTypeVisibilities, targetDir)
                            break
                        default:
                            global.logger.warning('Not processed:', key)
                    }
                } else if (profileDefinition.singleFiles.includes(key)) {
                    switch (key) {
                        case 'applicationVisibilities':
                            applicationVisibilities(profileJSON.Profile.applicationVisibilities, targetDir)
                            break
                        case 'categoryGroupVisibilities':
                            categoryGroupVisibilities(profileJSON.Profile.categoryGroupVisibilities, targetDir)
                            break
                        case 'classAccesses':
                            classAccesses(profileJSON.Profile.classAccesses, targetDir)
                            break
                        case 'customMetadataTypeAccesses':
                            customMetadataTypeAccesses(profileJSON.Profile.customMetadataTypeAccesses, targetDir)
                            break
                        case 'customPermissions':
                            customPermissions(profileJSON.Profile.customPermissions, targetDir)
                            break
                        case 'customSettingAccesses':
                            customSettingAccesses(profileJSON.Profile.customSettingAccesses, targetDir)
                            break
                        case 'externalDataSourceAccesses':
                            externalDataSourceAccesses(profileJSON.Profile.externalDataSourceAccesses, targetDir)
                            break
                        case 'flowAccesses':
                            flowAccesses(profileJSON.Profile.flowAccesses, targetDir)
                            break
                        case 'layoutAssignments':
                            layoutAssignments(profileJSON.Profile.layoutAssignments, targetDir)
                            break
                        case 'loginIpRanges':
                            loginIpRanges(profileJSON.Profile.loginIpRanges, targetDir)
                            break
                        case 'pageAccesses':
                            pageAccesses(profileJSON.Profile.pageAccesses, targetDir)
                            break
                        case 'tabVisibilities':
                            tabVisibilities(profileJSON.Profile.tabVisibilities, targetDir)
                            break
                        case 'userPermissions':
                            userPermissions(profileJSON.Profile.userPermissions, targetDir)
                            break
                        default:
                            global.logger.warning('Not processed:', key)
                    }
                } else if (profileDefinition.ignore.includes(key)) {
                    break processKeys;
                } else {
                    global.logger.warning('Not processed:', key)
                }
            })

            // Main cannot be called until after all the keys are processed and profileJSON.Profile[key][0] is populated
            Main(profileInfo, targetDir, spinnerMessage, startTime)

            function Main(profileInfo, targetDir, spinnerMessage, startTime) {
                let fileName = path.join(targetDir, `main.${global.format}`)
                saveFile(profileInfo, fileName)

                const diff = process.hrtime.bigint() - BigInt(startTime)
                let executionTime = convertHrtime(diff);
                executionTime.seconds = Math.round(executionTime.seconds)
                executionTime.milliseconds = Math.round(executionTime.milliseconds / 1000)
                if (executionTime.milliseconds == 0 && executionTime.nanoseconds > 0) executionTime.milliseconds = 1
                let durationMessage = `${executionTime.seconds}.${executionTime.milliseconds}s`
                logUpdate(spinnerMessage.replace('[%2]', `. ${chalk.greenBright('✔')} Processed in ${durationMessage}.`).replace('[%1]', global.processed.current.toString().padStart(global.processed.total.toString().length, ' ')))
                logUpdate.done()
            }

            function applicationVisibilities(jsonResult, targetDir) {
                let json = {
                    applicationVisibilities: undefined
                }

                // sort json to order by field
                jsonResult.sort((a, b) => {
                    if (a.application < b.application) {
                        return -1;
                    }
                    if (a.application > b.application) {
                        return 1;
                    }
                    return 0;
                })
                json.applicationVisibilities = jsonResult
                let fileName = path.join(targetDir, 'applicationVisibilities' + `.${global.format}`)
                saveFile(json, fileName)
            }

            function categoryGroupVisibilities(jsonResult) {
                let json = {
                    categoryGroupVisibilities: undefined
                }

                // sort json to order by field
                jsonResult.sort((a, b) => {
                    if (a.dataCategoryGroup < b.dataCategoryGroup) {
                        return -1;
                    }
                    if (a.dataCategoryGroup > b.dataCategoryGroup) {
                        return 1;
                    }
                    return 0;
                })

                // sort json keys to put field first
                jsonResult.forEach(function (part, index) {
                    this[index].dataCategoryGroup = this[index].dataCategoryGroup[0]
                    this[index].visibility = this[index].visibility[0]
                    this[index] = Object.keys(this[index])
                        .sort((a, b) => {
                            if (a == 'dataCategoryGroup') return -1
                            if (b == 'dataCategoryGroup') return 1
                            if (a == 'visibility') return -1
                            if (b == 'visibility') return 1
                            if (a == 'dataCategories') return -1
                            if (b == 'dataCategories') return 1

                            return 0;
                        })
                        .reduce((accumulator, key) => {
                            accumulator[key] = this[index][key];

                            return accumulator;
                        }, {});
                }, jsonResult);

                json.categoryGroupVisibilities = jsonResult
                let fileName = path.join(targetDir, 'categoryGroupVisibilities' + `.${global.format}`)
                saveFile(json, fileName)
            }

            function classAccesses(jsonResult, targetDir) {
                let json = {
                    classAccesses: undefined
                }

                // sort json to order by field
                jsonResult.sort((a, b) => {
                    if (a.apexClass < b.apexClass) {
                        return -1;
                    }
                    if (a.apexClass > b.apexClass) {
                        return 1;
                    }
                    return 0;
                })
                json.classAccesses = jsonResult
                let fileName = path.join(targetDir, 'classAccesses' + `.${global.format}`)
                saveFile(json, fileName)
            }

            function customMetadataTypeAccesses(jsonResult, targetDir) {
                let json = {
                    customMetadataTypeAccesses: undefined
                }

                // sort json keys to put field first
                jsonResult.forEach(function (part, index) {
                    this[index] = Object.keys(this[index])
                        .sort((a, b) => {
                            if (a == 'name') return -1
                            if (b == 'name') return 1
                            if (a == 'enabled') return -1
                            if (b == 'enabled') return 1

                            return 0;
                        })
                        .reduce((accumulator, key) => {
                            accumulator[key] = this[index][key];

                            return accumulator;
                        }, {});
                }, jsonResult);

                // sort json to order by name
                jsonResult.sort((a, b) => {
                    if (a.name < b.name) {
                        return -1;
                    }
                    if (a.name > b.name) {
                        return 1;
                    }
                    return 0;
                })
                json.customMetadataTypeAccesses = jsonResult
                let fileName = path.join(targetDir, 'customMetadataTypeAccesses' + `.${global.format}`)
                saveFile(json, fileName)
            }

            function customPermissions(jsonResult, targetDir) {
                let json = {
                    customPermissions: undefined
                }

                // sort json keys to put field first
                jsonResult.forEach(function (part, index) {
                    this[index] = Object.keys(this[index])
                        .sort((a, b) => {
                            if (a == 'name') return -1
                            if (b == 'name') return 1
                            if (a == 'enabled') return -1
                            if (b == 'enabled') return 1

                            return 0;
                        })
                        .reduce((accumulator, key) => {
                            accumulator[key] = this[index][key];

                            return accumulator;
                        }, {});
                }, jsonResult);

                // sort json to order by name
                jsonResult.sort((a, b) => {
                    if (a.name < b.name) {
                        return -1;
                    }
                    if (a.name > b.name) {
                        return 1;
                    }
                    return 0;
                })
                json.customPermissions = jsonResult
                let fileName = path.join(targetDir, 'customPermissions' + `.${global.format}`)
                saveFile(json, fileName)
            }

            function customSettingAccesses(jsonResult, targetDir) {
                let json = {
                    customSettingAccesses: undefined
                }

                // sort json keys to put field first
                jsonResult.forEach(function (part, index) {
                    this[index] = Object.keys(this[index])
                        .sort((a, b) => {
                            if (a == 'name') return -1
                            if (b == 'name') return 1
                            if (a == 'enabled') return -1
                            if (b == 'enabled') return 1

                            return 0;
                        })
                        .reduce((accumulator, key) => {
                            accumulator[key] = this[index][key];

                            return accumulator;
                        }, {});
                }, jsonResult);

                // sort json to order by name
                jsonResult.sort((a, b) => {
                    if (a.name < b.name) {
                        return -1;
                    }
                    if (a.name > b.name) {
                        return 1;
                    }
                    return 0;
                })
                json.customSettingAccesses = jsonResult
                let fileName = path.join(targetDir, 'customSettingAccesses' + `.${global.format}`)
                saveFile(json, fileName)
            }

            function externalDataSourceAccesses(jsonResult, targetDir) {
                let json = {
                    externalDataSourceAccesses: undefined
                }

                // sort json keys to put field first
                jsonResult.forEach(function (part, index) {
                    this[index] = Object.keys(this[index])
                        .sort((a, b) => {
                            if (a == 'externalDataSource') return -1
                            if (b == 'externalDataSource') return 1
                            if (a == 'enabled') return -1
                            if (b == 'enabled') return 1

                            return 0;
                        })
                        .reduce((accumulator, key) => {
                            accumulator[key] = this[index][key];

                            return accumulator;
                        }, {});
                }, jsonResult);

                // sort json to order by externalDataSource
                jsonResult.sort((a, b) => {
                    if (a.externalDataSource < b.externalDataSource) {
                        return -1;
                    }
                    if (a.externalDataSource > b.externalDataSource) {
                        return 1;
                    }
                    return 0;
                })
                json.externalDataSourceAccesses = jsonResult
                let fileName = path.join(targetDir, 'externalDataSourceAccesses' + `.${global.format}`)
                saveFile(json, fileName)
            }

            function fieldLevelSecurities(jsonResult, targetDir) {
                const objects = {}

                // populate objects with fieldLevelSecurities data per object
                jsonResult.forEach(element => {
                    let [object] = element.field[0].toString().replaceAll('\n', '').trim().split('.')
                    if (objects[object] === undefined) {
                        objects[object] = []
                    }
                    objects[object].push(element)
                })

                // iterate objects keys (per object)
                let keys = Object.keys(objects)
                keys.forEach(key => {
                    let tag = 'fieldLevelSecurities'
                    let fileName = path.join(targetDir, tag, key + `.${global.format}`)

                    // sort json keys to put field first
                    let jsonResult = objects[key]
                    jsonResult.forEach(function (part, index) {
                        this[index] = Object.keys(this[index])
                            .sort((a, b) => {
                                if (a == 'field') return -1
                                if (b == 'field') return 1
                                if (a == 'editable') return -1
                                if (b == 'editable') return 1
                                if (a == 'readable') return -1
                                if (b == 'readable') return 1
                                if (a == 'hidden') return -1
                                if (b == 'hidden') return 1

                                return 0;
                            })
                            .reduce((accumulator, key) => {
                                accumulator[key] = this[index][key];

                                return accumulator;
                            }, {});
                    }, jsonResult);

                    // sort json to order by field
                    jsonResult.sort((a, b) => {
                        if (a.field < b.field) {
                            return -1;
                        }
                        if (a.field > b.field) {
                            return 1;
                        }
                        return 0;
                    })

                    let json = {
                        object: undefined,
                        fieldLevelSecurities: undefined
                    }

                    json.object = key
                    json.fieldLevelSecurities = jsonResult
                    saveFile(json, fileName)
                })
            }

            function fieldPermissions(jsonResult, targetDir) {
                const objects = {}

                // populate objects with fieldPermission data per object
                jsonResult.forEach(element => {
                    let [object] = element.field[0].toString().replaceAll('\n', '').trim().split('.')
                    if (objects[object] === undefined) {
                        objects[object] = []
                    }
                    objects[object].push(element)
                })

                // iterate objects keys (per object)
                let keys = Object.keys(objects)
                keys.forEach(key => {
                    let tag = 'fieldPermissions'
                    let fileName = path.join(targetDir, tag, key + `.${global.format}`)

                    // sort json keys to put field first
                    let jsonResult = objects[key]
                    jsonResult.forEach(function (part, index) {
                        this[index] = Object.keys(this[index])
                            .sort((a, b) => {
                                if (a == 'field') return -1
                                if (b == 'field') return 1
                                if (a == 'editable') return -1
                                if (b == 'editable') return 1
                                if (a == 'readable') return -1
                                if (b == 'readable') return 1
                                if (a == 'hidden') return -1
                                if (b == 'hidden') return 1

                                return 0;
                            })
                            .reduce((accumulator, key) => {
                                accumulator[key] = this[index][key];

                                return accumulator;
                            }, {});
                    }, jsonResult);

                    // sort json to order by field
                    jsonResult.sort((a, b) => {
                        if (a.field < b.field) {
                            return -1;
                        }
                        if (a.field > b.field) {
                            return 1;
                        }
                        return 0;
                    })

                    let json = {
                        object: undefined,
                        fieldPermissions: undefined
                    }

                    json.object = key
                    json.fieldPermissions = jsonResult
                    saveFile(json, fileName)
                })
            }

            function flowAccesses(jsonResult, targetDir) {
                let json = {
                    flowAccesses: undefined
                }

                // sort json keys to put field first
                jsonResult.forEach(function (part, index) {
                    this[index] = Object.keys(this[index])
                        .sort((a, b) => {
                            if (a == 'flow') return -1
                            if (b == 'flow') return 1
                            if (a == 'enabled') return -1
                            if (b == 'enabled') return 1

                            return 0;
                        })
                        .reduce((accumulator, key) => {
                            accumulator[key] = this[index][key];

                            return accumulator;
                        }, {});
                }, jsonResult);

                // sort json to order by flow
                jsonResult.sort((a, b) => {
                    if (a.flow < b.flow) {
                        return -1;
                    }
                    if (a.flow > b.flow) {
                        return 1;
                    }
                    return 0;
                })
                json.flowAccesses = jsonResult
                let fileName = path.join(targetDir, 'flowAccesses' + `.${global.format}`)
                saveFile(json, fileName)
            }

            function layoutAssignments(jsonResult, targetDir) {
                let json = {
                    layoutAssignments: undefined
                }

                // sort json keys to put field first
                jsonResult.forEach(function (part, index) {
                    this[index] = Object.keys(this[index])
                        .sort((a, b) => {
                            if (a == 'layout') return -1
                            if (b == 'layout') return 1
                            if (a == 'recordType') return -1
                            if (b == 'recordType') return 1

                            return 0;
                        })
                        .reduce((accumulator, key) => {
                            accumulator[key] = this[index][key];

                            return accumulator;
                        }, {});
                }, jsonResult);

                // sort json to order by layout
                jsonResult.sort((a, b) => {
                    if (a.layout < b.layout) {
                        return -1;
                    }
                    if (a.layout > b.layout) {
                        return 1;
                    }
                    if (a.recordType < b.recordType || a.recordType === undefined) {
                        return -1;
                    }
                    if (a.recordType > b.recordType || b.recordType === undefined) {
                        return 1;
                    }
                    return 0;
                })
                json.layoutAssignments = jsonResult
                let fileName = path.join(targetDir, 'layoutAssignments' + `.${global.format}`)
                saveFile(json, fileName)
            }

            function loginFlows(jsonResult, targetDir) {
                const flows = {}

                // populate objects with fieldPermission data per object
                jsonResult.forEach(element => {
                    let [flow] = element.friendlyName
                    flows[flow] = []
                    flows[flow].push(element)
                })

                // iterate flows keys (per object)
                let keys = Object.keys(flows)
                keys.forEach(key => {
                    let tag = 'loginFlows'
                    let fileName = path.join(targetDir, tag, key + `.${global.format}`)

                    // sort json keys to put field first
                    let jsonResult = flows[key]
                    jsonResult.forEach(function (part, index) {
                        this[index] = Object.keys(this[index])
                            .sort((a, b) => {
                                if (a == 'friendlyName') return -1
                                if (b == 'friendlyName') return 1
                                if (a == 'flow') return -1
                                if (b == 'flow') return 1
                                if (a == 'flowType') return -1
                                if (b == 'flowType') return 1
                                if (a == 'uiLoginFlowType') return -1
                                if (b == 'uiLoginFlowType') return 1
                                if (a == 'useLightningRuntime') return -1
                                if (b == 'useLightningRuntime') return 1
                                if (a == 'vfFlowPage') return -1
                                if (b == 'vfFlowPage') return 1
                                if (a == 'vfFlowPageTitle') return -1
                                if (b == 'vfFlowPageTitle') return 1

                                return 0;
                            })
                            .reduce((accumulator, key) => {
                                accumulator[key] = this[index][key];

                                return accumulator;
                            }, {});
                    }, jsonResult);

                    let json = {
                        flow: undefined,
                    }

                    json.loginFlows = jsonResult
                    saveFile(json, fileName)
                })
            }

            // TODO loginHours

            function loginIpRanges(jsonResult, targetDir) {
                let json = {
                    loginIpRanges: undefined
                }

                // sort json keys to put field first
                jsonResult.forEach(function (part, index) {
                    this[index] = Object.keys(this[index])
                        .sort((a, b) => {
                            if (a == 'startAddress') return -1
                            if (b == 'startAddress') return 1
                            if (a == 'endAddress') return -1
                            if (b == 'endAddress') return 1
                            if (a == 'description') return -1
                            if (b == 'description') return 1

                            return 0;
                        })
                        .reduce((accumulator, key) => {
                            accumulator[key] = this[index][key];

                            return accumulator;
                        }, {});
                }, jsonResult);

                // sort json to order by startAddress
                jsonResult.sort((a, b) => {
                    if (a.startAddress < b.startAddress) {
                        return -1;
                    }
                    if (a.startAddress > b.startAddress) {
                        return 1;
                    }
                    return 0;
                })
                json.loginIpRanges = jsonResult
                let fileName = path.join(targetDir, 'loginIpRanges' + `.${global.format}`)
                saveFile(json, fileName)
            }

            function objectPermissions(jsonResult, targetDir) {
                const objects = {}

                // populate objects with fieldPermission data per object
                jsonResult.forEach(element => {
                    let [object] = element.object
                    if (objects[object] === undefined) {
                        objects[object] = []
                    }
                    objects[object].push(element)
                })

                // iterate objects keys (per object)
                let keys = Object.keys(objects)
                keys.forEach(key => {
                    let tag = 'objectPermissions'
                    let fileName = path.join(targetDir, tag, key + `.${global.format}`)

                    // sort json keys
                    let jsonResult = objects[key]
                    delete jsonResult[0].object

                    jsonResult.forEach(function (part, index) {
                        this[index] = Object.keys(this[index])
                            .sort((a, b) => {
                                if (a == 'allowCreate') return -1
                                if (b == 'allowCreate') return 1
                                if (a == 'allowRead') return -1
                                if (b == 'allowRead') return 1
                                if (a == 'allowEdit') return -1
                                if (b == 'allowEdit') return 1
                                if (a == 'allowDelete') return -1
                                if (b == 'allowDelete') return 1
                                if (a == 'viewAllRecords') return -1
                                if (b == 'viewAllRecords') return 1
                                if (a == 'modifyAllRecords') return -1
                                if (b == 'modifyAllRecords') return 1

                                return 0;
                            })
                            .reduce((accumulator, key) => {
                                accumulator[key] = this[index][key];

                                return accumulator;
                            }, {});
                    }, jsonResult);
                    let innerKeys = Object.keys(jsonResult[0])
                    innerKeys.forEach(innerKey => {
                        jsonResult[0][innerKey] = jsonResult[0][innerKey][0]
                    })

                    objects[key] = jsonResult
                    let json = {
                        object: undefined,
                        fieldPermissions: undefined
                    }

                    json.object = key
                    json.objectPermissions = jsonResult[0]
                    saveFile(json, fileName)
                })
            }

            function pageAccesses(jsonResult, targetDir) {
                let json = {
                    pageAccesses: undefined
                }

                // sort json keys to put field first
                jsonResult.forEach(function (part, index) {
                    this[index] = Object.keys(this[index])
                        .sort((a, b) => {
                            if (a == 'apexPage') return -1
                            if (b == 'apexPage') return 1
                            if (a == 'enabled') return -1
                            if (b == 'enabled') return 1

                            return 0;
                        })
                        .reduce((accumulator, key) => {
                            accumulator[key] = this[index][key];

                            return accumulator;
                        }, {});
                }, jsonResult);

                // sort json to order by apexPage
                jsonResult.sort((a, b) => {
                    if (a.apexPage < b.apexPage) {
                        return -1;
                    }
                    if (a.apexPage > b.apexPage) {
                        return 1;
                    }
                    return 0;
                })
                json.pageAccesses = jsonResult
                let fileName = path.join(targetDir, 'pageAccesses' + `.${global.format}`)
                saveFile(json, fileName)
            }

            // TODO profileActionOverrides

            function recordTypeVisibilities(jsonResult, targetDir) {
                const objects = {}

                // populate objects with fieldPermission data per object
                jsonResult.forEach(element => {
                    let [object] = element.recordType[0].toString().replaceAll('\n', '').trim().split('.')
                    if (objects[object] === undefined) {
                        objects[object] = []
                    }
                    objects[object].push(element)
                })

                // iterate objects keys (per object)
                let keys = Object.keys(objects)
                keys.forEach(key => {
                    let tag = 'recordTypeVisibilities'
                    let fileName = path.join(targetDir, tag, key + `.${global.format}`)

                    // sort json keys to put field first
                    let jsonResult = objects[key]
                    jsonResult.forEach(function (part, index) {
                        this[index] = Object.keys(this[index])
                            .sort((a, b) => {
                                if (a == 'recordType') return -1
                                if (b == 'recordType') return 1
                                if (a == 'default') return -1
                                if (b == 'default') return 1
                                if (a == 'visible') return -1
                                if (b == 'visible') return 1
                                if (a == 'personAccountDefault') return -1
                                if (b == 'personAccountDefault') return 1

                                return 0;
                            })
                            .reduce((accumulator, key) => {
                                accumulator[key] = this[index][key];

                                return accumulator;
                            }, {});
                    }, jsonResult);

                    // sort json to order by field
                    jsonResult.sort((a, b) => {
                        if (a.recordType < b.recordType) {
                            return -1;
                        }
                        if (a.recordType > b.recordType) {
                            return 1;
                        }
                        return 0;
                    })

                    let json = {
                        object: undefined,
                        recordTypeVisibilities: undefined
                    }

                    json.object = key
                    json.recordTypeVisibilities = jsonResult
                    saveFile(json, fileName)
                })
            }

            function tabVisibilities(jsonResult, targetDir) {
                let json = {
                    tabVisibilities: undefined
                }

                // sort json keys to put field first
                jsonResult.forEach(function (part, index) {
                    this[index] = Object.keys(this[index])
                        .sort((a, b) => {
                            if (a == 'name') return -1
                            if (b == 'name') return 1
                            if (a == 'enabled') return -1
                            if (b == 'enabled') return 1

                            return 0;
                        })
                        .reduce((accumulator, key) => {
                            accumulator[key] = this[index][key];

                            return accumulator;
                        }, {});
                }, jsonResult);

                // sort json to order by name
                jsonResult.sort((a, b) => {
                    if (a.name < b.name) {
                        return -1;
                    }
                    if (a.name > b.name) {
                        return 1;
                    }
                    return 0;
                })
                json.tabVisibilities = jsonResult
                let fileName = path.join(targetDir, 'tabVisibilities' + `.${global.format}`)
                saveFile(json, fileName)
            }

            function userPermissions(jsonResult, targetDir) {
                let json = {
                    userPermissions: undefined
                }

                // sort json keys to put field first
                jsonResult.forEach(function (part, index) {
                    this[index] = Object.keys(this[index])
                        .sort((a, b) => {
                            if (a == 'name') return -1
                            if (b == 'name') return 1
                            if (a == 'enabled') return -1
                            if (b == 'enabled') return 1

                            return 0;
                        })
                        .reduce((accumulator, key) => {
                            accumulator[key] = this[index][key];

                            return accumulator;
                        }, {});
                }, jsonResult);

                // sort json to order by name
                jsonResult.sort((a, b) => {
                    if (a.name < b.name) {
                        return -1;
                    }
                    if (a.name > b.name) {
                        return 1;
                    }
                    return 0;
                })
                json.userPermissions = jsonResult
                let fileName = path.join(targetDir, 'userPermissions' + `.${global.format}`)
                saveFile(json, fileName)
            }
        }
    }
}

function nextFrame() {
    spinnerFrame = spinner.frames[index = ++index % spinner.frames.length]
    return spinnerFrame
}

function saveFile(json, fileName) {
    switch (global.format) {
        case 'json':
            let jsonString = JSON.stringify(json, null, '\t')
            fs.writeFileSync(fileName, jsonString)
            break
        case 'yaml':
            let doc = yaml.dump(json)
            fs.writeFileSync(fileName, doc)
    }
}