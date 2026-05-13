# WSSAR Conference Registration — Project Context

## What This Is
A Google Apps Script web app replacing the old Google Form-based registration for the Washington SAR annual conference. Built for the `washingtonsar.org` Google Workspace.

## Repository
- **GitHub**: https://github.com/dbwiddis/wssar-conference-registration (private)
- **Local clone**: `~/wssar-conference-registration`
- **Source files**: `src/` directory (`.js` and `.html` — NOT `.gs`, Apps Script editor uses `.js`)

## Google Apps Script Project
- **Script ID**: `1s60il3Bss9w6E-dz3Ynv5fHcup_M2lSSLpMiZ1MOQzYbP-VWvI9hGj5p`
- **Deployment ID**: `AKfycbw1YMCC6oUsruVPvPmRLVLBMr5Mbbog9T1EWX9DQpaJVMkmBeEzjhSHzSwOq3esk78D`
- **Live URL**: `https://script.google.com/macros/s/AKfycbw1YMCC6oUsruVPvPmRLVLBMr5Mbbog9T1EWX9DQpaJVMkmBeEzjhSHzSwOq3esk78D/exec`
- **Bound to**: "WSSAR Conference Registration" Google Sheet in washingtonsar.org workspace
- **Logged in as**: registration@washingtonsar.org

## Deploy Workflow
```bash
# Load nvm (required each shell session on this Amazon Linux 2 machine)
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use 16

# Push code and deploy
cd ~/wssar-conference-registration/src
clasp push --force
clasp deploy -i AKfycbw1YMCC6oUsruVPvPmRLVLBMr5Mbbog9T1EWX9DQpaJVMkmBeEzjhSHzSwOq3esk78D -d "vN - description"
```
The `.clasp.json` is in `src/` (not repo root). Always use `--force` on push.

## Key Gotchas Discovered
1. **File extensions**: Apps Script editor creates `.js` files, not `.gs`. If you push `.gs` files, they're treated as NEW files and the old `.js` ones remain — your changes silently don't take effect.
2. **Serialization**: `google.script.run` can silently return `null` for complex objects. All server→client returns use `JSON.stringify()` on the server and `JSON.parse()` on the client.
3. **Deployments**: `clasp deploy` without `-i` creates a NEW deployment with a new URL. Always use `-i <DEPLOYMENT_ID>` to update the existing one.
4. **Setup function**: `SpreadsheetApp.getUi().alert()` hangs when run from the editor — replaced with `Logger.log()`.
5. **clasp login**: On this machine, `clasp login --no-localhost` works but the redirect goes to Jupyter on port 8888. After authorizing in browser, grab the `code=` parameter from the failed redirect URL and paste it into the terminal.

## Google Sheet Tabs
| Tab | Purpose |
|-----|---------|
| Config | Key/value pairs: event name, dates, cutoff, Stripe link, contacts, DonationNote, LodgingNote |
| Fields | Customizable form field labels and descriptions (FieldID, Label, Description) |
| Chapters | Dropdown options for chapter selection |
| Affiliations | Checkbox options for compatriot affiliations |
| Meals | Event, Option, Price — one row per meal choice |
| Pricing | Item, Price, Description — registration fee, raffle, donation tiers |
| Registrations | One row per registrant with payment status |
| Guests | One row per guest, linked by RegistrationID |
| Payments | Payment records (auto from Stripe webhook, manual for Zelle/check) |

## What's Done
- Multi-step registration form (Contact → Guests → Meals → Extras → Review)
- Live running total updates as selections change (updates on step navigation)
- Chapter dropdown and affiliations checkboxes populated from sheets
- Configurable field labels/descriptions from Fields sheet
- Auto-calculated registration count (1 + number of guests)
- Special meal requests on the Meals step (not Extras)
- Donation options from Pricing sheet (Patron/Patriot/Minuteman + Custom Amount)
- Donation note with EIN 91-1167420 from Config
- Stripe Checkout Sessions API integration (itemized cart with CC fee)
- StripeTestMode toggle in Config sheet (uses STRIPE_TEST_KEY or STRIPE_SECRET_KEY from Script Properties)
- Confirmation page with 3 payment buttons: Mail a Check, Send Zelle (with QR), Pay with Card
- Post-Stripe redirect shows green "Payment Received" page
- Confirmation emails (plain text + HTML) with payment instructions
- Status lookup page by email (auto-lookup via URL parameter)
- Stripe webhook handler (`doPost`) for automatic payment reconciliation
- Manual payment recording function for Zelle/check
- Registration editing (same email overwrites existing row)
- Registration cutoff date support
- Pre-fill form from existing registration via "Look up previous registration" button
- Restores: name, phone, chapter, office/title, lodging, affiliations, raffle, donation, special requests, guests
- Edit link hidden on Status page when registration is paid
- Error isolation: Stripe/email failures don't block registration submission
- Templated HTML for URL parameter passing between pages
- Anonymous access (ANYONE_ANONYMOUS) for Stripe webhook POST

## What's Next / TODOs
1. **Combine Registration+Meals into one Stripe line item** — keeps it to 4 items max (Reg+Meals, Raffle, Donation, CC Fee) matching budget categories
2. **Add "Check registration status" button** — second button on first page alongside "Look up previous registration", goes directly to status page with email pre-filled
3. **Fix meal pre-fill on lookup** — meals are now stored as JSON in MealSelections column (col R), but need to add the `MealSelections` header to the Registrations sheet. Code already saves/restores them.
4. **Raffle price hint** — add back the "$25 each" hint text (element id was missing)
5. **Stripe receipt emails** — enable in Stripe Dashboard → Settings → Emails → Successful payments (only works in live mode)
6. **View Registration Status link on Confirm page** — currently broken, needs testing after template fix

## Go-Live Checklist
When ready to switch from test to production:
1. Create a new Stripe account (or use existing) and complete activation/verification
2. In Script Properties, add `STRIPE_SECRET_KEY` with the live `sk_live_...` key
3. In Config sheet, change `StripeTestMode` from `TRUE` to `FALSE`
4. In Stripe Dashboard (live mode), create a webhook endpoint:
   - URL: `https://script.google.com/macros/s/AKfycbw1YMCC6oUsruVPvPmRLVLBMr5Mbbog9T1EWX9DQpaJVMkmBeEzjhSHzSwOq3esk78D/exec`
   - Event: `checkout.session.completed`
5. Enable receipt emails: Stripe Dashboard → Settings → Emails → Successful payments
6. Update Chapters, Affiliations, Meals, Pricing tabs with actual conference data
7. Set RegistrationCutoff date in Config sheet
8. Test end-to-end with a real card (can refund immediately after)

## Google Sheet Setup Notes
- **Registrations sheet** needs `MealSelections` header in column R (18th column) for meal pre-fill to work
- **Pricing sheet** items starting with "Donation" appear as donation options (case-insensitive match)
- **Meals sheet** row order determines display order (put Saturday Lunch before Saturday Banquet)
- **Config sheet** keys: StripeTestMode, ZelleQR (Google Drive file ID URL), DonationNote, PaymentEmail, CheckPayableTo, MailTo, ConferenceContact, PaymentContact, EventName, EventDates, LodgingNote, RegistrationCutoff, RegistrationPrefix
- **Script Properties** (separate from sheet, only visible to script editors): STRIPE_TEST_KEY, STRIPE_SECRET_KEY

## Original System Reference
The 2026 conference used a Google Form with Apps Script. The form questions and email format are documented in the chat history. Key differences from old system:
- Old: single Google Form, all-or-nothing submit, email-only payment instructions
- New: multi-step web app, live totals, status lookup page, Stripe webhook auto-reconciliation, editable registrations
