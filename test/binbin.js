const { assert } = require('chai');
const { bb, decode, encode } = require('../lib/binbin');

describe('decode', () => {
  it('decodes on boundaries', () => {
    const sampleData = [parseInt('00001111', 2), parseInt('00100001', 2)];
    const decoded = decode(bb.sequence(
      ['a', bb.bit(4)],
      ['b', bb.bit(4)],
      ['c', bb.bit(4)],
      ['d', bb.bit(4)]
    ), sampleData);

    assert.equal(decoded.a, 0);
    assert.equal(decoded.b, 15);
    assert.equal(decoded.c, 2);
    assert.equal(decoded.d, 1);
  });

  it('decodes simple bits', () => {
    const sampleData = [parseInt('00001111', 2), parseInt('01101100', 2)];
    const decoded = decode(bb.sequence(
      ['a', bb.bit(4)],
      ['b', bb.sequence(
        ['bb', bb.bit]
      )],
      ['c', bb.bit(4)],
      ['d', bb.bit(7)]
    ), sampleData);

    assert.equal(decoded.a, 0);
    assert.equal(decoded.b.bb, 1);
    assert.equal(decoded.c, 14);
    assert.equal(decoded.d, 108);
  });

  it('decodes uint', () => {
    const sampleData = [16, 16, 37];
    const decoded = decode(bb.sequence(
      ['a', bb.uint(16)],
      ['b', bb.uint(8)]
    ), sampleData);

    assert.equal(decoded.a, 4112);
    assert.equal(decoded.b, 37);
  });

  it('decodes array of bits', () => {
    const sampleData = [parseInt('10101011', 2), parseInt('01011101', 2)];
    const decoded = decode(bb.sequence(
      ['a', bb.array(16, bb.bit)]
    ), sampleData);
    
    assert.deepEqual(decoded.a, [1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1])
  });

  it('decodes branch', () => {
    const sampleData1 = [0x00, 0xC0, 0xFF, 0xEE];
    const sampleData2 = [0x01, 0xC0, 0xFF, 0xEE];

    const spec = bb.sequence(
      ['type', bb.byte],
      [bb.embed, bb.branch('type', {
        0: bb.sequence(
          ['a', bb.byte],
          ['b', bb.byte],
          ['c', bb.byte]
        ),
        1: bb.sequence(
          ['big', bb.uint(24)]
        )
      })]
    );

    const decoded1 = decode(spec, sampleData1);
    const decoded2 = decode(spec, sampleData2);

    assert.deepEqual(decoded1, {type: 0, a: 0xC0, b: 0xFF, c: 0xEE});
    assert.deepEqual(decoded2, {type: 1, big: 0xC0FFEE });
  })
});

describe('encode', () => {
  describe('uint', () => {
    it('encodes multi-byte uint', () => {
      const spec = bb.uint(24);
      const encoded = encode(spec, 0xC0FFEE);
      assert.deepEqual(encoded, [0xC0, 0xFF, 0xEE])
    });
  });

  describe('bits', () => {
    it('encodes within single byte', () => {
      const spec = bb.sequence(
        ['a', bb.bit(4)],
        ['b', bb.bit(2)],
        ['c', bb.bit(2)]
      );
      const encoded = encode(spec, {
        a: 0b1101,
        b: 0b10,
        c: 0b01
      });

      assert.deepEqual(encoded, [0b11011001]);
    });
    it('encodes across three bytes', () => {
      const spec = bb.sequence(
        ['a', bb.bit(7)],
        ['b', bb.bit(12)],
        ['c', bb.bit(5)]
      );
      const encoded = encode(spec, {
        a: 0b1111111,
        b: 0b110101101101,
        c: 0b01011
      });

      assert.deepEqual(encoded, [0b11111111, 0b10101101, 0b10101011])
    })
  })
});


function paddedBinary(n) {
  const s = n.toString(2);
  const padAmount = (8 - s.length) % 8;
  return new Array(padAmount+1).join('0') + s;
}