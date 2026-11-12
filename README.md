# Glitch Bot

Glitch is the Chaotic Gaming community bot: verification, onboarding, tickets, moderation, and live game-server status.

## Onboarding

The member path is welcome → rules acceptance → verification → game selection → introduction.

See [the onboarding setup guide](docs/ONBOARDING_SETUP.md) for the required Discord role, environment values, role hierarchy, and staff panel commands.

## Chaotic Gaming Core integration

Glitch remains an independent Discord application. When configured, it checks Core API health and reports configured game-server heartbeats using a dedicated service credential.

- Set `CORE_API_BASE_URL` to the Core API origin.
- Set `CORE_API_SERVICE_TOKEN` only after a dedicated service credential has been provisioned by Core.
- Use HTTPS except for loopback development.
- Add `coreServerId` (UUID) to a `GAME_SERVERS` entry to enable its heartbeat.
- Core outages must not prevent independent Discord features from starting.
- Never place Core service credentials in Discord messages, commands, client bundles or source control.

Core-dependent operations remain disabled until the Core service credential and relevant API endpoints are implemented.

## Local development

1. Install Node.js 22 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and fill in the bot token and server configuration.
4. Run `npm test`.
5. Run `npm run deploy` to register slash commands after reviewing the command set.
6. Run `npm start`.

Never commit `.env`, bot tokens, Core service tokens, or other secrets.
