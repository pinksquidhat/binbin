const { assert } = require('chai');
const { bb, decode, encode } = require('../lib/binbin');

describe('decode', () => {
  it('decodes on boundaries', () => {
    const sampleData = [parseInt('00001111', 2), parseInt('00100001', 2)];
    const decoded = decode([
      ['a', bb.bit4],
      ['b', bb.bit4],
      ['c', bb.bit4],
      ['d', bb.bit4]
    ], sampleData);

    assert.equal(decoded.a, 0);
    assert.equal(decoded.b, 15);
    assert.equal(decoded.c, 2);
    assert.equal(decoded.d, 1);
  })
  it('decodes simple bits', () => {
    const sampleData = [parseInt('00001111', 2), parseInt('01101100', 2)];
    const decoded = decode([
      ['a', bb.bit4],
      ['b', [
        ['bb', bb.bit1]
      ]],
      ['c', bb.bit4],
      ['d', bb.bit7]
    ], sampleData);

    assert.equal(decoded.a, 0);
    assert.equal(decoded.b.bb, 1);
    assert.equal(decoded.c, 14);
    assert.equal(decoded.d, 108);
  });
  it('decodes uint8', () => {
    const sampleData = [13, 37];
    const decoded = decode([
      ['a', bb.uint8],
      ['b', bb.uint8]
    ], sampleData);

    assert.equal(decoded.a, 13);
    assert.equal(decoded.b, 37);
  });
  it('decodes array of bits', () => {
    const sampleData = [parseInt('10101011', 2), parseInt('01011101', 2)];
    const decoded = decode([
      ['a', bb.array(16, bb.bit1)]
    ], sampleData);
    
    assert.deepEqual(decoded.a, [1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1])
  })
});
