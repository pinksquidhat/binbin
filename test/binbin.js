const { assert } = require('chai');
const BigNumber = require('bignumber.js');

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

  describe('bits', () => {
    it('decodes sequence of bits', () => {
      const sampleData = [0b00001111, 0b01101100];
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
  })

  describe('bignumber', () => {
    it('decodes bignumber', () => {
      const sampleData = [];

      // push a 128-bit number
      for (let i = 0; i < 16; i++) {
        sampleData.push(0b11111111);
      }

      const decoded = decode(bb.bignumber(128), sampleData);

      assert.isTrue(decoded.equals(new BigNumber(2).pow(128).minus(1)));
    })
  })

  describe('array', () => {
    it('decodes array of bits', () => {
      const sampleData = [0b10101011, 0b01011101];
      const decoded = decode(bb.sequence(
        ['a', bb.array(16, bb.bit)]
      ), sampleData);
      
      assert.deepEqual(decoded.a, [1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1])
    });
  })

  describe('branch', () => {
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
            ['big', bb.bit(24)]
          )
        })]
      );

      const decoded1 = decode(spec, sampleData1);
      const decoded2 = decode(spec, sampleData2);

      assert.deepEqual(decoded1, {type: 0, a: 0xC0, b: 0xFF, c: 0xEE});
      assert.deepEqual(decoded2, {type: 1, big: 0xC0FFEE });
    })
  })
});

describe('encode', () => {
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

      assert.deepEqual(encoded, Uint8Array.from([0b11011001]));
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
      
      assert.deepEqual(encoded, Uint8Array.from([0b11111111, 0b10101101, 0b10101011]))
    });
    it('clips overflow', () => {
      const spec = bb.sequence(
        ['a', bb.bit(7)],
        ['b', bb.bit(12)],
        ['c', bb.bit(5)]
      );
      const encoded = encode(spec, {
        a: 0b11111111,
        b: 0b1111110101101101,
        c: 0b11101011
      });

      assert.deepEqual(encoded, Uint8Array.from([0b11111111, 0b10101101, 0b10101011]))
    })
  });

  describe('bignumber', () => {
    it ('encodes bignumber', () => {
      const spec = bb.bignumber(128);
      const encoded = encode(spec, new BigNumber(2).pow(128).minus(1));

      const expected = [];
      for (let i = 0; i < 16; i++) {
        expected.push(0b11111111);
      }

      assert.deepEqual(encoded, Uint8Array.from(expected));
    })
  })

  describe('array', () => {
    it('encodes array', () => {
      const spec = bb.sequence(
        ['a', bb.array(5, bb.bit(2))],
        ['b', bb.array(6, bb.bit)]
      );

      const encoded = encode(spec, {
        a: [0b10, 0b01, 0b11, 0b01, 0b10],
        b: [0b1, 0b1, 0b0, 0b0, 0b1, 0b1]
      });

      assert.deepEqual(encoded, Uint8Array.from([0b10011101, 0b10110011]))
    });
  });

  describe('branch', () => {
    it('encoded branch', () => {
      const spec = bb.sequence(
        ['a', bb.byte],
        ['b', bb.branch('a', {
          0: bb.sequence(
            [bb.embed, bb.array(5, bb.bit(4))],
            bb.bit(4)
          ),
          1: bb.sequence(
            [bb.embed, bb.array(5, bb.bit(2))],
            bb.bit(6)
          )
        })]
      );

      const encoded0 = encode(spec, {
        a: 0,
        b: [0b1111, 0b1110, 0b1101, 0b1100, 0b1000]
      });
      const encoded1 = encode(spec, {
        a: 1,
        b: [0b1111, 0b1110, 0b1101, 0b1100, 0b100]
      });

      assert.deepEqual(encoded0, Uint8Array.from([0, 0b11111110, 0b11011100, 0b10000000]));
      assert.deepEqual(encoded1, Uint8Array.from([1, 0b11100100, 0b00000000]));
    });
  });
});


function paddedBinary(n) {
  const s = n.toString(2);
  const padAmount = (8 - s.length) % 8;
  return new Array(padAmount+1).join('0') + s;
}