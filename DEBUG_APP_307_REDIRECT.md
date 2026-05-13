# Debug: why does `/app` return 307 → `/login`?

A `307 Temporary Redirect` to `/login` can only come from one of these places in Next.js:
1. A `redirect("/login")` call in a server component or route handler.
2. A `middleware.ts` calling `NextResponse.redirect(...)`.
3. A `redirects()` block in `next.config.ts` or `vercel.json`.
4. A stale `.next/` build cache serving an older route table.

Already eliminated:
- No `middleware.ts` exists anywhere in the repo.
- `next.config.ts` has no `redirects()` block.
- `vercel.json` only has buildCommand and crons.
- `app/page.tsx` only redirects when path is `/` (not `/app`).
- `app/(protected)/layout.tsx` only fires inside the protected route group; `/app` is NOT inside it.

That leaves stale build cache as the prime suspect. **Run these commands in order. Stop at the first one that fixes it.**

---

## Step 1 — Nuke the Next.js cache and restart

```bash
# In your project root
# 1. Stop the dev server (Ctrl+C in the terminal running `npm run dev`)
# 2. Then run:
rm -rf .next
rm -rf node_modules/.cache
npm run dev
```

Wait until the dev server reports `Ready in X ms`. Then in a SEPARATE terminal:

```bash
curl -i http://localhost:9568/app
```

**Expected response now:**
```
HTTP/1.1 200 OK
content-type: text/html; charset=utf-8
...
<!DOCTYPE html>
<html>... Flutter index.html ...
```

If you see 200 with HTML → cache was stale. Fix is in place. Skip to Step 4.

If you still see `307 → /login` → continue to Step 2.

---

## Step 2 — Verbose curl to find which middleware/handler is sending it

```bash
curl -v http://localhost:9568/app 2>&1 | grep -i -E "^< |x-|server:|location:"
```

Look for these telltale headers:
- `x-middleware-rewrite` — means middleware (you have none, so this shouldn't appear).
- `x-nextjs-cache` — tells you if a cached response is being served.
- `x-matched-path` — Next.js shows what route matched.
- `server:` — should be `Next.js` or similar.

Paste the output. The `x-matched-path` will tell us EXACTLY which file in `app/` is generating the redirect.

---

## Step 3 — If `x-matched-path` shows `/login` directly

That means Next.js routing matched `/app` to `app/login/page.tsx` somehow — which would only happen if `app/app/route.ts` is failing to compile. Check:

```bash
# Run TypeScript check on just that file
npx tsc --noEmit app/app/route.ts
npx tsc --noEmit app/app/[...slug]/route.ts
```

Any error → fix the syntax → restart dev server.

Also check the dev server console output that's running in your other terminal. If there's a compilation error, Next.js prints it there and silently falls back to the nearest matching route (often `app/page.tsx` or `app/login/page.tsx` if it's the default).

---

## Step 4 — Once `/app` returns 200, verify the trailing-slash fix

```bash
# With trailing slash
curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:9568/app/

# Without trailing slash
curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:9568/app
```

Both should return `200`. If `/app` (no slash) returns 200 with the Flutter HTML, you don't even need the 308-redirect fix from the previous prompt — Next.js is serving the route handler correctly.

Then test in browser:
1. Open `localhost:9568/app` (no slash).
2. Should see Flutter splash, then badge-PIN screen.
3. Should NOT see "WELCOME BACK · Email/Password" anywhere.

---

## Step 5 — If Step 1 didn't fix it (the redirect persists after cache wipe)

There's something we haven't found. Run this to dump everything that could redirect:

```bash
# Find all files that call redirect() to /login
grep -rn "redirect.*['\"]\\/login" app/ lib/ --include='*.ts' --include='*.tsx'

# Find all files that set Location header to /login
grep -rn "Location.*['\"]\\/login\\|location.*['\"]\\/login" app/ lib/ --include='*.ts' --include='*.tsx'

# Find ANY file that touches /app routing
grep -rn "['\"]\\/app['\"]\\|['\"]\\/app\\/" app/ lib/ middleware* next.config* vercel.json --include='*.ts' --include='*.tsx' --include='*.json' 2>/dev/null
```

Paste the output of all three. The culprit will be in there.

---

## Most likely outcome

Based on the symptom, **Step 1 will fix it.** Here's why:

The `app/app/route.ts` file in your repo correctly returns 200 + HTML. It's been there since `May 10` per `ls -la`. If your dev server was started before some recent change (e.g., when `app/page.tsx` was modified to add the chooser, or when other prompts were applied), Next.js's dev server sometimes fails to rebuild the route table for handler-style routes (`route.ts`) — only for page-style routes (`page.tsx`). A full cache wipe forces Next.js to re-enumerate everything.

If Step 1 doesn't fix it, paste the output of Step 2 (`curl -v`) and we'll know in one second which handler is firing.
