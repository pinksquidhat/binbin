const fs = require('fs');
const { bb, decode } = require('../lib/binbin');

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
  bb.bit,
  ['hasSoundLength', bb.bit],
  ['soundLength', bb.bit(6)],
  ['sweep', bb.byte],
  ['padding1', bb.bit(3)],
  ['automate', bb.bit],
  ['automate2', bb.bit],
  ['vibrato', vibrato],
  bb.bit(2),
  ['table', instrumentTableAssignment],
  ['wave', bb.bit(2)],
  ['phaseFinetune', bb.bit(4)],
  ['pan', bb.bit(2)],
  bb.bit(64)
);

const waveInstrument = bb.sequence(
  bb.bit,
  ['volume', bb.bit(2)],
  bb.bit(5),
  ['synth', bb.bit(4)],
  ['repeat', bb.bit(4)],
  bb.bit(19),
  ['automate', bb.bit],
  ['automate2', bb.bit],
  ['vibrato', vibrato],
  bb.bit(2),
  ['table', instrumentTableAssignment],
  bb.bit(6),
  ['pan', bb.bit(2)],
  bb.bit(14),
  ['playType', bb.bit(2)],
  bb.bit(32),
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
  bb.bit(9),
  ['loop1', bb.bit],
  ['loop2', bb.bit],
  ['automate1', bb.bit],
  ['automate2', bb.bit],
  ['vibrato', vibrato],
  bb.bit(2),
  ['table', instrumentTableAssignment],
  bb.bit(6),
  ['pan', bb.bit(2)],
  ['pitch', bb.byte],
  ['keepAttack2', bb.bit],
  ['distType', bb.byte],
  ['length2', bb.byte],
  ['offset1', bb.byte],
  ['offset2', bb.byte],
  bb.bit(16)
);

const noiseInstrument = bb.sequence(
  ['envelope', bb.byte],
  ['sCommandType', bb.byte],
  bb.bit,
  ['hasSoundLength', bb.bit],
  ['soundLength', bb.bit(6)],
  ['sweep', bb.byte],
  bb.bit(3),
  ['automate1', bb.bit],
  ['automate2', bb.bit],
  bb.bit(5),
  ['table', instrumentTableAssignment],
  bb.bit(6),
  ['pan', bb.bit(2)],
  bb.bit(64)
);

const instrument = bb.sequence(
  ['type', bb.byte],
  ['parameters', bb.branch('type', {
    0: pulseInstrument,
    1: waveInstrument,
    2: kitInstrument,
    3: noiseInstrument
  })]
);

const instrumentList = bb.array(64, instrument);

console.log(JSON.stringify(
  decode(instrumentList, fs.readFileSync('./samples/lsdjInstruments.bin')),
  null, 2
));