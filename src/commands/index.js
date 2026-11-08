const moderation = require('./moderation');
const serverquery = require('./serverquery');
const tickets = require('./ticket');
const verify = require('./verify');
const rules = require('./rules');
const games = require('./games');

module.exports = [
  ...moderation,
  ...serverquery,
  ...tickets,
  ...verify,
  ...rules,
  ...games,
];
