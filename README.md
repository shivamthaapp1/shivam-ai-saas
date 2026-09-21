# Shivam AI — Real SaaS Starter

A real Node.js multi-client chatbot admin system.

## Included
- Server-side authentication with signed HttpOnly cookie
- SQLite database
- Client CRUD
- Separate business data per client
- Public chatbot URL: `/c/:slug`
- AI API is optional: if `OPENAI_API_KEY` is empty, the public chatbot uses the business FAQ/rules
- If an API key is added, the server calls OpenAI; the key never goes to the browser
- Basic lead capture endpoint/UI
- No API spending is required for the rule-based mode

## Run
1. Copy `.env.example` to `.env`.
2. Set `JWT_SECRET` and `ADMIN_PASSWORD`.
3. `npm install`
4. `npm start`
5. Open `http://localhost:3000/admin`

## Demo login
The login is whatever you set in `.env` (`ADMIN_USERNAME` / `ADMIN_PASSWORD`).

## Production checklist
Use HTTPS, a strong secret, a persistent database/volume, backups, rate limiting, CSRF protection, proper password rotation, monitoring, and a real payment provider before selling it. Do not put OPENAI_API_KEY in frontend code.
