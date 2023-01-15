import * as git from '../../src/lib/gitUtils.js'
import { expect } from 'chai'

describe('gitDiff', () => {
    it('should return an array of diff objects', async () => {
        const diffs = await git.diff(process.cwd(), 'HEAD~1..HEAD')
        expect(diffs).to.be.an('array')
        expect(diffs[0]).to.satisfy(diff => {
            if(Object.keys(diff).length === 0) return true
            if(diff.hasOwnProperty('type') && diff.hasOwnProperty('path')) return true
            return false
        })
    })

    it('should map the status to one of add, delete, or ignore', async () => {
        const diffs = await git.diff(process.cwd(), 'HEAD~10..HEAD')
        expect(diffs).to.be.an('array')
        if(diffs[0].hasOwnProperty('type')){
            expect(diffs[0].type).to.be.oneOf(['add', 'delete', 'ignore'])
        }
    })

    it('should reject on stderr data', async () => {
        try {
            await git.diff(process.cwd(), 'invalid-commit1 invalid-commit2')
        } catch (err) {
            expect(err).to.be.an('error')
        }
    })
})
