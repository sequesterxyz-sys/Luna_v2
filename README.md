# Luna v2

A secure Netlify-ready Luna web app. The browser never receives the Anthropic API key; requests are handled by Netlify Functions.

## Deploy with Netlify

1. Push this repository to GitHub.
2. In Netlify, choose **Add new project → Import an existing project**.
3. Connect GitHub and select this repository.
4. Netlify reads `netlify.toml`; no custom build command is required.
5. Add these environment variables in Netlify:
   - `ANTHROPIC_API_KEY`
   - `ANTHROPIC_MODEL`
6. Trigger a new production deploy.

## Endpoints

- `/api/health`
- `/api/chat`

## Local development

```bash
npm install
npx netlify dev
```

Copy `.env.example` to `.env` and insert your own credentials. Never commit `.env` or any API key.

## Security

- Anthropic credentials remain server-side.
- Direct browser access to Anthropic is not used.
- `.env` files are excluded by `.gitignore`.
