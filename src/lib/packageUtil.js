import path from 'path'
import chalk from 'chalk'
import * as xml2js from 'xml2js'
import * as fileUtils from './fileUtils.js'
import * as packageDefinition from '../meta/Package.js'

export class Package {
    #packageJSON = undefined

    constructor(xmlPath) {
        this.xmlPath = xmlPath
    }

    getPackageXML() {
        const that = this
        return new Promise((resolve, reject) => {
            if (that.xmlPath === undefined) throw new Error('Package not initialized')

            let fileName = path.join(global.__basedir, that.xmlPath)
            if (fileUtils.fileExists(fileName) && global.git.append) {
                let data = fileUtils.readFile(fileName)
                data
                    .then((json) => {
                        processJSON(that, json)
                        resolve('existing')
                    })
                    .catch((error) => {
                        reject(error)
                    })
            } else {
                let json = JSON.parse(JSON.stringify(packageDefinition.metadataDefinition.emptyPackage))
                processJSON(that, json)
                resolve('not found')
            }
        })

        function processJSON(that, json) {
            try {
                json.Package.version = fileUtils.readFile(path.join(global.__basedir, 'sfdx-project.json')).sourceApiVersion
            } catch (error) {
                json.Package.version = packageDefinition.metadataDefinition.fallbackVersion
            }
            that.#packageJSON = json
            if (json.Package.types !== undefined) transformJSON(json.Package.types)
        }
    }

    addMember(type, member) {
        const that = this
        if (that.#packageJSON === undefined) throw new Error('getPackageXML must be called before adding members')
        if (type === undefined) throw new Error('An undefined type was received when attempting to add a member')
        if (member === undefined) throw new Error('An undefined member was received when attempting to add a member')

        const packageJSON = that.#packageJSON
        let foundMember = false
        let foundAsterisk = false
        let typeJSON = undefined

        if (packageJSON.Package.types === undefined) packageJSON.Package.types = []

        packageJSON.Package.types.forEach((typeItem) => {
            try {
                if (typeItem.name.toLowerCase() == type.toLowerCase()) {
                    typeJSON = typeItem
                    if (typeItem.members === undefined) {
                        delete typeItem.name
                        typeItem.members = []
                        typeItem.name = type
                    }
                    typeItem.members.forEach(memberItem => {
                        if (memberItem.toLowerCase() == member.toLowerCase()) {
                            foundMember = true
                        } else if (memberItem == '*') {
                            foundAsterisk = true
                        }
                    })
                }
            } catch (error) {
                global.displayError(error, true)
            }
        })

        // exit if member already exists
        if (foundMember) return
        if (foundAsterisk) {
            global.logger.warn(`Found ${chalk.bgBlackBright('*')} in type: ${type}.`)
            return
        }

        if (typeJSON !== undefined) {
            typeJSON.members.push(member)
            typeJSON.members.sort()
        } else {
            typeJSON = JSON.parse(JSON.stringify(packageDefinition.metadataDefinition.emptyNode))
            typeJSON.name = type
            typeJSON.members.push(member)

            packageJSON.Package.types.push(typeJSON)
        }

        packageJSON.Package.types.sort((a, b) => {
            if (a.name < b.name) return -1
            if (a.name > b.name) return 1
            return 0
        })
    }

    savePackage() {
        let that = this
        let json = that.#packageJSON.Package
        json.$.xmlns = json.$.xmlns.replace('http:', 'https:')

        const builder = new xml2js.Builder(
            {
                cdata: false,
                rootName: 'Package',
                xmldec: { 'version': '1.0', 'encoding': 'UTF-8' }
            }
        )
        let fileName = that.xmlPath
        fileUtils.createDirectory(path.dirname(fileName))

        const xml = builder.buildObject(json)

        fileUtils.writeFile(fileName, xml)
    }
}

function transformJSON(json) {
    json.forEach(typesItem => {
        Object.keys(typesItem).forEach(key => {
            let jsonString = JSON.stringify(typesItem[key], (name, value) => {
                if (key == 'members') {
                    return value
                } else {
                    return xml2json(value)
                }
            })
            typesItem[key] = JSON.parse(jsonString)
        })
    })

    return
}

function xml2json(currentValue) {
    if (Array.isArray(currentValue)) {
        if (currentValue.length == 1) {
            currentValue = currentValue[0].toString().trim()
        }
    }
    if (currentValue == 'true') currentValue = true
    if (currentValue == 'false') currentValue = false
    return currentValue
}
