# Environment Setup Guide

## Environment Files Strategy

### Files You'll Use

```
.env.local          → Local development (gitignored)
.env.production     → Production secrets (gitignored)
env.example         → Template (committed to git)
```

### Load Order

React Router + dotenv loads in this order:
1. `.env.local` (highest priority)
2. `.env`
3. `env.example` (reference only)

## Setup for Different Environments

### Local Development

**File:** `.env.local` (already created!)

```bash
NODE_ENV=development

# Local Supabase
SUPABASE_URL=http://127.0.0.1:54421
SUPABASE_ANON_KEY=eyJ...  # From supabase start output
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Local Server
PORT=3000

# Ngrok
NGROK_URL=kindly-balanced-macaw.ngrok-free.app

# CRM (leave empty for local dev)
COMMERCE7_KEY=
SHOPIFY_API_KEY=
```

### Production (Heroku)

**Set via Heroku CLI or Dashboard:**

```bash
# Don't use .env files in production
# Set via Heroku config vars

heroku config:set NODE_ENV=production
heroku config:set SUPABASE_URL=https://your-project.supabase.co
heroku config:set SUPABASE_SERVICE_ROLE_KEY=your_production_key
# ... etc
```

## Loading Environment Variables

### Option 1: Automatic (Recommended)

React Router v7 automatically loads `.env` files with Vite. Just import:

```typescript
// app/lib/supabase.server.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);
```

### Option 2: Explicit dotenv (If needed)

If automatic loading doesn't work:

```bash
npm install dotenv
```

Then in `app/entry.server.tsx`:

```typescript
import 'dotenv/config';
// ... rest of file
```

## Environment Variable Access

### Server-Side Only (✅ Safe)

```typescript
// In loaders, actions, and .server.ts files
export async function loader({ request }: LoaderFunctionArgs) {
  const supabaseUrl = process.env.SUPABASE_URL;  // ✅ Works, secure
  // ...
}
```

### Client-Side (❌ Don't!)

```typescript
// In React components
function MyComponent() {
  // ❌ DON'T - exposes secrets to browser
  const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
}
```

**Only use on server:**
- Loaders
- Actions
- `.server.ts` files
- `entry.server.tsx`

## Quick Reference

### Local Development URLs

```bash
# Your app
http://localhost:3000

# Supabase Studio (view database)
http://localhost:54423

# Supabase API
http://127.0.0.1:54421

# Database (for psql/tools)
postgresql://postgres:postgres@127.0.0.1:54422/postgres

# Email testing (Inbucket)
http://localhost:54424
```

### Check Current Environment

```typescript
// In your code
console.log('Environment:', process.env.NODE_ENV);
console.log('Supabase URL:', process.env.SUPABASE_URL);
console.log('Port:', process.env.PORT);
```

### Switch Environments

```bash
# Local dev (uses .env.local)
npm run dev

# Production build
npm run build

# Production server (uses production env vars)
npm start
```

## Best Practices

### ✅ DO:
- Use `.env.local` for local development
- Commit `env.example` as template
- Use Heroku config vars for production
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only
- Use different Supabase projects for dev/prod

### ❌ DON'T:
- Commit `.env` or `.env.local` to git
- Expose service role key to client-side
- Use production keys in development
- Share .env files (regenerate if exposed)

## Your Current Setup

**✅ Already configured:**
- `.gitignore` updated to ignore `.env*` files
- `.env.local` created with local Supabase keys
- `env.example` has all variables documented
- Package already has `dotenv` dependency

**Ready to use!**

Just run:
```bash
npm run dev
```

Your app will automatically use `.env.local` values!

## Production Deployment

When deploying to Heroku:

```bash
# Set all required env vars
heroku config:set SUPABASE_URL=https://xxx.supabase.co
heroku config:set SUPABASE_SERVICE_ROLE_KEY=xxx
heroku config:set COMMERCE7_KEY=xxx
# etc...

# Deploy
git push heroku main
```

Heroku config vars override any .env files.

## Troubleshooting

### "Environment variables not loading"

```typescript
// Add to entry.server.tsx (top of file)
import 'dotenv/config';
```

### "Wrong Supabase URL in production"

Check:
```bash
# Heroku
heroku config

# Should show production URL, not localhost
```

### "Service role key exposed in browser"

- Only import `supabase.server.ts` from server-side code
- Never use service role in client components
- Use anon key for client-side (if needed)

---

**You're all set!** `.env.local` is ready with your local Supabase credentials. Just `npm run dev` and you're running!

