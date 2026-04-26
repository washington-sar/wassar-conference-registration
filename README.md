# WSSAR Conference Registration

Google Apps Script web app for the Washington SAR annual conference registration.

## Features

- Multi-step registration form with live running total
- Support for compatriot + multiple guests with individual meal selections
- Real-time status lookup page (by email)
- Edit/update existing registrations
- Stripe webhook for automatic payment reconciliation
- Zelle/check manual payment tracking
- Configurable meals, pricing, and event details via spreadsheet tabs
- Registration cutoff date support
- Confirmation emails with payment instructions

## Project Structure

```
src/
  Code.gs          — main server-side logic (routing, CRUD, email)
  Config.gs        — reads configuration from spreadsheet tabs
  Stripe.gs        — Stripe fee calculation and webhook handling
  Index.html       — multi-step registration form
  Status.html      — registration lookup and edit page
  Confirm.html     — post-registration confirmation
```

## Google Sheet Tabs

| Tab | Purpose |
|-----|---------|
| Config | Event name, dates, cutoff, contacts, Stripe link |
| Meals | Meal events, options, and prices |
| Pricing | Registration fee, raffle ticket price, donation tiers |
| Registrations | One row per registrant |
| Guests | One row per guest, linked by registration ID |
| Payments | Payment records (auto from Stripe, manual for Zelle/check) |

## Setup

1. Install [clasp](https://github.com/google/clasp): `npm install -g @google/clasp`
2. Authenticate: `clasp login`
3. Create a new Google Sheet for the conference
4. Create an Apps Script project bound to the sheet: `clasp create --type sheets --parentId <SHEET_ID>`
5. Push the code: `clasp push`
6. Deploy as a web app: In the Apps Script editor, Deploy > New deployment > Web app
7. Set "Execute as" to your account and "Who has access" to "Anyone"

## Year-to-Year Updates

Most changes only require editing the Google Sheet tabs:
- **Meals tab**: Update meal names, events, and prices
- **Pricing tab**: Update registration fee, raffle price, donation tiers
- **Config tab**: Update event name, dates, cutoff date, Stripe payment link, contacts
