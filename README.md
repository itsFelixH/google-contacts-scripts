# Google Contacts Scripts

A Google Apps Script that audits your Google Contacts and sends you email reports about data quality, upcoming birthdays, duplicates, and more.

Reports are sent to yourself — think of it as a personal contacts health check that runs on autopilot.

## Reports

| Report | What it tells you |
|--------|-------------------|
| 🎂 **Upcoming Birthdays** | Who has a birthday in the next N days, with age countdown |
| 🔍 **Duplicate Contacts** | Groups of contacts that look like duplicates (by name, email, or phone) |
| 📊 **Contact Overview** | Stats dashboard — % of contacts with email, phone, birthday, etc. |
| 🏷️ **Label Overview** | Label distribution, most/least used labels, and unlabeled contacts |
| 📋 **Missing Info** | Contacts missing email, phone, city, or birthday |
| 🔧 **Data Quality** | Contacts without surnames + invalid phone numbers |

All reports can be enabled/disabled individually. Empty reports are never sent.

> 💡 Looking for automatic birthday calendar events? Check out [birthday-calendar-sync](https://github.com/itsFelixH/birthday-calendar-sync).

## Example emails

Open the HTML files in [`examples/`](examples/) to see how each report looks in an email client:

- [`upcoming-birthdays.html`](examples/upcoming-birthdays.html) — Birthday countdown with age and contact details
- [`duplicate-contacts.html`](examples/duplicate-contacts.html) — Grouped duplicates with match reason
- [`contact-overview.html`](examples/contact-overview.html) — Stats dashboard
- [`label-overview.html`](examples/label-overview.html) — Label distribution + unlabeled contacts
- [`missing-info.html`](examples/missing-info.html) — Contacts missing a field (with edit links)
- [`data-quality.html`](examples/data-quality.html) — Missing surnames + invalid phones

Here's what the plain-text versions look like:

**🎂 Upcoming Birthdays**
```
🎂 Upcoming Birthdays (next 7 days)

  • Anna Schmidt (turns 30) — in 2 days
  • Max Müller — tomorrow
  • Lisa Weber (turns 25) — 🎂 TODAY!
```

**🔍 Duplicate Contacts**
```
🔍 Duplicate Contacts

  Group 1 (2): Max Müller, Max Mueller (name/email/phone match)
  Group 2 (3): Lisa W, Lisa Weber, Lisa W. (name/email/phone match)
```

**📊 Contact Overview**
```
📊 Contact Overview

📇 Total Contacts: 342
🎂 With Birthday: 280 (81.9%)
📧 With Email: 310 (90.6%)
📱 With Phone: 298 (87.1%)
🌆 With City: 195 (57.0%)
🏷️ With Labels: 320 (93.6%)
📸 With Instagram: 45 (13.2%)
```

**🏷️ Label Overview**
```
🏷️ Label Overview

🏷️ Total Labels: 8
👑 Most Used: Friends (142)
📉 Least Used: Neighbors (3)
❌ Unlabeled: 22

── Label Distribution ──

  🏷️ Friends: 142 (41.5%)
  🏷️ Family: 58 (17.0%)
  🏷️ Work: 45 (13.2%)
  ...

── Unlabeled Contacts ──

  • John Doe
  • Some Company
```

**🔧 Data Quality**
```
🔧 Data Quality

5 issues found

👤 Missing Surnames (3):
  • Felix
  • Anna
  • Max

📱 Invalid Phone Numbers (2):
  • Old Contact — abc123
  • Test Entry — 12
```

## Setup

### 1. Create the Apps Script project

- Go to [script.google.com](https://script.google.com) and create a new project
- Or use `clasp` to push from this repo (see [Local development](#local-development))

### 2. Enable required services

In the Apps Script editor, go to **Services** (+ icon) and enable:
- **People API** (v1)
- **Gmail API** (v1)

### 3. Configure

Copy `src/config.js.template` to `src/config.js` and adjust the settings:

```js
// Only report on contacts with these labels (or set useLabel = false for all)
const useLabel = false;
const labelFilter = []; // e.g. ['Friends', 'Family']

// Exclude contacts with these labels from all reports
const excludeLabels = []; // e.g. ['Blocked', 'Spam']

// How far ahead to look for birthdays
const upcomingBirthdaysDays = 7;

// When to send reports
const scheduleHour = 8;
const weeklyReportDay = ScriptApp.WeekDay.MONDAY;
```

### 4. Set up schedules

Run `setupSchedules()` once from the Apps Script editor. This creates individual triggers for each report:

**Weekly** (Monday by default):
- Upcoming Birthdays (covers next 14 days)
- Auto-labeling (if enabled)

**Monthly** (1st of each month):
- Duplicate Contacts
- Label Overview
- Missing Info
- Data Quality
- Contact Overview

Re-run `setupSchedules()` any time you change the schedule config. It cleanly replaces existing triggers.

### 5. Authorize

The first run will ask for permissions. The script needs access to:
- Your contacts (read-only)
- Gmail (to send yourself reports)
- Drive (to read the script's own name for the sender field)

## Configuration

All options live in `src/config.js`. Here's the full reference:

### Contact filtering

| Option | Default | Description |
|--------|---------|-------------|
| `useLabel` | `false` | Only include contacts with specific labels |
| `labelFilter` | `[]` | Labels to include (when `useLabel` is true) |
| `excludeLabels` | `[]` | Labels to always exclude from reports |

### Report settings

| Option | Default | Description |
|--------|---------|-------------|
| `enabledReports` | all `true` | Toggle individual reports on/off |
| `upcomingBirthdaysDays` | `7` | Days to look ahead for birthdays (1–365) |
| `birthdayShowAge` | `true` | Show "turns X" if birth year is known |
| `birthdayFormat` | `'dd.MM.'` | Date format (see options below) |
| `sortContactsBy` | `'name'` | How to sort contact lists in reports |
| `missingInfoFields` | `['email', 'phone', 'birthday']` | Fields to check in Missing Info report |
| `duplicateMatchFields` | `['name', 'email', 'phone']` | Fields to compare for duplicates |
| `maxContactsPerReport` | `0` | Cap list length (0 = unlimited) |
| `includeEditLinks` | `true` | Add Google Contacts "edit" links |
| `includeWhatsAppLinks` | `true` | Add WhatsApp links next to phone numbers |

### Birthday format options

| Format | Example |
|--------|---------|
| `'dd.MM.'` | 15.06. |
| `'dd/MM'` | 15/06 |
| `'MM/dd'` | 06/15 |
| `'dd MMM'` | 15 Jun |
| `'MMM dd'` | Jun 15 |

### Sort options

| Value | Sorts by |
|-------|----------|
| `'name'` | Name A→Z |
| `'name-desc'` | Name Z→A |
| `'labels'` | Most labels first |
| `'city'` | City A→Z |

### Schedules

```js
// What time of day to send reports (0–23)
const scheduleHour = 8;

// Which day for weekly reports (birthdays + auto-labeling)
const weeklyReportDay = ScriptApp.WeekDay.MONDAY;

// Which day of the month for monthly reports (1–28)
const monthlyReportDay = 1;

// Run auto-labeling weekly (set to true to enable)
const scheduleAutoLabeling = false;
```

This creates individual triggers:
- **Weekly**: Upcoming Birthdays + Auto-labeling (optional)
- **Monthly**: Duplicates, Label Overview, Missing Info, Data Quality, Contact Overview

You can also run `sendAllReports()` manually from the editor to fire everything at once.

### Email customization

Override default email subjects:

```js
const emailSubjects = {
  upcomingBirthdays: '🎂 Upcoming Birthdays',
  duplicates: '🔍 Duplicate Contacts',
  overview: '📊 Contact Overview',
  labelOverview: '🏷️ Label Overview',
  missingInfo: '📋 Missing Info: {field}',  // {field} is replaced with the field name
  dataQuality: '🔧 Data Quality',
};
```

### Advanced

| Option | Default | Description |
|--------|---------|-------------|
| `dryRun` | `false` | Preview mode — logs what would be sent/changed, no actual changes |
| `phoneRegex` | see template | Regex for valid phone numbers |

### Actions config

**Auto-labeling rules:**

```js
const autoLabelRules = [
  { field: 'email', contains: '@company.com', label: 'Work' },
  { field: 'city', equals: 'berlin', label: 'Berlin' },
  { field: 'email', endsWith: '.de', label: 'Germany' },
  { field: 'name', startsWith: 'dr.', label: 'Doctors' },
];
```

Rule conditions: `contains`, `equals`, `startsWith`, `endsWith` (all case-insensitive).
Fields: `email`, `phone`, `city`, `name`.

**Phone normalizer:**

```js
const defaultCountryCode = '+49';  // prepended when converting "0xxx" → "+49xxx"
```

**Action reports:**

```js
const sendActionReports = true;  // send summary email after each action (default: true)
```

## Running manually

You can run any report individually from the Apps Script editor:

- `sendUpcomingBirthdaysReport()` — or pass days: `sendUpcomingBirthdaysReport(14)`
- `sendDuplicateContactsReport()`
- `sendContactOverviewReport()`
- `sendLabelOverviewReport()`
- `sendMissingInfoReport('email')` — also: `'phone'`, `'city'`, `'birthday'`
- `sendDataQualityReport()`
- `sendAllReports()` — runs all enabled reports

### Actions (modify contacts)

These scripts write changes back to your contacts. Use `dryRun = true` to preview first.

- `runAutoLabeling()` — assign labels based on rules (email domain, city, name patterns)
- `runNameFormatter()` — fix capitalization, trim spaces, swap "Last, First" format
- `runPhoneNormalizer()` — convert local numbers to international format
- `runInstagramSync()` — check if stored Instagram handles still exist

### Utility functions

- `validateConfig()` — checks your config for errors and logs warnings
- `testContacts()` — fetches and logs all contact names
- `testLabels()` — fetches and logs all labels
- `getHealthStatus()` — returns contact/label counts and response time

## Local development

This project uses [clasp](https://github.com/google/clasp) for local development and deployment.

```bash
# Install dependencies
pnpm install

# Set up clasp
cp .clasp.json.template .clasp.json
# Edit .clasp.json and add your script ID

# Push to Apps Script
pnpm run deploy   # runs tests first, then pushes

# Run tests locally
pnpm test
```

### Project structure

```
src/
├── _setup.js          # Schedule management (setupSchedules, removeSchedules)
├── actions.js         # Contact actions (auto-label, name format, phone normalize, Instagram sync)
├── config.js          # Your config (not committed)
├── config.js.template # Config template with all options documented
├── contact.js         # Contact class
├── contact_manager.js # Fetching, filtering, and querying contacts
├── email_manager.js   # Email formatting and sending
├── label_manager.js   # Label fetching and lookup
├── main.js            # Report entry points
└── utils.js           # Config validation and helper functions
```

## License

MIT
