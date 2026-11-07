const moderation = require('./moderation');
const serverquery = require('./serverquery');
const tickets = require('./ticket');
const verify = require('./verify');
module.exports = [
  ...moderation,
  ...serverquery,
  ...tickets,
  ...verify,
];
