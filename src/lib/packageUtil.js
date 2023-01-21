import path from 'path'
import * as packageDefinition from '../meta/Package.js'

export class Package {
	constructor(xmlPath) {
		this.xmlPath = xmlPath
		this.packageJSON = undefined
	}

	getPackageXML(fileUtils) {
		const that = this
		return new Promise((resolve, reject) => {
			try {
				if (that.xmlPath === undefined)
					throw new Error('Package not initialized')

				let fileName = path.resolve(that.xmlPath)
				if (fileUtils.fileExists(fileName) && global.git.append) {
					let data = fileUtils.readFile(fileName)
					data.then((json) => {
						try {
							if (
								json === undefined ||
								Object.keys(json).length === 0
							)
								json =
									packageDefinition.metadataDefinition
										.emptyPackage
							processJSON(that, json, fileUtils)
							resolve('existing')
						} catch (error) {
							reject(error)
						}
					}).catch((error) => {
						reject(error)
					})
				} else {
					try {
						let json = JSON.parse(
							JSON.stringify(
								packageDefinition.metadataDefinition
									.emptyPackage,
							),
						)
						processJSON(that, json)
						resolve('not found')
					} catch (error) {
						reject(error)
					}
				}
			} catch (error) {
				reject(error)
			}
		})

		function processJSON(that, json, fileUtils) {
			try {
				let data = fileUtils.readFile(
					path.join(global.__basedir, 'sfdx-project.json'),
				)
				json.Package.version = data.sourceApiVersion
			} catch (error) {
				json.Package.version =
					packageDefinition.metadataDefinition.fallbackVersion
			}
			that.packageJSON = json
			if (json.Package.types !== undefined)
				transformJSON(json.Package.types)
			cleanPackage(that)
		}

		function cleanPackage(that) {
			if (that.packageJSON === undefined)
				throw new Error(
					'getPackageXML must be called before adding members',
				)
			if (that.packageJSON.Package == undefined)
				throw new Error('Package initialization failed')
			if (that.packageJSON.Package.types === undefined)
				return 'No types found'

			const typeArray = Object.values(global.metaTypes).map(
				(metaType) => metaType.definition.root,
			)
			that.packageJSON.Package.types.forEach((typeItem) => {
				if (typeArray.includes(typeItem.name)) {
					typeItem.members = typeItem.members.filter(
						(member) => !member.endsWith(`.${global.format}`),
					)
				}
			})
		}
	}

	addMember(type, member) {
		const that = this
		if (that.packageJSON === undefined)
			throw new Error(
				'getPackageXML must be called before adding members',
			)
		if (type === undefined || type.trim() == '')
			throw new Error(
				'An undefined type was received when attempting to add a member',
			)
		if (member === undefined || member.trim() == '')
			throw new Error(
				'An undefined member was received when attempting to add a member',
			)
		if (member.indexOf(`.${global.format}`) !== -1)
			throw new Error('Part file received as member is not allowed')

		const packageJSON = that.packageJSON
		let foundMember = false
		let foundAsterisk = false
		let typeJSON = undefined

		if (packageJSON.Package.types === undefined)
			packageJSON.Package.types = []

		packageJSON.Package.types.forEach((typeItem) => {
			try {
				if (typeItem.name.toLowerCase() == type.toLowerCase()) {
					typeJSON = typeItem
					if (typeItem.members === undefined) {
						delete typeItem.name
						typeItem.members = []
						typeItem.name = type
					}
					typeItem.members.forEach((memberItem) => {
						if (memberItem.toLowerCase() == member.toLowerCase()) {
							foundMember = true
						} else if (memberItem == '*') {
							foundAsterisk = true
						}
					})
				}
			} catch (error) {
				throw error
			}
		})

		// exit if member already exists
		if (foundMember) return
		if (foundAsterisk) {
			return
		}

		try {
			if (typeJSON !== undefined) {
				typeJSON.members.push(member)
				typeJSON.members.sort()
			} else {
				typeJSON = JSON.parse(
					JSON.stringify(
						packageDefinition.metadataDefinition.emptyNode,
					),
				)
				typeJSON.name = type
				typeJSON.members.push(member)

				packageJSON.Package.types.push(typeJSON)
			}

			packageJSON.Package.types.sort((a, b) => {
				if (a.name < b.name) return -1
				if (a.name > b.name) return 1
				return 0
			})
		} catch (error) {
			throw error
		}
	}

	savePackage(xml2js, fileUtils) {
		let that = this
		let json = that.packageJSON.Package
		try {
			json.$.xmlns = json.$.xmlns.replace('http:', 'https:')
			const version = json.version
			delete json.version
			json.version = version

			const builder = new xml2js.Builder({
				cdata: false,
				rootName: 'Package',
				xmldec: { version: '1.0', encoding: 'UTF-8' },
			})
			let fileName = that.xmlPath
			fileUtils.createDirectory(path.dirname(fileName))

			const xml = builder.buildObject(json)

			fileUtils.writeFile(fileName, xml)
		} catch (error) {
			throw error
		}
	}
}

function transformJSON(json) {
	try {
		json.forEach((typesItem) => {
			Object.keys(typesItem).forEach((key) => {
				let jsonString = JSON.stringify(
					typesItem[key],
					(name, value) => {
						if (key == 'members') {
							return value
						} else {
							return xml2json(value)
						}
					},
				)
				typesItem[key] = JSON.parse(jsonString)
			})
		})

		return
	} catch (error) {
		throw error
	}

	function xml2json(currentValue) {
		try {
			if (Array.isArray(currentValue)) {
				if (currentValue.length == 1) {
					currentValue = currentValue[0].toString().trim()
				}
			}
			if (currentValue == 'true') currentValue = true
			if (currentValue == 'false') currentValue = false
			return currentValue
		} catch (error) {
			throw error
		}
	}
}
