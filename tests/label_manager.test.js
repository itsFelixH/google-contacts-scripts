describe('LabelManager', () => {
  beforeEach(() => {
    // Mock People API for label operations
    People.ContactGroups.list.mockReturnValue({
      contactGroups: [
        { resourceName: 'contactGroups/123' },
        { resourceName: 'contactGroups/456' },
        { resourceName: 'contactGroups/789' }
      ]
    });

    People.ContactGroups.batchGet.mockReturnValue({
      responses: [
        { contactGroup: { resourceName: 'contactGroups/123', name: 'Friends' } },
        { contactGroup: { resourceName: 'contactGroups/456', name: 'Work' } },
        { contactGroup: { resourceName: 'contactGroups/789', name: 'Family' } }
      ]
    });
  });

  test('initializes with labels from API', () => {
    const manager = new LabelManager();
    expect(manager.labels).toHaveLength(3);
    expect(manager.labels[0].name).toBe('Friends');
  });

  test('getLabelNameById returns correct name', () => {
    const manager = new LabelManager();
    expect(manager.getLabelNameById('contactGroups/123')).toBe('Friends');
    expect(manager.getLabelNameById('123')).toBe('Friends');
  });

  test('getLabelNameById returns null for unknown IDs', () => {
    const manager = new LabelManager();
    expect(manager.getLabelNameById('invalid')).toBeNull();
  });

  test('getLabelNameById returns null for system labels', () => {
    const manager = new LabelManager();
    expect(manager.getLabelNameById('myContacts')).toBeNull();
    expect(manager.getLabelNameById('starred')).toBeNull();
  });

  test('getLabelNamesByIds returns valid names only', () => {
    const manager = new LabelManager();
    const names = manager.getLabelNamesByIds(['contactGroups/123', 'contactGroups/456', 'invalid']);
    expect(names).toEqual(['Friends', 'Work']);
  });

  test('labelExistsById checks correctly', () => {
    const manager = new LabelManager();
    expect(manager.labelExistsById('contactGroups/123')).toBe(true);
    expect(manager.labelExistsById('123')).toBe(true);
    expect(manager.labelExistsById('invalid')).toBe(false);
  });

  test('labelExistsByName checks correctly', () => {
    const manager = new LabelManager();
    expect(manager.labelExistsByName('Friends')).toBe(true);
    expect(manager.labelExistsByName('NonExistent')).toBe(false);
  });

  test('addLabel creates and stores new label', () => {
    People.ContactGroups.create.mockReturnValue({
      resourceName: 'contactGroups/new',
      name: 'New Group'
    });

    const manager = new LabelManager();
    const newLabel = manager.addLabel('New Group');

    expect(newLabel).not.toBeNull();
    expect(newLabel.name).toBe('New Group');
    expect(manager.labelExistsByName('New Group')).toBe(true);
    expect(manager.labels).toHaveLength(4);
  });

  test('handles API errors gracefully', () => {
    People.ContactGroups.list.mockImplementation(() => { throw new Error('API Error'); });

    const manager = new LabelManager();
    expect(manager.labels).toEqual([]);
  });
});
