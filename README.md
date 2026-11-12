# UNDERCOVER — Neon Edition

Starter MVP for an online 5–12 player Undercover party game.

## Run locally
1. Install Node.js 18 or newer.
2. In this folder run `npm install`
3. Run `npm start`
4. Open `http://localhost:3000` in multiple browser tabs/devices on the same network.

## Deploy
Deploy this Node.js app to a host that supports persistent WebSocket connections (for example a Node-capable app platform). Set `NODE_ENV=production` and configure HTTPS at the hosting provider. Use a single server instance for this in-memory MVP.

## Current MVP features
- Create room with a six-digit code; join without registration.
- 5–12 players per room.
- Server-side role assignment; each role is sent only to that player's socket.
- Host can start rounds and voting, but cannot inspect other players' secret roles.
- Automatic vote tally, elimination, tie handling, and win announcement.
- Role reveal only after game end; play again.

## Important security / production notes
- No website can promise that a device or website is impossible to hack.
- This starter reduces exposure by keeping secret roles on the server and sending each player only their own role until game end.
- Room state is in memory: restarting the server clears rooms. Use Redis or a database for production persistence and multi-instance deployment.
- Add persistent player sessions/reconnect tokens, CAPTCHA or abuse controls, automated security tests, dependency scanning, logging/monitoring, and a professional security review before public launch.
- Configure strict production CORS/origin allowlisting and HTTPS at the hosting layer. Do not expose server secrets in client code.
- This MVP uses host-led phase changes and has no turn timer or Mr. White word-guess win condition yet.
