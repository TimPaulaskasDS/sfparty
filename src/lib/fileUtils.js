'use strict'
import * as fs from 'fs'
import * as path from 'path'
import * as yaml from 'js-yaml'

export function directoryExists(dirPath) {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()
}

export function fileExists(filePath) {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile()
}

export function createDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true })
    }
}

export function deleteDirectory(dirPath, recursive = false) {
    if (!directoryExists(dirPath)) {
        return false
    } else {
        if (fs.existsSync(dirPath)) {
            fs.readdirSync(dirPath).forEach(function (file) {
                var curPath = path.join(dirPath, file)
                if (fs.lstatSync(curPath).isDirectory() && recursive) { // recurse
                    deleteDirectory(curPath, recursive);
                } else { // delete file
                    fs.unlinkSync(curPath);
                }
            })
            return fs.rmdirSync(dirPath);
        }
    }
}

export function getFiles(dirPath, filter = undefined) {
    const filesList = []
    if (directoryExists(dirPath)) {
        fs.readdirSync(dirPath).forEach(file => {
            if (!filter) {
                filesList.push(file)
            } else {
                if (file.endsWith(filter)) {
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

export function getDirectories(dirPath) {
    if (directoryExists(dirPath)) {
        return fs.readdirSync(dirPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
    } else {
        return []
    }
}

export function deleteFile(filePath) {
    if (!fileExists(filePath)) {
        return false
    } else {
        return unlinkSync(filePath, { recursive: false, force: true });
    }
}

export function fileInfo(filePath) {
    return {
        "dirname": path.join(path.dirname(filePath)), //something/folder/example
        "basename": path.basename(filePath, path.extname(filePath)), //example
        "filename": path.basename(filePath), //example.txt
        "extname": path.extname(filePath), //txt
        "exists": fs.existsSync(filePath), //true if exists or false if not exists
        "stats": fs.existsSync(filePath) ? fs.statSync(filePath) : undefined //stats object if exists or undefined if not exists
    }
}

export function savePartFile(json, fileName, format) {
    try {
        switch (format) {
            case 'json':
                let jsonString = JSON.stringify(json, null, '\t')
                fs.writeFileSync(fileName, jsonString)
                break
            case 'yaml':
                let doc = yaml.dump(json)
                fs.writeFileSync(fileName, doc)
                break
        }
        return true
    } catch (error) {
        global.logger.error(error)
        throw error
    }
}

export function readPartFile(fileName) {
    try {
        let result = undefined
        const data = fs.readFileSync(fileName, { encoding: 'utf8', flag: 'r' })
        if (fileName.indexOf('.yaml') != -1) {
            result = yaml.load(data)
        } else {
            result = JSON.parse(data)
        }
        return result
    } catch (error) {
        global.logger.error(error)
        throw error
    }
}

export function writeFile(fileName, data, atime = new Date(), mtime = new Date()) {
    try {
        // write data to the file
        fs.writeFileSync(fileName, data)

        // if atime or mtime are undefined, use current date/time
        if (atime === undefined) atime = new Date()
        if (mtime === undefined) mtime = new Date()

        // update XML file to match the latest atime and mtime of the files processed
        fs.utimesSync(fileName, atime, mtime)

    } catch (error) {
        global.logger.error(error)
        throw error
    }
}

export function find(filename, root) {
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
            if (fs.statSync(file).isFile()) return file
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