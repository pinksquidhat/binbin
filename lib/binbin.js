const BigNumber = require('bignumber.js');
const { TextEncoder, TextDecoder } = require('text-encoding');

const embedSymbol = Symbol('embed');

function decodeSequence({subspecs}, encodedData, index, bit, _siblings) {
  const data = {};
  for (let [name, subspec] of subspecs) {
    const result = _decode(subspec, encodedData, index, bit, data);
    index = result.index;
    bit = result.bit;

    // Allow returned objects to be directly embedded / "mixed in" using special symbol
    if (name == embedSymbol) {
      for (let [propertyName, propertyValue] of Object.entries(result.data)) {
        data[propertyName] = propertyValue;
      }
    } else if (name != null) {
      data[name] = result.data;
    }
  }
  return {data, index, bit};
}

function decodeArray({length, subspec}, encodedData, index, bit, siblings) {
  if (!Number.isInteger(length)) {
    const siblingValue = siblings[length];
    if (!Number.isInteger(siblingValue)) {
      throw `Matching value "${siblingValue}" for property "${length}" was not an integer.`;
    }
    length = siblingValue;
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

function paddedBinary(n, size) {
  const s = n.toString(2);
  const padAmount = (size - s.length);
  return new Array(padAmount+1).join('0') + s;
}

function _decodeBit({size}, encodedData, index, bit, parseBinary) {
  const startBit = bit;
  const numExtraBytes = Math.floor((bit + size - 1) / 8);

  let binary = '';
  for (let i = 0; i <= numExtraBytes; i++) {
    binary += paddedBinary(encodedData[index + i], 8);
  }

  index += Math.floor((bit + size) / 8);
  bit = (bit + size) % 8;

  const data = parseBinary(binary.substr(startBit, size));
  return {data, index, bit};
}

function decodeBit({size}, encodedData, index, bit, _siblings) {
  return _decodeBit({size}, encodedData, index, bit, b => parseInt(b, 2));
}

function decodeBignumber({size}, encodedData, index, bit, _siblings) {
  return _decodeBit({size}, encodedData, index, bit, b => new BigNumber(b, 2))
}

function decodeSlice({length}, encodedData, index, bit, _siblings) {
  if (bit != 0) {
    throw 'Cannot decode slice across byte boundaries.';
  }

  if (!Number.isInteger(length)) {
    const siblingValue = siblings[length];
    if (!Number.isInteger(siblingValue)) {
      throw `Matching value "${siblingValue}" for property "${length}" was not an integer.`;
    }
    length = siblingValue;
  }

  const data = encodedData.slice(index, index + length);
  index += length;

  return {data, index, bit};
}

function decodeString({length, encoding}, encodedData, index, bit, _siblings) {
  const intermediate = decodeSlice({length}, encodedData, index, bit, _siblings);
  index = intermediate.index;
  bit = intermediate.bit;

  const data = new TextDecoder(encoding).decode(intermediate.data);
  return {data, index, bit};
}

function decodePadding({size}, encodedData, index, bit, _siblings) {
  const nextIndex = index + Math.floor((bit + size) / 8);
  const nextBit = (bit + size) % 8;

  return {data: 0, index: nextIndex, bit: nextBit};
}

const decoders = {
  sequence: decodeSequence,
  array: decodeArray,
  branch: decodeBranch,
  bit: decodeBit,
  bignumber: decodeBignumber,
  slice: decodeSlice,
  string: decodeString,
  padding: decodePadding
};

function _decode(spec, encodedData, index, bit, siblings) {
  return decoders[spec.type](spec, encodedData, index, bit, siblings);
}

function encodeSequence({subspecs}, data, encodedData, bit, _siblings) {
  if (data == null) {
    throw "Can't encode null as sequence.";
  }

  for (let subspec of subspecs) {
    if (Array.isArray(subspec)) {
      const name = subspec[0];
      subspec = subspec[1];

      if (name == embedSymbol) {
        bit = _encode(subspec, data, encodedData, bit, data).bit;
      } else {
        bit = _encode(subspec, data[name], encodedData, bit, data).bit;
      }
    } else {
      bit = _encode(subspec, null, encodedData, bit, data).bit;
    }
  }

  return {bit};
}

function encodeArray({length, subspec}, data, encodedData, bit, siblings) {
  if (!Array.isArray(data)) {
    throw "Can't encode non-array as array.";
  }

  if (!Number.isInteger(length)) {
    const siblingValue = siblings[length];
    if (Number.isInteger(siblingValue)) {
      length = siblingValue;
    } else {
      throw `Matching value "${siblingValue}" for property "${length}" was not an integer.`;
    }
  }

  if (length != data.length) {
    throw `Expected array with length ${length}, got ${data.length}.`;
  }

  let nextBit = bit;
  for (const value of data) {
    const result = _encode(subspec, value, encodedData, nextBit, null);
    nextBit = result.bit;
  }

  return {bit: nextBit};
}

function encodeBranch({match, paths, elsePath}, data, encodedData, bit, siblings) {
  if (siblings == null) {
    throw 'Can only branch as part of a sequence.';
  }

  const matchValue = siblings[match];
  if (matchValue == null) {
    throw `No property in data with name "${match}".`;
  }

  let matchingPath = paths[matchValue];
  if (matchingPath == null) {
    if (elsePath == null) {
      throw `No path matching value "${matchValue}" and no else path specified.`;
    }
    matchingPath = elsePath;
  }

  return _encode(matchingPath, data, encodedData, bit, null);
}

function encodeBit({size}, data, encodedData, bit, _siblings) {
  let currentByte;
  if (bit == 0) {
    currentByte = 0;
  } else {
    currentByte = encodedData.pop();
  }

  const mask = Math.pow(2, size) - 1;
  const maskedData = data & mask;

  const nextBit = (bit + size) % 8;
  let remainingSize = size;
  while (true) {
    const shift = 8 - remainingSize - bit;
    if (shift > 0) {
      encodedData.push(currentByte | (maskedData << shift) & 0xFF);
    } else {
      encodedData.push(currentByte | (maskedData >> -shift) & 0xFF)
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

function encodeBignumber({size}, data, encodedData, bit, _siblings) {
  const nextBit = (bit + size) % 8;
  
  let currentByte;
  if (bit == 0) {
    currentByte = 0;
  } else {
    currentByte = encodedData.pop();
  }

  const binary = paddedBinary(data, size);

  for (let startWindow = -bit; startWindow < size; startWindow += 8) {
    const slicedBinary = binary.substring(Math.max(0, startWindow), startWindow + 8);
    encodedData.push(currentByte | parseInt(slicedBinary, 2));
    currentByte = 0;
  }

  return {bit: nextBit};
}

function encodeSlice({length}, data, encodedData, bit, _siblings) {
  if (!Number.isInteger(length)) {
    const siblingValue = siblings[length];
    if (Number.isInteger(siblingValue)) {
      length = siblingValue;
    } else {
      throw `Matching value "${siblingValue}" for property "${length}" was not an integer.`;
    }
  }

  for (let element of data) {
    encodedData.push(element);
  }
}

function encodeString({length, encoding}, data, encodedData, bit, siblings) {
  const stringAsArray = new TextEncoder(encoding).encode(data);
  return encodeSlice({length}, stringAsArray, encodedData, bit, siblings);
}

function encodePadding({size}, data, encodedData, bit, siblings) {
  return encodeBit({size}, 0, encodedData, bit, siblings);
}

const encoders = {
  sequence: encodeSequence,
  array: encodeArray,
  branch: encodeBranch,
  bit: encodeBit,
  bignumber: encodeBignumber,
  slice: encodeSlice,
  string: encodeString,
  padding: encodePadding
}

function _encode(spec, data, encodedData, bit, siblings) {
  return encoders[spec.type](spec, data, encodedData, bit, siblings);
}

module.exports = {
  encode(spec, data) {
    const encodedData = [];
    _encode(spec, data, encodedData, 0, data);
    return Uint8Array.from(encodedData);
  },
  decode(spec, encodedData) {
    return _decode(spec, encodedData, 0, 0).data;
  },

  // Specs
  embed: embedSymbol,
  sequence(...subspecs) {
    const finalSubspecs = [];
    for (let [i, subspec] of subspecs.entries()) {
      if (Array.isArray(subspec)) {
        if (subspec.length != 2) {
          throw `Expected a [name, spec] pair, instead found array with length ${subspec.length}.`;
        }
        finalSubspecs.push(subspec);
      } else {
        finalSubspecs.push([null, subspec])
      }
    }
    return {type: 'sequence', subspecs: finalSubspecs};
  },
  array(length, subspec) {
    return {type: 'array', length, subspec};
  },
  branch(match, paths, elsePath) {
    return {type: 'branch', match, paths, elsePath};
  },
  bit: (function() { 
    const bit = (size = 1) => {
      if (size > 31) {
        throw 'Cannot perform bitwise operations on greater than 31-bit integers due to JavaScript limits. Consider using bignumber type.';
      }

      return {type: 'bit', size};
    };
    bit.type = 'bit';
    bit.size = 1;
    return bit;
  })(),
  nibble: {type: 'bit', size: 4}, // alias for bit(4)
  byte: {type: 'bit', size: 8},
  bignumber(size) {
    return {type: 'bignumber', size};
  },
  slice(length) {
    return {type: 'slice', length};
  },
  string(length, encoding = 'utf-8') {
    return {type: 'string', length, encoding};
  },
  padding(size) {
    return {type: 'padding', size};
  }
};