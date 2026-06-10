describe('validateConfig', () => {
  let origGeneral, origReports, origActions;

  beforeEach(() => {
    origGeneral = { ...global.generalConfig };
    origReports = JSON.parse(JSON.stringify(global.reports));
    origActions = JSON.parse(JSON.stringify(global.actions));
  });

  afterEach(() => {
    Object.assign(global.generalConfig, origGeneral);
    Object.keys(origReports).forEach(k => { global.reports[k] = origReports[k]; });
    Object.keys(origActions).forEach(k => { global.actions[k] = origActions[k]; });
  });

  test('returns no errors for valid default config', () => {
    const errors = validateConfig();
    expect(errors).toHaveLength(0);
  });

  test('catches invalid birthdayFormat', () => {
    global.generalConfig.birthdayFormat = 'YYYY-MM-DD';
    expect(validateConfig()).toContainEqual(expect.stringContaining('birthdayFormat'));
  });

  test('catches invalid sortContactsBy', () => {
    global.generalConfig.sortContactsBy = 'invalid';
    expect(validateConfig()).toContainEqual(expect.stringContaining('sortContactsBy'));
  });

  test('catches useLabel without labelFilter', () => {
    global.generalConfig.useLabel = true;
    global.generalConfig.labelFilter = [];
    expect(validateConfig()).toContainEqual(expect.stringContaining('labelFilter is empty'));
  });

  test('catches invalid report schedule', () => {
    global.reports.duplicates.schedule = 'biweekly';
    expect(validateConfig()).toContainEqual(expect.stringContaining('reports.duplicates.schedule'));
  });

  test('catches invalid action day', () => {
    global.actions.autoLabeling.day = 35;
    expect(validateConfig()).toContainEqual(expect.stringContaining('actions.autoLabeling.day'));
  });

  test('catches invalid missingInfo fields', () => {
    global.reports.missingInfo.fields = ['email', 'invalid'];
    expect(validateConfig()).toContainEqual(expect.stringContaining('invalid'));
  });
});


describe('isLabelFilterConfigured', () => {
  let originals;

  beforeEach(() => {
    originals = { useLabel: global.generalConfig.useLabel, labelFilter: global.generalConfig.labelFilter };
  });

  afterEach(() => {
    global.generalConfig.useLabel = originals.useLabel;
    global.generalConfig.labelFilter = originals.labelFilter;
  });

  test('returns true when useLabel is false', () => {
    global.generalConfig.useLabel = false;
    expect(isLabelFilterConfigured()).toBe(true);
  });

  test('returns false when useLabel is true but filter is empty', () => {
    global.generalConfig.useLabel = true;
    global.generalConfig.labelFilter = [];
    expect(isLabelFilterConfigured()).toBe(false);
  });

  test('returns true when useLabel is true and filter has values', () => {
    global.generalConfig.useLabel = true;
    global.generalConfig.labelFilter = ['Friends'];
    expect(isLabelFilterConfigured()).toBe(true);
  });
});


describe('isReportEnabled', () => {
  test('returns true for reports with a schedule', () => {
    global.reports.upcomingBirthdays.schedule = 'weekly';
    expect(isReportEnabled('upcomingBirthdays')).toBe(true);
    global.reports.upcomingBirthdays.schedule = 'off';
  });

  test('returns false for reports set to off', () => {
    expect(isReportEnabled('upcomingBirthdays')).toBe(false);
  });

  test('returns false for unknown reports', () => {
    expect(isReportEnabled('nonexistent')).toBe(false);
  });
});


describe('applyLimit', () => {
  const contacts = [
    new Contact('A', null),
    new Contact('B', null),
    new Contact('C', null),
    new Contact('D', null),
    new Contact('E', null),
  ];

  test('returns all contacts when limit is 0', () => {
    expect(applyLimit(contacts)).toHaveLength(5);
  });

  test('caps contacts when limit is set', () => {
    const original = global.generalConfig.maxContactsPerReport;
    global.generalConfig.maxContactsPerReport = 3;
    expect(applyLimit(contacts)).toHaveLength(3);
    global.generalConfig.maxContactsPerReport = original;
  });

  test('returns all when list is shorter than limit', () => {
    const original = global.generalConfig.maxContactsPerReport;
    global.generalConfig.maxContactsPerReport = 10;
    expect(applyLimit(contacts)).toHaveLength(5);
    global.generalConfig.maxContactsPerReport = original;
  });

  test('sets _totalBeforeLimit metadata when truncated', () => {
    const original = global.generalConfig.maxContactsPerReport;
    global.generalConfig.maxContactsPerReport = 3;
    const result = applyLimit(contacts);
    expect(result._totalBeforeLimit).toBe(5);
    global.generalConfig.maxContactsPerReport = original;
  });

  test('does not set _totalBeforeLimit when not truncated', () => {
    const result = applyLimit(contacts);
    expect(result._totalBeforeLimit).toBeUndefined();
  });
});


describe('applySorting', () => {
  const contacts = [
    new Contact('Charlie', null, ['A', 'B'], '', 'Munich'),
    new Contact('Alice', null, ['A'], '', 'Berlin'),
    new Contact('Bob', null, [], '', 'Zurich'),
  ];

  test('sorts by name ascending (default)', () => {
    const result = applySorting(contacts);
    expect(result.map(c => c.getName())).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  test('sorts by name descending', () => {
    const original = global.generalConfig.sortContactsBy;
    global.generalConfig.sortContactsBy = 'name-desc';
    const result = applySorting(contacts);
    expect(result.map(c => c.getName())).toEqual(['Charlie', 'Bob', 'Alice']);
    global.generalConfig.sortContactsBy = original;
  });

  test('sorts by label count', () => {
    const original = global.generalConfig.sortContactsBy;
    global.generalConfig.sortContactsBy = 'labels';
    const result = applySorting(contacts);
    expect(result[0].getName()).toBe('Charlie'); // 2 labels
    expect(result[2].getName()).toBe('Bob');     // 0 labels
    global.generalConfig.sortContactsBy = original;
  });

  test('sorts by city', () => {
    const original = global.generalConfig.sortContactsBy;
    global.generalConfig.sortContactsBy = 'city';
    const result = applySorting(contacts);
    expect(result.map(c => c.city)).toEqual(['Berlin', 'Munich', 'Zurich']);
    global.generalConfig.sortContactsBy = original;
  });

  test('does not mutate original array', () => {
    const result = applySorting(contacts);
    expect(result).not.toBe(contacts);
    expect(contacts[0].getName()).toBe('Charlie'); // unchanged
  });
});


describe('applyExcludeLabels', () => {
  const contacts = [
    new Contact('Keep', null, ['Friends']),
    new Contact('Exclude', null, ['Blocked']),
    new Contact('Also Keep', null, ['Work', 'Friends']),
    new Contact('Also Exclude', null, ['Friends', 'Spam']),
  ];

  test('returns all when excludeLabels is empty', () => {
    expect(applyExcludeLabels(contacts)).toHaveLength(4);
  });

  test('filters out contacts with excluded labels', () => {
    const original = global.generalConfig.excludeLabels;
    global.generalConfig.excludeLabels = ['Blocked', 'Spam'];
    const result = applyExcludeLabels(contacts);
    expect(result).toHaveLength(2);
    expect(result.map(c => c.getName())).toEqual(['Keep', 'Also Keep']);
    global.generalConfig.excludeLabels = original;
  });
});


describe('prepareContacts', () => {
  test('applies exclude, sort, and limit in order', () => {
    const origSort = global.generalConfig.sortContactsBy;
    const origMax = global.generalConfig.maxContactsPerReport;
    const origExclude = global.generalConfig.excludeLabels;
    global.generalConfig.sortContactsBy = 'name';
    global.generalConfig.maxContactsPerReport = 2;
    global.generalConfig.excludeLabels = ['Spam'];

    const contacts = [
      new Contact('Charlie', null, []),
      new Contact('Alice', null, []),
      new Contact('Bob', null, ['Spam']),
      new Contact('Dave', null, []),
    ];

    const result = prepareContacts(contacts);
    expect(result).toHaveLength(2);
    expect(result[0].getName()).toBe('Alice');
    expect(result[1].getName()).toBe('Charlie');

    global.generalConfig.sortContactsBy = origSort;
    global.generalConfig.maxContactsPerReport = origMax;
    global.generalConfig.excludeLabels = origExclude;
  });
});


describe('shouldRunWeekly', () => {
  test('returns true when today matches the configured day', () => {
    const todayDay = new Date().getDay() + 1; // 1=Sunday, 2=Monday, etc.
    expect(shouldRunWeekly(todayDay)).toBe(true);
  });

  test('returns false when today does not match', () => {
    const todayDay = new Date().getDay() + 1;
    const otherDay = todayDay === 7 ? 1 : todayDay + 1;
    expect(shouldRunWeekly(otherDay)).toBe(false);
  });

  test('defaults to Monday (2) when no day provided', () => {
    const todayDay = new Date().getDay() + 1;
    if (todayDay === 2) {
      expect(shouldRunWeekly()).toBe(true);
    } else {
      expect(shouldRunWeekly()).toBe(false);
    }
  });
});


describe('cfg / reportCfg / actionCfg helpers', () => {
  test('cfg returns generalConfig values', () => {
    expect(cfg().sortContactsBy).toBe('name');
    expect(cfg().includeEditLinks).toBe(true);
    expect(cfg().maxContactsPerReport).toBe(0);
  });

  test('reportCfg returns report config by name', () => {
    expect(reportCfg('upcomingBirthdays').aheadDays).toBe(14);
    expect(reportCfg('duplicates').matchFields).toEqual(['name', 'email', 'phone']);
  });

  test('reportCfg returns empty object for unknown report', () => {
    expect(reportCfg('nonexistent')).toEqual({});
  });

  test('actionCfg returns action config by name', () => {
    expect(actionCfg('phoneNormalizer').defaultCountryCode).toBe('+49');
    expect(actionCfg('nameFormatter').swapLastFirst).toBe(false);
  });

  test('actionCfg returns empty object for unknown action', () => {
    expect(actionCfg('nonexistent')).toEqual({});
  });
});


describe('dailyRun scheduling logic', () => {
  let origReports, origActions, origFetch;

  beforeEach(() => {
    origReports = global.reports;
    origActions = global.actions;
    origFetch = global.fetchContacts;
    global.fetchContacts = jest.fn().mockReturnValue([]);
  });

  afterEach(() => {
    global.reports = origReports;
    global.actions = origActions;
    global.fetchContacts = origFetch;
  });

  test('runs daily-scheduled reports every day', () => {
    global.reports = {
      ...origReports,
      contactOverview: { schedule: 'daily', day: 1, emailSubject: 'test' },
    };
    // Should not throw — runs successfully
    expect(() => dailyRun()).not.toThrow();
  });

  test('skips monthly reports when today is not their day', () => {
    const today = new Date().getDate();
    const otherDay = today === 28 ? 1 : today + 1;
    global.reports = {
      ...origReports,
      contactOverview: { schedule: 'monthly', day: otherDay, emailSubject: 'test' },
    };
    dailyRun();
    // fetchContacts is called but no report function runs (no errors = skipped correctly)
    expect(Logger.log).toHaveBeenCalledWith(expect.stringContaining('Daily check done: 0 successful'));
  });

  test('runs monthly reports when today matches their day', () => {
    const today = new Date().getDate();
    global.reports = {
      ...origReports,
      contactOverview: { schedule: 'monthly', day: today, emailSubject: 'test' },
    };
    dailyRun();
    expect(Logger.log).toHaveBeenCalledWith(expect.stringContaining('1 successful'));
  });

  test('skips actions set to off', () => {
    global.actions = {
      ...origActions,
      autoLabeling: { ...origActions.autoLabeling, schedule: 'off' },
    };
    dailyRun();
    expect(Logger.log).toHaveBeenCalledWith(expect.stringContaining('0 successful'));
  });
});
