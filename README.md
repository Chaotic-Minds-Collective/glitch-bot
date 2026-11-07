# GLITCH - Chaotic Gaming Community Bot

"Community built by gamers, for gamers."

## Features
- Custom join ("SIGNAL ACQUIRED") and leave ("SIGNAL LOST") messages
- One-tap verification button (grants Member role)
- Welcome DM to every new member
- Support tickets (private channels, close button)
- Moderation: /warn /timeout /kick /ban /purge with mod-log
- Live game server status in #server-status (7DtD, ARK E/SA, ATLAS via gamedig)
- /serverstatus slash command for on-demand checks

## Setup
1. `npm install`
2. `cp .env.example .env` and fill in token + IDs
3. `npm run deploy` (registers slash commands)
4. `npm start`

## Rules of this repo
- Never commit .env or the bot token.
- Bot permissions are least-privilege; no Administrator.
