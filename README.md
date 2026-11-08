# Glitch Bot

Glitch is the Chaotic Gaming community bot: verification, onboarding, tickets, moderation, and live game-server status.

## Onboarding

The member path is welcome → rules acceptance → verification → game selection → introduction.

See [the onboarding setup guide](docs/ONBOARDING_SETUP.md) for the required Discord role, environment values, role hierarchy, and staff panel commands.

## Local development

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and fill in the bot token and server configuration.
4. Run `npm run deploy` to register slash commands after reviewing the command set.
5. Run `npm start`.

Never commit `.env`, bot tokens, or other secrets.
