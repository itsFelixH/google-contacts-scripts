// Jest setup file — mocks Google Apps Script globals

// New unified config
global.generalConfig = {
  useLabel: false,
  labelFilter: [],
  excludeLabels: [],
  sortContactsBy: 'name',
  maxContactsPerReport: 0,
  includeEditLinks: true,
  includeWhatsAppLinks: false,
  birthdayFormat: 'dd.MM.',
  scheduleHour: 8,
  weeklyDay: 'MONDAY',
  monthlyDay: 1,
};

global.reports = {
  upcomingBirthdays: { schedule: 'off', day: 2, emailSubject: '🎂 Upcoming Birthdays', aheadDays: 14, showAge: true },
  duplicates: { schedule: 'off', day: 1, emailSubject: '🔍 Duplicate Contacts', matchFields: ['name', 'email', 'phone'] },
  contactOverview: { schedule: 'off', day: 1, emailSubject: '📊 Contact Overview' },
  labelOverview: { schedule: 'off', day: 1, emailSubject: '🏷️ Label Overview' },
  missingInfo: { schedule: 'off', day: 1, emailSubject: '📋 Missing Info', fields: ['email', 'phone', 'birthday'] },
  dataQuality: { schedule: 'off', day: 1, emailSubject: '🔧 Data Quality', phoneRegex: /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/ },
};

global.actions = {
  autoLabeling: { schedule: 'off', day: 1, dryRun: false, sendReport: false, emailSubject: '🏷️ Auto-Labeling Summary', rules: [] },
  nameFormatter: { schedule: 'off', day: 5, dryRun: false, sendReport: false, emailSubject: '✏️ Name Formatter Summary', swapLastFirst: false },
  phoneNormalizer: { schedule: 'off', day: 10, dryRun: false, sendReport: false, emailSubject: '📱 Phone Normalizer Summary', defaultCountryCode: '+49', phoneRegex: /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/ },
  instagramToWebsite: { schedule: 'off', day: 15, dryRun: false, sendReport: false, emailSubject: '📸 Instagram → Website Summary' },
  messengerToWebsite: { schedule: 'off', day: 15, dryRun: false, sendReport: false, emailSubject: '💬 Messenger → Website Summary' },
};

// Legacy globals (for backward compatibility during transition)
global.useLabel = false;
global.labelFilter = [];
global.excludeLabels = [];
global.upcomingBirthdaysDays = 14;
global.maxContactsPerReport = 0;
global.includeEditLinks = true;
global.includeWhatsAppLinks = false;
global.phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/;
global.dryRun = false;
global.emailSubjects = {};
global.enabledReports = {
  upcomingBirthdays: true, duplicates: true, contactOverview: true,
  labelOverview: true, missingInfo: true, dataQuality: true,
};
global.missingInfoFields = ['email', 'phone', 'birthday'];
global.duplicateMatchFields = ['name', 'email', 'phone'];
global.birthdayShowAge = true;
global.birthdayFormat = 'dd.MM.';
global.sortContactsBy = 'name';
global.scheduleHour = 8;
global.weeklyReportDay = 2;
global.monthlyReportDay = 1;
global.reportSchedules = {
  upcomingBirthdays: 'off', duplicates: 'off', contactOverview: 'off',
  labelOverview: 'off', missingInfo: 'off', dataQuality: 'off',
};
global.actionSchedules = {
  autoLabeling: { frequency: 'off', day: 1 },
  nameFormatter: { frequency: 'off', day: 5 },
  phoneNormalizer: { frequency: 'off', day: 10 },
  instagramToWebsite: { frequency: 'off', day: 15 },
  messengerToWebsite: { frequency: 'off', day: 15 },
};
global.autoLabelConfig = global.actions.autoLabeling;
global.nameFormatterConfig = global.actions.nameFormatter;
global.phoneNormalizerConfig = global.actions.phoneNormalizer;
global.instagramToWebsiteConfig = global.actions.instagramToWebsite;
global.messengerToWebsiteConfig = global.actions.messengerToWebsite;
global.defaultCountryCode = '+49';
global.nameSwapLastFirst = false;
global.sendActionReports = false;
global.autoLabelRules = [];

// Mock Logger
global.Logger = { log: jest.fn() };

// Mock Utilities
global.Utilities = {
  formatDate: jest.fn((date, tz, format) => {
    if (format === 'dd.MM.') return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.`;
    if (format === 'dd.MM.yyyy') return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
    return '';
  }),
  base64Encode: jest.fn((str) => Buffer.from(String(str)).toString('base64')),
  base64EncodeWebSafe: jest.fn((str) => Buffer.from(String(str)).toString('base64url')),
  sleep: jest.fn(),
  Charset: { UTF_8: 'UTF-8' }
};

// Mock Session
global.Session = {
  getScriptTimeZone: jest.fn().mockReturnValue('UTC'),
  getActiveUser: jest.fn().mockReturnValue({ getEmail: jest.fn().mockReturnValue('test@example.com') }),
  getEffectiveUser: jest.fn().mockReturnValue({ getEmail: jest.fn().mockReturnValue('test@example.com') })
};

// Mock DriveApp
global.DriveApp = { getFileById: jest.fn().mockReturnValue({ getName: jest.fn().mockReturnValue('Google Contacts Scripts') }) };

// Mock ScriptApp
global.ScriptApp = {
  getScriptId: jest.fn().mockReturnValue('test-script-id'),
  getProjectTriggers: jest.fn().mockReturnValue([]),
  newTrigger: jest.fn().mockReturnValue({
    timeBased: jest.fn().mockReturnValue({
      onWeekDay: jest.fn().mockReturnThis(), onMonthDay: jest.fn().mockReturnThis(),
      everyDays: jest.fn().mockReturnThis(), atHour: jest.fn().mockReturnThis(), create: jest.fn()
    })
  }),
  deleteTrigger: jest.fn(),
  WeekDay: { SUNDAY: 1, MONDAY: 2, TUESDAY: 3, WEDNESDAY: 4, THURSDAY: 5, FRIDAY: 6, SATURDAY: 7 }
};

// Mock People API
global.People = {
  People: { Connections: { list: jest.fn() }, getBatchGet: jest.fn(), updateContact: jest.fn(), get: jest.fn() },
  ContactGroups: { list: jest.fn(), batchGet: jest.fn(), create: jest.fn(), Members: { modify: jest.fn() } }
};

// Mock Gmail API
global.Gmail = { Users: { Messages: { send: jest.fn() } } };

// Mock UrlFetchApp
global.UrlFetchApp = { fetch: jest.fn().mockReturnValue({ getResponseCode: jest.fn().mockReturnValue(200) }) };

// Load source files into global scope (mimics Google Apps Script runtime)
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');
const loadOrder = ['config.js', '_setup.js', 'utils.js', 'contact.js', 'label_manager.js', 'contact_manager.js', 'email_manager.js', 'actions.js', 'main.js'];

loadOrder.forEach(file => {
  const filePath = path.join(srcDir, file);
  if (fs.existsSync(filePath)) {
    let code = fs.readFileSync(filePath, 'utf8');
    code = code.replace(/^const /gm, 'var ');
    code = code.replace(/^let /gm, 'var ');
    code = code.replace(/^class (\w+)/gm, 'global.$1 = class $1');
    code = code.replace(/^function (\w+)/gm, 'global.$1 = function $1');
    const fn = new Function(code);
    fn();
  }
});
