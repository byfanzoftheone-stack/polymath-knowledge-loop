# polymath-knowledge-loop
A polymath-style curriculum and agentic knowledge system for Git, coding skills, terminal relay, and interactive learning loops.

## Run
```
cp .env.example .env   # fill in placeholders; never commit .env
set -a; . ./.env; set +a
npm start              # zero dependencies, Node >= 20
npm test
```
Routes: `/` pricing + waitlist, `/api/lessons`, `/api/lessons/:id` (Pro needs `Authorization: Bearer <license key>`), `/api/waitlist`, `/api/checkout` (stub), `/api/admin/keys`.
Approvals: `npm run approvals -- list|approve <id>|reject <id>`.

See [MONETIZATION.md](MONETIZATION.md), [GOVERNANCE.md](GOVERNANCE.md), [LAUNCH.md](LAUNCH.md).
