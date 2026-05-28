describe('validateConfig', () => {
  // Save and restore all globals that tests mutate
  let originals;

  beforeEach(() => {
    originals = {
      upcomingBirthdaysDays: global.upcomingBirthdaysDays,
      birthdayFormat: global.birthdayFormat,
      sortContactsBy: global.sortContactsBy,
      enabledReports: global.enabledReports,
      missingInfoFields: global.missingInfoFields,
      useLabel: global.useLabel,
      labelFilter: global.labelFilter,
    };
  });

  afterEach(() => {
    Object.assign(global, originals);
  });

  test('returns no errors for valid default config', () => {
    const errors = validateConfig();
    expect(errors).toHaveLength(0);
  });

  test('catches invalid upcomingBirthdaysDays', () => {
    global.upcomingBirthdaysDays = 0;
    expect(validateConfig()).toContainEqual(expect.stringContaining('upcomingBirthdaysDays'));
    global.upcomingBirthdaysDays = 400;
    expect(validateConfig()).toContainEqual(expect.stringContaining('upcomingBirthdaysDays'));
  });

  test('catches invalid birthdayFormat', () => {
    global.birthdayFormat = 'YYYY-MM-DD';
    expect(validateConfig()).toContainEqual(expect.stringContaining('birthdayFormat'));
  });

  test('catches invalid sortContactsBy', () => {
    global.sortContactsBy = 'invalid';
    expect(validateConfig()).toContainEqual(expect.stringContaining('sortContactsBy'));
  });

  test('catches invalid enabledReports keys', () => {
    global.enabledReports = { unknownReport: true };
    expect(validateConfig()).toContainEqual(expect.stringContaining('unknownReport'));
  });

  test('catches invalid missingInfoFields', () => {
    global.missingInfoFields = ['email', 'invalid'];
    expect(validateConfig()).toContainEqual(expect.stringContaining('invalid'));
  });

  test('catches useLabel without labelFilter', () => {
    global.useLabel = true;
    global.labelFilter = [];
    expect(validateConfig()).toContainEqual(expect.stringContaining('labelFilter is empty'));
  });
});


describe('isLabelFilterConfigured', () => {
  let originals;

  beforeEach(() => {
    originals = { useLabel: global.useLabel, labelFilter: global.labelFilter };
  });

  afterEach(() => {
    Object.assign(global, originals);
  });

  test('returns true when useLabel is false', () => {
    global.useLabel = false;
    expect(isLabelFilterConfigured()).toBe(true);
  });

  test('returns false when useLabel is true but filter is empty', () => {
    global.useLabel = true;
    global.labelFilter = [];
    expect(isLabelFilterConfigured()).toBe(false);
  });

  test('returns true when useLabel is true and filter has values', () => {
    global.useLabel = true;
    global.labelFilter = ['Friends'];
    expect(isLabelFilterConfigured()).toBe(true);
  });
});


describe('isReportEnabled', () => {
  test('returns true for enabled reports', () => {
    expect(isReportEnabled('upcomingBirthdays')).toBe(true);
    expect(isReportEnabled('duplicates')).toBe(true);
  });

  test('returns false for disabled reports', () => {
    const original = global.enabledReports;
    global.enabledReports = { upcomingBirthdays: false };
    expect(isReportEnabled('upcomingBirthdays')).toBe(false);
    global.enabledReports = original;
  });

  test('returns true when enabledReports is undefined', () => {
    const original = global.enabledReports;
    delete global.enabledReports;
    expect(isReportEnabled('anything')).toBe(true);
    global.enabledReports = original;
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
    const original = global.maxContactsPerReport;
    global.maxContactsPerReport = 3;
    expect(applyLimit(contacts)).toHaveLength(3);
    global.maxContactsPerReport = original;
  });

  test('returns all when list is shorter than limit', () => {
    const original = global.maxContactsPerReport;
    global.maxContactsPerReport = 10;
    expect(applyLimit(contacts)).toHaveLength(5);
    global.maxContactsPerReport = original;
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
    const original = global.sortContactsBy;
    global.sortContactsBy = 'name-desc';
    const result = applySorting(contacts);
    expect(result.map(c => c.getName())).toEqual(['Charlie', 'Bob', 'Alice']);
    global.sortContactsBy = original;
  });

  test('sorts by label count', () => {
    const original = global.sortContactsBy;
    global.sortContactsBy = 'labels';
    const result = applySorting(contacts);
    expect(result[0].getName()).toBe('Charlie'); // 2 labels
    expect(result[2].getName()).toBe('Bob');     // 0 labels
    global.sortContactsBy = original;
  });

  test('sorts by city', () => {
    const original = global.sortContactsBy;
    global.sortContactsBy = 'city';
    const result = applySorting(contacts);
    expect(result.map(c => c.city)).toEqual(['Berlin', 'Munich', 'Zurich']);
    global.sortContactsBy = original;
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
    const original = global.excludeLabels;
    global.excludeLabels = ['Blocked', 'Spam'];
    const result = applyExcludeLabels(contacts);
    expect(result).toHaveLength(2);
    expect(result.map(c => c.getName())).toEqual(['Keep', 'Also Keep']);
    global.excludeLabels = original;
  });
});


describe('prepareContacts', () => {
  test('applies exclude, sort, and limit in order', () => {
    const original = { sort: global.sortContactsBy, max: global.maxContactsPerReport, exclude: global.excludeLabels };
    global.sortContactsBy = 'name';
    global.maxContactsPerReport = 2;
    global.excludeLabels = ['Spam'];

    const contacts = [
      new Contact('Charlie', null, []),
      new Contact('Alice', null, []),
      new Contact('Bob', null, ['Spam']),
      new Contact('Dave', null, []),
    ];

    const result = prepareContacts(contacts);
    // Bob excluded (Spam), then sorted: Alice, Charlie, Dave, then limited to 2
    expect(result).toHaveLength(2);
    expect(result[0].getName()).toBe('Alice');
    expect(result[1].getName()).toBe('Charlie');

    global.sortContactsBy = original.sort;
    global.maxContactsPerReport = original.max;
    global.excludeLabels = original.exclude;
  });
});
