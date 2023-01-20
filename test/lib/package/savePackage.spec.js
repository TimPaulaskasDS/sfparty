import * as xml2js from 'xml2js'
import path from 'path'
import fs from 'fs'
import { Package } from '../../../src/lib/packageUtil.js'

const fileUtils = {
  createDirectory: jest.fn(),
  writeFile: jest.fn()
}

describe('savePackage', () => {
  let pkg
  beforeEach(() => {
    pkg = new Package('path/to/file.xml')
    pkg.packageJSON = {
      Package: {
        $: { xmlns: 'http://www.example.com' },
        version: '1.0'
      }
    }
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('should replace http with https in xmlns property', () => {
    pkg.savePackage(xml2js, fileUtils)
    expect(pkg.packageJSON.Package.$.xmlns).toBe('https://www.example.com')
  })

  it('should save version property to variable, delete it from json and set it again', () => {
    const version = pkg.packageJSON.Package.version
    pkg.savePackage(xml2js, fileUtils)
    expect(version).toBe('1.0')
    expect(pkg.packageJSON.Package.version).toBe(version)
  })

  it('should build xml object from json and write it to a file', () => {
    pkg.addMember('type', 'member');
    expect(pkg.packageJSON.Package.types[0].name).toBe('type');
    expect(pkg.packageJSON.Package.types[0].members).toEqual(['member']);
      pkg.savePackage(xml2js, fileUtils)
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<Package xmlns="https://www.example.com">\n  <types>\n    <members>member</members>\n    <name>type</name>\n  </types>\n  <version>1.0</version>\n</Package>'
    expect(fileUtils.createDirectory).toHaveBeenCalledWith(path.dirname('path/to/file.xml'))
    expect(fileUtils.writeFile).toHaveBeenCalledWith('path/to/file.xml', xml)
  })

  it('should throw an error if it occurs', () => {
    fileUtils.createDirectory.mockImplementation(() => {
      throw new Error('createDirectory error')
    })
    expect(() => {
      pkg.savePackage(xml2js, fileUtils)
    }).toThrowError('createDirectory error')
  })
})
