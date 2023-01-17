'use strict'
import * as fs from 'fs'
import * as path from 'path'
import * as yaml from 'js-yaml'
import { Parser } from 'xml2js'

export function directoryExists(dirPath, fsTmp = fs) {
    return fsTmp.existsSync(dirPath) && fsTmp.statSync(dirPath).isDirectory()
}

export function fileExists(filePath, fsTmp = fs) {
    return fsTmp.existsSync(filePath) && fsTmp.statSync(filePath).isFile()
}

export function createDirectory(dirPath, fsTmp = fs) {
    if (!fsTmp.existsSync(dirPath)) {
        fsTmp.mkdirSync(dirPath, { recursive: true })
    }
}

export function deleteDirectory(dirPath, recursive = false, fsTmp = fs) {
    if (!directoryExists(dirPath, fsTmp)) {
        return false
    } else {
        if (fsTmp.existsSync(dirPath)) {
            fsTmp.readdirSync(dirPath).forEach(function (file) {
                var curPath = path.join(dirPath, file)
                if (fsTmp.lstatSync(curPath).isDirectory() && recursive) { // recurse
                    deleteDirectory(curPath, recursive, fsTmp);
                } else { // delete file
                    fsTmp.unlinkSync(curPath);
                }
            })
            return fsTmp.rmdirSync(dirPath);
        }
    }
}

export function getFiles(dirPath, filter = undefined, fsTmp = fs) {
    const filesList = []
    if (directoryExists(dirPath, fsTmp)) {
        fsTmp.readdirSync(dirPath).forEach(file => {
            if (!filter) {
                filesList.push(file)
            } else {
                if (file.toLocaleLowerCase().endsWith(filter.toLocaleLowerCase())) {
                    filesList.push(file)
                }
            }
        })
        filesList.sort()
        return filesList
    } else {
        return []
    }
}

export function getDirectories(dirPath, fsTmp = fs) {
    if (directoryExists(dirPath, fsTmp)) {
        return fsTmp.readdirSync(dirPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name)
    } else {
        return []
    }
}

export function deleteFile(filePath, fsTmp = fs) {
    if (!fileExists(filePath, fsTmp)) {
        return false
    } else {
        return fsTmp.unlinkSync(filePath, { recursive: false, force: true });
    }
}

export function fileInfo(filePath, fsTmp = fs) {
    return {
        "dirname": path.join(path.dirname(filePath)), //something/folder/example
        "basename": path.basename(filePath, path.extname(filePath)), //example
        "filename": path.basename(filePath), //example.txt
        "extname": path.extname(filePath), //txt
        "exists": fsTmp.existsSync(filePath), //true if exists or false if not exists
        "stats": fsTmp.existsSync(filePath) ? fsTmp.statSync(filePath) : undefined //stats object if exists or undefined if not exists
    }
}

export function saveFile(json, fileName, format = path.extname(fileName).replace('.', ''), fsTmp = fs) {
    try {
        switch (format) {
            case 'json':
                let jsonString = JSON.stringify(json, null, '\t')
                fsTmp.writeFileSync(fileName, jsonString)
                break
            case 'yaml':
                let doc = yaml.dump(json)
                fsTmp.writeFileSync(fileName, doc)
                break
        }
        return true
    } catch (error) {
        global.logger.error(error)
        throw error
    }
}

export function readFile(fileName, convert = true, fsTmp = fs) {
    try {
        let result = undefined
        if (fileExists(fileName, fsTmp)) {
            const data = fsTmp.readFileSync(fileName, { encoding: 'utf8', flag: 'r' })
            if (convert && fileName.indexOf('.yaml') != -1) {
                result = yaml.load(data)
            } else if (convert && fileName.indexOf('.json') != -1) {
                result = JSON.parse(data)
            } else if (convert && fileName.indexOf('.xml') != -1) {
                // returns a promise
                result = convertXML(data)
            } else {
                result = data
            }
            return result
        } else {
            return undefined
        }
    } catch (error) {
        global.logger.error(error)
        throw error
    }
}

async function convertXML(data) {
    return new Promise((resolve, reject) => {
        try {
            let parser = new Parser()
            parser.parseString(data, function (err, result) {
                resolve(result)
            })
        } catch (error) {
            reject(error)
        }
    })
}

export function writeFile(fileName, data, atime = new Date(), mtime = new Date(), fsTmp = fs) {
    try {
        // write data to the file
        fsTmp.writeFileSync(fileName, data)

        // if atime or mtime are undefined, use current date/time
        if (atime === undefined) atime = new Date()
        if (mtime === undefined) mtime = new Date()

        // update XML file to match the latest atime and mtime of the files processed
        fsTmp.utimesSync(fileName, atime, mtime)

    } catch (error) {
        global.logger.error(error)
        throw error
    }
}

export function find(filename, root, fsTmp = fs) {
    // code Copyright (c) 2014, Ben Gourley
    // https://github.com/bengourley/find-nearest-file
    root = root || process.cwd();

    if (!filename) throw new Error('filename is required')

    if (filename.indexOf('/') !== -1 || filename === '..') {
        throw new Error('filename must be just a filename and not a path')
    }


    function findFile(directory, filename) {

        var file = path.join(directory, filename)

        try {
            if (fsTmp.statSync(file).isFile()) return file
            // stat existed, but isFile() returned false
            return nextLevelUp()
        } catch (e) {
            // stat did not exist
            return nextLevelUp()
        }

        function nextLevelUp() {
            // Don't proceed to the next directory when already at the fs root
            if (directory === path.resolve('/')) return null
            return findFile(path.dirname(directory), filename)
        }

    }

    return findFile(root, filename)
}