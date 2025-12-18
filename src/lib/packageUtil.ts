import fs from 'fs'
import path from 'path'
import type { Builder } from 'xml2js'
import * as packageDefinition from '../meta/Package.js'

interface FileUtilsInterface {
	fileExists: (options: { filePath: string; fs: typeof fs }) => boolean
	readFile: (filePath: string) => unknown
	createDirectory: (dirPath: string) => void
	writeFile: (fileName: string, data: string) => void
}

interface XML2JSInterface {
	Builder: typeof Builder
}

interface PackageNode {
	members: string[]
	name?: string
	[key: string]: unknown
}

interface PackageJSON {
	Package: {
		$: { xmlns: string }
		version?: string
		types?: PackageNode[]
	}
}

interface GlobalContext {
	__basedir?: string
	git?: {
		append?: boolean
	}
	format?: string
	metaTypes?: Record<string, { definition: { root: string } }>
	logger?: {
		error: (error: Error | unknown) => void
	}
}

declare const global: GlobalContext & typeof globalThis

export class Package {
	xmlPath: string
	packageJSON: PackageJSON | undefined

	constructor(xmlPath: string) {
		this.xmlPath = xmlPath
		this.packageJSON = undefined
	}

	getPackageXML(fileUtils: FileUtilsInterface): Promise<string> {
		const that = this
		return new Promise((resolve, reject) => {
			try {
				if (that.xmlPath === undefined)
					throw new Error('Package not initialized')

				const fileName = path.resolve(that.xmlPath)
				if (
					fileUtils.fileExists({ filePath: fileName, fs }) &&
					global.git?.append
				) {
					const dataPromise = fileUtils.readFile(fileName)
					if (dataPromise instanceof Promise) {
						dataPromise
							.then((json) => {
								try {
									let packageJson = json as
										| PackageJSON
										| undefined
									if (
										packageJson === undefined ||
										Object.keys(packageJson).length === 0
									) {
										packageJson = JSON.parse(
											JSON.stringify(
												packageDefinition
													.metadataDefinition
													.emptyPackage,
											),
										) as PackageJSON
									}
									processJSON(that, packageJson, fileUtils)
									resolve('existing')
								} catch (error) {
									reject(error)
								}
							})
							.catch((error) => {
								reject(error)
							})
					} else {
						try {
							let packageJson = dataPromise as
								| PackageJSON
								| undefined
							if (
								packageJson === undefined ||
								(packageJson &&
									Object.keys(packageJson).length === 0)
							) {
								packageJson = JSON.parse(
									JSON.stringify(
										packageDefinition.metadataDefinition
											.emptyPackage,
									),
								) as PackageJSON
							}
							processJSON(that, packageJson, fileUtils)
							resolve('existing')
						} catch (error) {
							reject(error)
						}
					}
				} else {
					try {
						const json: PackageJSON = JSON.parse(
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

		function processJSON(
			that: Package,
			json: PackageJSON,
			fileUtils?: FileUtilsInterface,
		): void {
			try {
				if (fileUtils) {
					const data = fileUtils.readFile(
						path.join(global.__basedir || '', 'sfdx-project.json'),
					) as { sourceApiVersion: string }
					json.Package.version = data.sourceApiVersion
				}
			} catch (error) {
				json.Package.version =
					packageDefinition.metadataDefinition.fallbackVersion
			}
			that.packageJSON = json
			if (json.Package.types !== undefined) {
				transformJSON(json.Package.types)
			}
			cleanPackage(that)
		}

		function cleanPackage(that: Package): void | string {
			if (that.packageJSON === undefined)
				throw new Error(
					'getPackageXML must be called before adding members',
				)
			if (that.packageJSON.Package === undefined)
				throw new Error('Package initialization failed')

			if (that.packageJSON.Package.types === undefined)
				return 'No types found'

			const typeArray = Object.values(global.metaTypes || {}).map(
				(metaType) => metaType.definition.root,
			)
			that.packageJSON.Package.types.forEach((typeItem) => {
				if (typeArray.includes(typeItem.name || '')) {
					typeItem.members = typeItem.members.filter(
						(member) => !member.endsWith(`.${global.format}`),
					)
				}
			})

			// remove all types nodes that have no members
			that.packageJSON.Package.types =
				that.packageJSON.Package.types.filter(
					(subType) => subType.members.length > 0,
				)
		}
	}

	addMember(type: string, member: string): void {
		const that = this
		if (that.packageJSON === undefined)
			throw new Error(
				'getPackageXML must be called before adding members',
			)
		if (type === undefined || type.replaceAll('\t', '').trim() === '')
			throw new Error(
				'An undefined type was received when attempting to add a member',
			)
		if (member === undefined || member.replaceAll('\t', '').trim() === '')
			throw new Error(
				'An undefined member was received when attempting to add a member',
			)
		if (member.indexOf(`.${global.format}`) !== -1)
			throw new Error('Part file received as member is not allowed')

		const cleanType = type.replaceAll('\t', '')
		const cleanMember = member.replaceAll('\t', '')

		const packageJSON = that.packageJSON
		let foundMember = false
		let foundAsterisk = false
		let typeJSON: PackageNode | undefined

		if (packageJSON.Package.types === undefined)
			packageJSON.Package.types = []

		packageJSON.Package.types.forEach((typeItem) => {
			try {
				if (typeItem.name?.toLowerCase() === cleanType.toLowerCase()) {
					typeJSON = typeItem
					if (typeItem.members === undefined) {
						delete typeItem.name
						typeItem.members = []
						typeItem.name = cleanType
					}
					typeItem.members.forEach((memberItem) => {
						if (
							memberItem.toLowerCase() ===
							cleanMember.toLowerCase()
						) {
							foundMember = true
						} else if (memberItem === '*') {
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
			if (typeJSON !== undefined && typeJSON.members) {
				typeJSON.members.push(cleanMember)
				typeJSON.members.sort()
			} else {
				typeJSON = JSON.parse(
					JSON.stringify(
						packageDefinition.metadataDefinition.emptyNode,
					),
				) as PackageNode
				typeJSON.name = cleanType
				typeJSON.members.push(cleanMember)

				packageJSON.Package.types.push(typeJSON)
			}

			packageJSON.Package.types.sort((a, b) => {
				if ((a.name || '') < (b.name || '')) return -1
				if ((a.name || '') > (b.name || '')) return 1
				return 0
			})
		} catch (error) {
			throw error
		}
	}

	savePackage(
		xml2jsModule: XML2JSInterface,
		fileUtils: FileUtilsInterface,
	): void {
		const that = this
		if (!that.packageJSON) {
			throw new Error('Package JSON is undefined')
		}
		const json = that.packageJSON.Package
		try {
			json.$.xmlns = json.$.xmlns.replace('http:', 'https:')
			const version = json.version
			delete json.version
			json.version = version

			const builder = new xml2jsModule.Builder({
				cdata: false,
				rootName: 'Package',
				xmldec: { version: '1.0', encoding: 'UTF-8' },
			})
			const fileName = that.xmlPath
			fileUtils.createDirectory(path.dirname(fileName))

			const xml = builder.buildObject(json)

			fileUtils.writeFile(fileName, xml)
		} catch (error) {
			throw error
		}
	}
}

function transformJSON(json: PackageNode[]): void {
	try {
		json.forEach((typesItem) => {
			Object.keys(typesItem).forEach((key) => {
				const jsonString = JSON.stringify(
					typesItem[key as keyof PackageNode],
					(_name, value) => {
						if (key === 'members') {
							return value
						} else {
							return xml2json(value)
						}
					},
				)
				;(typesItem as Record<string, unknown>)[key] = JSON.parse(
					jsonString,
				) as unknown
			})
		})

		return
	} catch (error) {
		throw error
	}

	function xml2json(currentValue: unknown): unknown {
		try {
			let value = currentValue
			if (Array.isArray(value)) {
				if (value.length === 1) {
					value = value[0].toString().trim()
				}
			}
			if (value === 'true') value = true
			if (value === 'false') value = false
			return value
		} catch (error) {
			throw error
		}
	}
}
