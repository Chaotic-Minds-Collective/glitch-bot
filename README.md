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

## Chaotic Gaming Core integration

Set CORE_API_URL to the public base URL of Chaotic Gaming Core to enable its readiness check and shared server registry. When Core is available and has listed servers, Glitch uses that registry for status announcements. If Core is not configured, unavailable, or has no listed servers, Glitch falls back to the existing GAME_SERVERS configuration and Gamedig queries.

The integration is optional and read-only. Core outages do not stop the bot's Discord features. No Core database credentials or service token are required for the public readiness and server-list endpoints.
