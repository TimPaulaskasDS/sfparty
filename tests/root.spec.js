'use strict';
import chai from 'chai'

var calls = [];

before(function () {
  calls.push('before');
});

describe('root', function () {
  it('should be a valid suite', function () {
    chai.expect(calls, 'to equal', ['before']);
  });
});