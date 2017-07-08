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

  describe('slice', () => {
    it('decodes slice', () => {
      const sampleData = Uint8Array.from([0x00, 0xC0, 0xFF, 0xEE]);
      const spec = bb.slice(4);

      const decoded = decode(spec, sampleData);

      assert.deepEqual(decoded, sampleData);
    })
  });

  describe('string', () => {
    it('decodes string', () => {
      const expected = "🤔 hmmmmm";
      const sampleData = Uint8Array.from([240, 159, 164, 148, 32, 104, 109, 109, 109, 109, 109]);
      const spec = bb.string(11, 'utf-8');
      const decoded = decode(spec, sampleData);
      assert.deepEqual(decoded, expected);
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
    it('???', () => {
      const spec = bb.bignumber(64);
      const data = new BigNumber('0000D000' + '0000F300', 16);
      const encoded = encode(spec, data);

      assert.deepEqual(encoded, Uint8Array.from([
        0x00, 0x00, 0xD0, 0x00, 0x00, 0x00, 0xF3, 0x00
      ]));
    })
    it('encodes bignumber', () => {
      const spec = bb.bignumber(128);
      const encoded = encode(spec,
        new BigNumber(
          '10000000'+
          '11000000'+
          '11100000'+
          '11110000'+
          '11111000'+
          '11111100'+
          '11111110'+
          '11111111'+
          '10000000'+
          '11000000'+
          '11100000'+
          '11110000'+
          '11111000'+
          '11111100'+
          '11111110'+
          '11111111',
          2
        )
      );

      const expected = [
        0b10000000,
        0b11000000,
        0b11100000,
        0b11110000,
        0b11111000,
        0b11111100,
        0b11111110,
        0b11111111,
        0b10000000,
        0b11000000,
        0b11100000,
        0b11110000,
        0b11111000,
        0b11111100,
        0b11111110,
        0b11111111
      ];

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

  describe('slice', () => {
    it('encoded slice', () => {
      const spec = bb.slice(3);
      const data = Uint8Array.from([0xC0, 0xFF, 0xEE])

      const encoded = encode(spec, data);

      assert.deepEqual(encoded, data);
    })
  });

  describe('string', () => {
    it('encoded string', () => {
      const expected = Uint8Array.from([240, 159, 164, 148, 32, 104, 109, 109, 109, 109, 109]);
      const sampleData = "🤔 hmmmmm";
      const spec = bb.string(11, 'utf-8');

      const encoded = encode(spec, sampleData);

      assert.deepEqual(encoded, expected);
    })
  })
});


function paddedBinary(n) {
  const s = n.toString(2);
  const padAmount = (8 - s.length) % 8;
  return new Array(padAmount+1).join('0') + s;
}