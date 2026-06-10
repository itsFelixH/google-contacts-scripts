# Google Contacts Scripts

A Google Apps Script that audits your Google Contacts and sends you email reports about data quality, upcoming birthdays, duplicates, and more.

Reports are sent to yourself — think of it as a personal contacts health check that runs on autopilot.

## Reports

| Report | What it tells you |
|--------|-------------------|
| 🎂 **Upcoming Birthdays** | Who has a birthday in the next N days, with age countdown |
| 🔍 **Duplicate Contacts** | Groups of contacts that look like duplicates (by name, email, or phone) |
| 📊 **Contact Overview** | Stats dashboard — completeness, top cities, birthday distribution |
| 🏷️ **Label Overview** | Label distribution, most/least used labels, and unlabeled contacts |
| 📋 **Missing Info** | Contacts missing email, phone, city, or birthday |
| 🔧 **Data Quality** | Missing surnames, invalid phones, shared numbers, empty contacts, formatting issues |

## Actions

| Action | What it does |
|--------|-------------|
| 🏷️ **Auto-Labeling** | Assign labels based on rules (email domain, city, name patterns, regex) |
| ✏️ **Name Formatter** | Fix capitalization, trim spaces, swap "Last, First" format |
| 📱 **Phone Normalizer** | Convert local numbers to international format with consistent spacing |
| 📸 **Instagram → Website** | Convert @handles in notes to clickable website fields |
| 💬 **Messenger → Website** | Convert FB/Messenger usernames in notes to m.me website fields |

All actions support `dryRun` mode — preview changes without modifying contacts.

> 💡 Looking for automatic birthday calendar events? Check out [birthday-calendar-sync](https://github.com/itsFelixH/birthday-calendar-sync).

## Setup

### 1. Create the Apps Script project

- Go to [script.google.com](https://script.google.com) and create a new project
- Or use `clasp` to push from this repo (see [Local development](#local-development))

### 2. Enable required services

In the Apps Script editor, go to **Services** (+ icon) and enable:
- **People API** (v1)
- **Gmail API** (v1)

### 3. Configure

Copy `src/config.js.template` to `src/config.js` and adjust the settings.

### 4. Set up schedules

Run `setupSchedules()` once from the Apps Script editor. It creates a single daily trigger that runs reports and actions on their configured days.

Re-run `setupSchedules()` any time you change schedules. It cleanly replaces existing triggers.

### 5. Authorize

The first run will ask for permissions. The script needs access to:
- Your contacts (read + write for actions)
- Gmail (to send yourself reports)
- Drive (to read the script's own name for the sender field)

## Configuration

All options live in `src/config.js`. The config has three sections:

### 1. General settings

```js
const generalConfig = {
  useLabel: false,                    // only report on contacts with specific labels
  labelFilter: [],                    // e.g. ['Friends', 'Family']
  excludeLabels: [],                  // always exclude from all reports

  sortContactsBy: 'name',            // 'name' | 'name-desc' | 'labels' | 'city'
  maxContactsPerReport: 0,           // 0 = unlimited
  includeEditLinks: true,            // add "edit" links in emails
  includeWhatsAppLinks: false,       // add WhatsApp links next to phone numbers
  birthdayFormat: 'dd.MM.',          // 'dd.MM.' | 'dd/MM' | 'MM/dd' | 'dd MMM' | 'MMM dd'
};
```

### 2. Reports

Each report has its own config block with schedule, email subject, and report-specific settings:

```js
const reports = {
  upcomingBirthdays: {
    schedule: 'weekly',               // 'daily' | 'weekly' | 'monthly' | 'off'
    day: 2,                           // 1–7 for weekly (1=Sun, 2=Mon, ..., 7=Sat)
    emailSubject: '🎂 Upcoming Birthdays',
    aheadDays: 14,                    // days to look ahead (1–365)
    showAge: true,
  },

  duplicates: {
    schedule: 'monthly',
    day: 1,                           // 1–28 for monthly (day of month)
    emailSubject: '🔍 Duplicate Contacts',
    matchFields: ['name', 'email', 'phone'],
  },

  contactOverview: {
    schedule: 'monthly',
    day: 1,
    emailSubject: '📊 Contact Overview',
  },

  labelOverview: {
    schedule: 'monthly',
    day: 1,
    emailSubject: '🏷️ Label Overview',
  },

  missingInfo: {
    schedule: 'monthly',
    day: 1,
    emailSubject: '📋 Missing Info',
    fields: ['email', 'phone', 'birthday', 'city'],
  },

  dataQuality: {
    schedule: 'monthly',
    day: 1,
    emailSubject: '🔧 Data Quality',
    phoneRegex: /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/,
  },
};
```

### 3. Actions

Each action has schedule, dry run, and action-specific settings in one block:

```js
const actions = {
  autoLabeling: {
    schedule: 'monthly',
    day: 1,
    dryRun: false,                    // true = preview only, no changes
    sendReport: true,                 // send summary email
    emailSubject: '🏷️ Auto-Labeling Summary',
    rules: [
      { field: 'email', contains: '@company.com', label: 'Work' },
      { field: 'city',  equals: 'berlin',         label: '📍 Berlin' },
      { field: 'name',  matches: '\\(swing\\)',   label: 'Swing' },
    ],
  },

  nameFormatter: {
    schedule: 'monthly',
    day: 5,
    dryRun: false,
    sendReport: true,
    emailSubject: '✏️ Name Formatter Summary',
    swapLastFirst: true,              // "Last, First" → "First Last"
  },

  phoneNormalizer: {
    schedule: 'monthly',
    day: 10,
    dryRun: true,                     // preview first!
    sendReport: true,
    emailSubject: '📱 Phone Normalizer Summary',
    defaultCountryCode: '+49',
    phoneRegex: /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/,
  },

  instagramToWebsite: {
    schedule: 'monthly',
    day: 15,
    dryRun: false,
    sendReport: true,
    emailSubject: '📸 Instagram → Website Summary',
  },

  messengerToWebsite: {
    schedule: 'monthly',
    day: 15,
    dryRun: false,
    sendReport: true,
    emailSubject: '💬 Messenger → Website Summary',
  },
};
```

### Schedule system

A single daily trigger handles all schedules:
- `'daily'` — runs every day
- `'weekly'` — runs on the configured `day` (1=Sunday, 2=Monday, ..., 7=Saturday)
- `'monthly'` — runs on the configured `day` (1–28, day of month)
- `'off'` — disabled

Actions are spread across different days to avoid API quota limits.

### Auto-labeling rules

Rule conditions: `contains`, `equals`, `startsWith`, `endsWith`, `matches` (regex).
All case-insensitive. Fields: `email`, `phone`, `city`, `name`.

## Running manually

You can run any report or action from the Apps Script editor:

**Reports:**
- `sendUpcomingBirthdaysReport()` — or pass days: `sendUpcomingBirthdaysReport(14)`
- `sendDuplicateContactsReport()`
- `sendContactOverviewReport()`
- `sendLabelOverviewReport()`
- `sendMissingInfoReport()`
- `sendDataQualityReport()`
- `sendAllReports()` — runs all enabled reports

**Actions:**
- `runAutoLabeling()`
- `runNameFormatter()`
- `runPhoneNormalizer()`
- `runInstagramToWebsite()`
- `runMessengerToWebsite()`

**Utility:**
- `setupSchedules()` — create/update triggers
- `removeSchedules()` — remove all managed triggers
- `validateConfig()` — check config for errors
- `testContacts()` — fetch and log all contact names
- `testLabels()` — fetch and log all labels
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
├── actions.js         # Contact actions (auto-label, name format, phone normalize, social → website)
├── config.js          # Your config (not committed)
├── config.js.template # Config template with all options documented
├── contact.js         # Contact class
├── contact_manager.js # Fetching, filtering, and querying contacts
├── email_manager.js   # Email formatting and sending
├── label_manager.js   # Label fetching and lookup
├── main.js            # Report and action entry points + scheduling
└── utils.js           # Config helpers and contact list processing
```

## License

MIT
