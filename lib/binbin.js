function bit(length) {
  return function(name) {
    return {name, type: 'bit', length};
  }
}

const bb = {
  embed: Symbol('bb.embed'),
  sequence(...subspecs) {
    for (let subspec of subspecs) {
      if (Array.isArray(subspec)) {
        if (subspec.length != 2) {
          throw `Expected a [name, spec] pair, instead found array with length ${subspec.length}.`;
        }
      } else if (subspec.type != "padding") {
        throw `Expected a [name, spec] pair or bb.padding(...), instead found ${JSON.stringify(subspec)}.`;
      }
    }
    return {type: 'sequence', subspecs};
  },
  array(until, subspec) {
    return {type: 'array', until, subspec};
  },
  branch(match, paths, elsePath) {
    return {type: 'branch', match, paths, elsePath};
  },
  uint(size = 8) {
    if (size % 8 != 0) {
      throw "uint size must be a multiple of 8";
    }
    return {type: 'uint', size};
  },
  byte: {type: 'uint', size: 8}, // alias for uint(8)
  bit: (function() { 
    const bit = (size = 1) => {
      return {type: 'bit', size};
    };
    bit.type = 'bit';
    bit.size = 1;
    return bit;
  })(),
  nibble: {type: 'bit', size: 4}, // alias for bit(4)
  padding(size) {
    return {type: 'padding', size};
  }
}

function decodeSequence({subspecs}, encodedData, index, bit, _siblings) {
  const data = {};
  for (let subspec of subspecs) {
    let name = null;
    if (Array.isArray(subspec)) {
      name = subspec[0];
      subspec = subspec[1];
    }

    const result = _decode(subspec, encodedData, index, bit, data);
    index = result.index;
    bit = result.bit;

    if (name != null) {
      // Allow returned objects to be directly embedded / "mixed in" using special symbol
      if (name == bb.embed) {
        for (let [propertyName, propertyValue] of Object.entries(result.data)) {
          data[propertyName] = propertyValue;
        }
      } else {
        data[name] = result.data;
      }
    } else if (subspec.type != 'padding') {
      throw `Entry in bb.sequence must be a [name, spec] pair or bb.padding(...), instead found ${JSON.stringify(subspec)}.`;
    }
  }
  return {data, index, bit};
}

function decodeArray({until, subspec}, encodedData, index, bit, siblings) {
  let length;
  if (Number.isInteger(until)) {
    length = until
  } else {
    const siblingValue = siblings[until];
    if (!Number.isInteger(siblingValue)) {
      throw `Matching value "${siblingValue}" for property "${until}" was not an integer.`;
    }
  }

  const data = [];
  for (let i = 0; i < length; i++) {
    const result = _decode(subspec, encodedData, index, bit);          
    index = result.index;
    bit = result.bit;
    data.push(result.data);
  }
  
  return {data, index, bit};
}

function decodeBranch({match, paths, elsePath}, encodedData, index, bit, siblings) {
  if (siblings == null) {
    throw 'Can only branch as part of a sequence.';
  }

  const matchValue = siblings[match];
  if (matchValue == null) {
    throw `No property in preceding sequence with name "${match}".`;
  }

  let matchingPath = paths[matchValue];
  if (matchingPath == null) {
    if (elsePath == null) {
      throw `No path matching value "${matchValue}" and no else path specified.`;
    }
    matchingPath = elsePath;
  }

  return _decode(matchingPath, encodedData, index, bit);
}

function paddedBinary(n) {
  const s = n.toString(2);
  const padAmount = (64 - s.length) % 8;
  return new Array(padAmount+1).join('0') + s;
}

function decodeBit({size}, encodedData, index, bit, _siblings) {
  const startBit = bit;
  const numExtraBytes = Math.floor((bit + size - 1) / 8);
  
  let binary = '';
  for (let i = 0; i <= numExtraBytes; i++) {
    binary += paddedBinary(encodedData[index + i]);
  }

  index += Math.floor((bit + size) / 8);
  bit = (bit + size) % 8;

  const data = parseInt(binary.substr(startBit, size), 2);
  return {data, index, bit};
}

function decodeUint({size}, encodedData, index, bit, _siblings) {
  if (bit != 0) {
    throw "Can't parse uint across byte boundary.";
  }

  let currentValue = 0;
  do {
    currentValue = (currentValue << 8) | encodedData[index++];
    size -= 8;
  } while (size > 0);
  
  return {data: currentValue, index, bit};
}

function decodePadding({size}, encodedData, index, bit, _siblings) {
  index += Math.floor((bit + size) / 8);
  bit = (bit + size) % 8;

  return {data: null, bit, size};
}

const decoders = {
  sequence: decodeSequence,
  array: decodeArray,
  branch: decodeBranch,
  bit: decodeBit,
  uint: decodeUint,
  padding: decodePadding
};

function _decode(spec, encodedData, index, bit, siblings) {
  return decoders[spec.type](spec, encodedData, index, bit, siblings);
}

function decode(spec, encodedData) {
  return _decode(spec, encodedData, 0, 0).data;
}

function encodeSequence({subspecs}, data, encodedData, bit) {
  if (data == null) {
    throw "Can't encode null as sequence.";
  }

  for (let subspec of subspecs) {
    if (Array.isArray(subspec)) {
      const name = subspec[0];
      subspec = subspec[1];

      if (name == bb.embed) {
        bit = _encode(subspec, data, encodedData, bit).bit;
      } else {
        bit = _encode(subspec, data[name], encodedData, bit).bit;
      }
    } else {
      bit = _encode(subspec, null, encodedData, bit).bit;
    }
  }

  return {bit};
}

/*
00000000
bit(2): 11
starting at 1
01100000

10000000
bit(12): 101010101010

starting at 1

11010101 01010000
*/

function encodeBit({size}, data, encodedData, bit) {
  let currentByte;
  if (bit == 0) {
    currentByte = 0;
  } else {
    currentByte = encodedData.pop();
  }

  const nextBit = (bit + size) % 8;
  let remainingSize = size;
  while (true) {
    const shift = 8 - remainingSize - bit;
    if (shift > 0) {
      encodedData.push(currentByte | (data << shift) & 0xFF);
    } else {
      encodedData.push(currentByte | (data >> -shift) & 0xFF)
    }
    
    remainingSize -= 8;

    if (remainingSize + bit > 0) {
      currentByte = 0;
    } else {
      break;
    }
  }

  return {bit: nextBit};
}

function encodeUint(spec, data, encodedData, bit) {
  if (bit != 0) {
    throw "Can't encode uint across byte boundary.";
  }

  if (data == null) {
    throw "Can't encode null as uint.";
  }

  let size = spec.size;
  do {
    size -= 8;
    encodedData.push((data & (255 << size)) >> size);
  } while (size > 0);
  
  return {bit: 0};
}

function encodePadding(spec, data, encodedData, bit) {

}

const encoders = {
  sequence: encodeSequence,
  uint: encodeUint,
  bit: encodeBit
}

function _encode(spec, data, encodedData, bit) {
  return encoders[spec.type](spec, data, encodedData, bit);
}

function encode(spec, data) {
  const encodedData = [];
  _encode(spec, data, encodedData, 0);
  return encodedData;
}

module.exports = { bb, decode, encode };