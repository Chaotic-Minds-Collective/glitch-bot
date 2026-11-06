const moderation = require('./moderation');
const serverquery = require('./serverquery');
const tickets = require('./ticket');
const verify = require('./verify');

/**
 * Aggregates every slash command module into one array for the client.
 */
module.exports = [
  ...moderation,
  ...serverquery,
  ...tickets,
  ...verify,
];
