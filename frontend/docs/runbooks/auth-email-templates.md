# Supabase Auth email-template configuration

Pauv switched from Supabase's default PKCE confirmation-link flow to
the **token-hash** flow so that email confirmations work regardless of
which browser the user clicks the link in. This document explains the
dashboard config that activates the new flow.

## Why the change

The default Supabase confirmation email uses `{{ .ConfirmationURL }}`,
which generates a link of the form `…/auth/callback?code=<auth_code>`.
That `code` is exchanged on the server via PKCE, which requires the
`code_verifier` cookie set in the browser that initiated signup. If a
user opens the email on a different device or browser, the cookie
isn't there, and the exchange fails with:

> PKCE code verifier not found in storage. This can happen if the auth
> flow was initiated in a different browser or device…

The token-hash flow uses `{{ .TokenHash }}` directly, which the
`/auth/confirm/route.ts` handler verifies via
`supabase.auth.verifyOtp({ token_hash, type })`. No verifier cookie
required — works from any browser.

OAuth (Google) is unaffected and continues to use PKCE via
`/auth/callback/route.ts`. OAuth always starts and ends in the same
tab so PKCE is the right choice there.

## Applying the template change

The final designed templates (dark theme, on-brand, bulletproof Outlook
button, mobile-responsive, WCAG AA contrast) live as source-of-truth
HTML files under [docs/email-templates/](../email-templates/):

| Template (Supabase) | File |
| --- | --- |
| Confirm signup | [docs/email-templates/confirm-signup.html](../email-templates/confirm-signup.html) |
| Magic Link / OTP | [docs/email-templates/magic-link.html](../email-templates/magic-link.html) |
| Change Email Address | [docs/email-templates/change-email.html](../email-templates/change-email.html) |
| Reset Password | [docs/email-templates/reset-password.html](../email-templates/reset-password.html) |

For each file, open it, copy the entire contents, and paste over the
template's **Body** field in the Supabase dashboard. Subject lines are
not in the HTML — keep the existing Subject in each template.

Repeat for BOTH Supabase projects:

| Environment | Project ref | URL |
| --- | --- | --- |
| Staging | `stcprpfshrcbajrxvxrq` | https://supabase.com/dashboard/project/stcprpfshrcbajrxvxrq/auth/templates |
| Prod | `iawngxubkakulvrqvxal` | https://supabase.com/dashboard/project/iawngxubkakulvrqvxal/auth/templates |

### Minimal fallback (if you only want the URL change)

If for any reason you want to keep the current Supabase default
look-and-feel and only fix the cross-browser bug, just replace the
existing anchor with the token-hash form. The exact replacement per
template:

### Template 1 — Confirm signup

Find the line that looks like:
```html
<a href="{{ .ConfirmationURL }}">Confirm your mail</a>
```

Replace with:
```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/">Confirm your mail</a>
```

### Template 2 — Magic Link

Find:
```html
<a href="{{ .ConfirmationURL }}">Log In</a>
```

Replace with:
```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink&next=/">Log In</a>
```

### Template 3 — Change Email Address

Find:
```html
<a href="{{ .ConfirmationURL }}">Change Email</a>
```

Replace with:
```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change&next=/">Change Email</a>
```

### Template 4 — Reset Password

Find:
```html
<a href="{{ .ConfirmationURL }}">Reset Password</a>
```

Replace with:
```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/account/settings">Reset Password</a>
```

Per [Supabase docs](https://supabase.com/docs/guides/auth/server-side/email-based-auth-with-pkce-flow-for-ssr),
the `type` query value must match the email type exactly:
`signup | magiclink | email_change | recovery | invite`.

## Verification

After saving the templates:

1. From a fresh incognito window on staging, sign up with a new email.
2. Open the confirmation email on a **different** browser (or device).
3. Click the link. You should land signed in at `/` (or whatever
   `next` you set).
4. Repeat on prod once staging is verified.

Failure modes the new flow handles gracefully:

| User action | Outcome |
| --- | --- |
| Click link in different browser | ✅ Signs in correctly |
| Click link more than once | ❌ `auth_error=invalid_token` → friendly "link was invalid" message |
| Click link after 24h (Supabase default) | ❌ `auth_error=expired_token` → friendly "expired, sign up again" message |
| Server tampers `token_hash` | ❌ `auth_error=verify_failed` → generic friendly message |

The corresponding client-side error mappings live in
`friendlyAuthError(message, "callback")` at
[components/auth/AuthForm.tsx](../../components/auth/AuthForm.tsx).

## Rollback

If something is wrong with the token-hash flow on prod, revert the
templates to the default `{{ .ConfirmationURL }}` form. The
`/auth/callback` PKCE handler still exists and will continue to work
for same-browser confirmations — only cross-browser email clicks will
break (the pre-change behavior).

No code rollback required; the two routes coexist by design.
