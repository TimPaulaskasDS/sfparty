import child_process from 'child_process'
import { expect } from 'chai'
import axios from 'axios'
import { checkVersion } from '../../src/index.js'
import sinon from 'sinon'

describe('checkVersion', () => {
    let currentVersion = '1.0.0'
    let update = false
    let execStub
    let test = true

    beforeEach(() => {
        execStub = sinon.replace(child_process, 'exec', sinon.stub())
    })

    afterEach(() => {
        sinon.restore()
    })

    it('should return a message that a new version is available', async () => {
        axios.get = () => Promise.resolve({ data: { 'dist-tags': { latest: '2.0.0' } } })
        const result = await checkVersion(currentVersion, update, test)
        expect(result).to.include('A newer version')
    })

    it('should return a message that the user is on the latest version', async () => {
        axios.get = () => Promise.resolve({ data: { 'dist-tags': { latest: '1.0.0' } } })
        update = true
        const result = await checkVersion(currentVersion, update, test)
        expect(result).to.include('You are on the latest version')
    })

    it('should return an error message if npm is not installed', async () => {
        execStub.yields(new Error('npm is not installed'))
        update = true
        try {
            await checkVersion(currentVersion, update, test)
        } catch (error) {
            expect(error.message).to.include('npm is not installed')
        }
    })
})
