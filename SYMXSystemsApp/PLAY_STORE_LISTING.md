# SYMX Systems Driver App — Google Play Store Listing Content

Copy-paste source for the Play Console "Store listing" and "App content"
sections. This app is an internal, restricted-access employment tool —
not available to the general public — so the listing copy says so
plainly, which also matters for the content rating and data safety
answers below.

---

## App details

**App name** (30 char max): `SYMX Systems`

**Short description** (80 char max):
```
Driver app for SYMX Systems: inspections, tasks, and safety alerts.
```
(68 characters)

**Full description** (4000 char max):
```
SYMX Systems is the internal driver app for SYMX Systems fleet operations. It is not available to the general public — access requires an employee badge number or email address issued by your employer.

WHAT YOU CAN DO
• Submit daily vehicle inspections with photos, right from your phone
• Complete your end-of-day checklist before you clock out
• Receive near-real-time safety alerts on your phone when a driving event is flagged by your vehicle's safety camera system, so you can hear and correct it right away
• See company notices relevant to your shift

WHO THIS IS FOR
This app is built exclusively for drivers and employees of SYMX Systems and its affiliated delivery stations. If you don't have a badge number or work email on file with SYMX Systems, this app has nothing for you to sign into.

PRIVACY
This app only collects information needed to do your job — see our privacy policy for full details: https://symx-systems.vercel.app/privacy
```
(1,048 characters)

**App category**: Business

**Tags** (optional, up to 5): fleet management, logistics, delivery driver, vehicle inspection, workforce

**Contact details**
- Email: rohan@coyoteclays.com
- Privacy policy URL: `https://symx-systems.vercel.app/privacy`
- Website (optional): `https://symx-systems.vercel.app`

---

## Graphics (Rohan needs to produce/upload these — Claude can't generate app screenshots of a running app)

| Asset | Requirement | Status |
|---|---|---|
| App icon | 512×512 PNG, already generated via `flutter_launcher_icons` from `assets/logo.png` | ✅ done in-app — just needs exporting/upload to Play Console's own 512×512 icon slot (separate from the APK's own icon) |
| Feature graphic | 1024×500 PNG/JPG, no text required but recommended | ❌ needs creating — a simple banner with the SYMX logo on brand colors (#0F172A background) works fine |
| Phone screenshots | 2–8 screenshots, 16:9 or 9:16, min 320px | ❌ needs capturing — take real screenshots of Login, Inspections, End-of-Day, and Notices screens on a phone or emulator |

---

## Content rating questionnaire (IARC)

Play Console asks this as a multi-step questionnaire, not free text — the
answers below are what the actual app does, so answer honestly using
these as reference:

- Violence: None
- Sexuality: None
- Language: None
- Controlled substances: None
- User-generated content shared publicly: No (inspection photos and
  checklist data are internal to the employer, never public-facing)
- Location sharing: No (this app does not request device location)
- Personal info shared with other users: No
- Digital purchases: No

Expected result: **Everyone** rating.

---

## Data safety section

This is the form at Play Console → App content → Data safety. Answer
per data type actually collected (see `app/privacy/page.tsx` for the
full plain-language version):

| Data type | Collected? | Purpose | Shared with third parties? | User can request deletion? |
|---|---|---|---|---|
| Name | Yes | App functionality, Account management | No | Yes (via employer/HR) |
| Email address | Yes | App functionality, Account management | No | Yes (via employer/HR) |
| Phone number | Yes | App functionality | No | Yes (via employer/HR) |
| Photos | Yes | App functionality (vehicle inspections, end-of-day tasks) | No | Yes (via employer/HR) |
| Device ID / push token | Yes | App functionality (delivering notifications) | Yes — Google Firebase Cloud Messaging (processes the token only to deliver the notification, doesn't use it for anything else) | Yes (cleared on logout / re-registration) |
| Precise or approximate location | No | — | — | — |
| Financial info | No | — | — | — |
| Health/fitness | No | — | — | — |

**Is all user data encrypted in transit?** Yes (HTTPS/TLS to
`symx-systems.vercel.app`).

**Does your app have a way for users to request data deletion?** Yes —
covered in the privacy policy: contact HR/manager (this is an
employment record, so deletion follows employment record retention
rules, same as e.g. a paper timesheet would).

---

## Target audience & content

- Target age group: 18+ (this is a workplace app for employed drivers)
- "Is your app designed for children": No

---

## App access (for Google's review team)

Since this app requires a real employee badge number / work email to
log in, the review team can't just download and explore it. Play
Console has an "App access" section for exactly this — provide:
- A note explaining it's an employee-only fleet operations app
- A test badge number/email Rohan is comfortable sharing for review
  purposes (create a dedicated reviewer test account rather than
  reusing a real driver's credentials)
