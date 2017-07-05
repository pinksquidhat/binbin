function bit(length) {
  return function(name) {
    return {name, type: 'bit', length};
  }
}

const bb = {
  bit1: {type: 'bit', length: 1},
  bit2: {type: 'bit', length: 2},
  bit3: {type: 'bit', length: 3},
  bit4: {type: 'bit', length: 4},
  bit5: {type: 'bit', length: 5},
  bit6: {type: 'bit', length: 6},
  bit7: {type: 'bit', length: 7},
  bit8: {type: 'bit', length: 8},
  uint8: {type: 'uint8'},
  array(length, subspec) {
    return {type: 'array', length, subspec};
  }
}

function paddedBinary(n) {
  const s = n.toString(2);
  const padAmount = (8 - s.length) % 8;
  return new Array(padAmount+1).join('0') + s;
}

function _decode(definition, encodedData, index, bit) {
  const decodedData = {};
  for (let entry of definition) {
    
  }
  return {decodedData, index, bit};
}

function _decode(spec, encodedData, index, bit) {
  const data = (() => {
    if (Array.isArray(spec)) {
      const data = {};
      for (let entry of spec) {
        const [name, subspec] = entry;
        const result = _decode(subspec, encodedData, index, bit);
        index = result.index;
        bit = result.bit;
        data[name] = result.data;
      }
      return data;
    } else {
      const { type } = spec;
      if (type == 'bit') {
        const startBit = bit;
        const { length } = spec;
        const numExtraBytes = Math.floor((bit + length - 1) / 8);
        
        let binary = '';
        for (let i = 0; i <= numExtraBytes; i++) {
          binary += paddedBinary(encodedData[index + i]);
        }

        index += Math.floor((bit + length) / 8);
        bit = (bit + length) % 8;

        return parseInt(binary.substr(startBit, length), 2);
      } else if (type == 'uint8') {
        if (bit != 0) {
          throw "Can't parse uint8 across byte boundary.";
        }
        return encodedData[index++];
      } else if (type == 'array') {
        const { length, subspec } = spec;
        const data = [];
        for (let i = 0; i < length; i++) {
          const result = _decode(subspec, encodedData, index, bit);          
          index = result.index;
          bit = result.bit;
          data.push(result.data);
        }
        return data;
      }
    }
  })();
  
  return {data, index, bit};
}

function decode(spec, encodedData) {
  return _decode(spec, encodedData, 0, 0).data;
}

function encode(definition, decodedData) {

}

module.exports = { bb, decode, encode };