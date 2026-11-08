# Glitch Bot onboarding setup

Glitch's onboarding sequence is:

1. Welcome message in `#welcome`.
2. Read the rules and accept them in `#rules`.
3. Verify in `#✅verify✅`; Glitch assigns the existing `Verified` role.
4. Choose game roles in `#pick-your-world`.
5. Introduce yourself in `#introduce-yourself`.

## One required Discord setup item

The server currently has no dedicated rules-acceptance role. Create a role named **Rules Accepted** in Discord and copy its role ID into `ROLE_RULES_ACCEPTED` in the bot's environment.

Place **Rules Accepted** below the Glitch Bot role so Glitch can assign it. Keep the existing **Verified** role and game roles below Glitch Bot as well. Do not give Rules Accepted any member-area permissions; it is only an acceptance marker.

This role is intentionally separate from Verified:
- Rules Accepted proves the member pressed the rules acceptance button.
- Verified is assigned only after the member has accepted the rules and pressed the verification button.

## Environment

Copy the new values from `.env.example` into the deployment environment. Never commit `.env` or a real Discord token.

The existing game roles are configured by ID:
- 7 Days to Die
- ATLAS
- ARK: Survival Evolved
- ARK: Survival Ascended

## Publish the panels

After the bot is running with the updated environment and has Manage Roles permission, run these staff-only slash commands:

- `/rulespanel` — posts the acceptance panel in the configured rules channel.
- `/verifypanel` — posts the verification panel in the configured verification channel.
- `/gamepanel` — posts the game selector in the configured pick-your-world channel.

Deploy slash-command definitions with `npm run deploy` after updating the code. This command updates Discord's guild command definitions; do not run it until the new code and environment have been reviewed.

## Permission and safety notes

- Glitch needs Manage Roles.
- Glitch's highest role must be above Rules Accepted, Verified, and all four game roles.
- Members must have Verified before the game selector will assign game roles.
- The game selector only adds/removes the four configured game roles; it does not touch staff or unrelated roles.
- The panels can be posted repeatedly; staff should remove obsolete duplicate panels manually.
