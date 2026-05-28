// Jest setup file — mocks Google Apps Script globals

// Mock config constants
global.useLabel = false;
global.labelFilter = [];
global.upcomingBirthdaysDays = 7;
global.maxContactsPerReport = 0;
global.includeEditLinks = true;
global.includeWhatsAppLinks = true;
global.minPhoneLength = 7;
global.maxNameLength = 50;
global.phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/;
global.apiPageSize = 100;
global.apiMaxRetries = 3;
global.apiPersonFields = 'names,birthdays,memberships,emailAddresses,phoneNumbers,addresses,biographies';
global.verboseLogging = false;
global.dryRun = false;
global.emailSubjects = {};
global.enabledReports = {
  upcomingBirthdays: true,
  duplicates: true,
  contactOverview: true,
  labelOverview: true,
  missingInfo: true,
  dataQuality: true,
};
global.missingInfoFields = ['email', 'phone', 'birthday'];
global.duplicateMatchFields = ['name', 'email', 'phone'];
global.birthdayShowAge = true;
global.birthdayFormat = 'dd.MM.';
global.sortContactsBy = 'name';
global.excludeLabels = [];
global.scheduleHour = 8;
global.birthdaySchedule = 'daily';
global.weeklyReportDay = 2; // MONDAY
global.monthlyOverview = true;

// Mock Logger
global.Logger = {
  log: jest.fn()
};

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
  getActiveUser: jest.fn().mockReturnValue({
    getEmail: jest.fn().mockReturnValue('test@example.com')
  }),
  getEffectiveUser: jest.fn().mockReturnValue({
    getEmail: jest.fn().mockReturnValue('test@example.com')
  })
};

// Mock DriveApp
global.DriveApp = {
  getFileById: jest.fn().mockReturnValue({
    getName: jest.fn().mockReturnValue('Google Contacts Scripts')
  })
};

// Mock ScriptApp
global.ScriptApp = {
  getScriptId: jest.fn().mockReturnValue('test-script-id'),
  getProjectTriggers: jest.fn().mockReturnValue([]),
  newTrigger: jest.fn().mockReturnValue({
    timeBased: jest.fn().mockReturnValue({
      onWeekDay: jest.fn().mockReturnThis(),
      onMonthDay: jest.fn().mockReturnThis(),
      everyDays: jest.fn().mockReturnThis(),
      atHour: jest.fn().mockReturnThis(),
      create: jest.fn()
    })
  }),
  deleteTrigger: jest.fn(),
  WeekDay: {
    SUNDAY: 1, MONDAY: 2, TUESDAY: 3, WEDNESDAY: 4,
    THURSDAY: 5, FRIDAY: 6, SATURDAY: 7
  }
};

// Mock People API
global.People = {
  People: {
    Connections: { list: jest.fn() },
    getBatchGet: jest.fn()
  },
  ContactGroups: {
    list: jest.fn(),
    batchGet: jest.fn(),
    create: jest.fn()
  }
};

// Mock Gmail API
global.Gmail = {
  Users: {
    Messages: { send: jest.fn() }
  }
};

// Load source files into global scope (mimics Google Apps Script runtime)
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');
const loadOrder = [
  'config.js',
  '_setup.js',
  'utils.js',
  'contact.js',
  'label_manager.js',
  'contact_manager.js',
  'email_manager.js',
  'main.js'
];

loadOrder.forEach(file => {
  const filePath = path.join(srcDir, file);
  if (fs.existsSync(filePath)) {
    let code = fs.readFileSync(filePath, 'utf8');
    // Replace const/let with var so they don't throw on redeclaration
    code = code.replace(/^const /gm, 'var ');
    code = code.replace(/^let /gm, 'var ');
    // Assign class declarations to global
    code = code.replace(/^class (\w+)/gm, 'global.$1 = class $1');
    // Assign function declarations to global
    code = code.replace(/^function (\w+)/gm, 'global.$1 = function $1');
    const fn = new Function(code);
    fn();
  }
});
