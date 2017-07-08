const fs = require('fs');
const bb = require('../lib/binbin');

const vibrato = bb.sequence(
  ['type', bb.bit(2)],
  ['direction', bb.bit]
);

const instrumentTableAssignment = bb.sequence(
  ['enabled', bb.bit],
  ['id', bb.bit(5)]
);

const pulseInstrument = bb.sequence(
  ['envelope', bb.byte],
  ['phaseTranspose', bb.byte],
  bb.padding(1),
  ['hasSoundLength', bb.bit],
  ['soundLength', bb.bit(6)],
  ['sweep', bb.byte],
  bb.padding(3),
  ['automate', bb.bit],
  ['automate2', bb.bit],
  ['vibrato', vibrato],
  bb.padding(2),
  ['table', instrumentTableAssignment],
  ['wave', bb.bit(2)],
  ['phaseFinetune', bb.bit(4)],
  ['pan', bb.bit(2)],
  bb.padding(64)
);

const waveInstrument = bb.sequence(
  bb.padding(1),
  ['volume', bb.bit(2)],
  bb.padding(5),
  ['synth', bb.bit(4)],
  ['repeat', bb.bit(4)],
  bb.padding(19),
  ['automate', bb.bit],
  ['automate2', bb.bit],
  ['vibrato', vibrato],
  bb.padding(2),
  ['table', instrumentTableAssignment],
  bb.padding(6),
  ['pan', bb.bit(2)],
  bb.padding(14),
  ['playType', bb.bit(2)],
  bb.padding(32),
  ['steps', bb.bit(4)],
  ['speed', bb.bit(4)],
  bb.byte
);

const kitInstrument = bb.sequence(
  ['volume', bb.byte],
  ['keepAttack1', bb.bit],
  ['halfSpeed', bb.bit],
  ['kit1', bb.bit(6)],
  ['length1', bb.byte],
  bb.padding(9),
  ['loop1', bb.bit],
  ['loop2', bb.bit],
  ['automate1', bb.bit],
  ['automate2', bb.bit],
  ['vibrato', vibrato],
  bb.padding(2),
  ['table', instrumentTableAssignment],
  bb.padding(6),
  ['pan', bb.bit(2)],
  ['pitch', bb.byte],
  ['keepAttack2', bb.bit],
  ['distType', bb.byte],
  ['length2', bb.byte],
  ['offset1', bb.byte],
  ['offset2', bb.byte],
  bb.padding(16)
);

const noiseInstrument = bb.sequence(
  ['envelope', bb.byte],
  ['sCommandType', bb.byte],
  bb.padding(1),
  ['hasSoundLength', bb.bit],
  ['soundLength', bb.bit(6)],
  ['sweep', bb.byte],
  bb.padding(3),
  ['automate1', bb.bit],
  ['automate2', bb.bit],
  bb.padding(5),
  ['table', instrumentTableAssignment],
  bb.padding(6),
  ['pan', bb.bit(2)],
  bb.padding(64)
);

const instrument = bb.sequence(
  ['type', bb.byte],
  [bb.embed, bb.branch('type', {
    0: pulseInstrument,
    1: waveInstrument,
    2: kitInstrument,
    3: noiseInstrument
  })]
);

const instrumentList = bb.array(64, instrument);

const decoded = bb.decode(instrumentList, fs.readFileSync('./samples/lsdjInstruments.bin'));
const reencoded = bb.encode(instrumentList, decoded);

console.log(JSON.stringify(
  decoded,
  null, 2
));

fs.writeFileSync('./samples/lsdjInstrumentsReencoded.bin', reencoded);