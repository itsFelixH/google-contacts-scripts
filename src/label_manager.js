/**
 * @fileoverview Label management via the Google People API.
 *
 * LabelManager fetches all contact groups (labels) on construction
 * and provides lookup methods to resolve IDs to human-readable names.
 */


/**
 * Manages contact labels (groups) from Google Contacts.
 *
 * Labels are fetched once on construction and cached in memory.
 * Use this class to resolve label IDs from contact memberships
 * into readable label names.
 */
class LabelManager {

  /**
   * Creates a LabelManager and immediately fetches all labels from the API.
   */
  constructor() {
    /** @type {{id: string, name: string}[]} All known labels */
    this.labels = this.fetchLabels();
  }


  // ─── API ────────────────────────────────────────────────────────────────────

  /**
   * Fetches all contact labels (groups) from the People API.
   * Uses batchGet for efficiency — one call to list, one to get details.
   *
   * @returns {{id: string, name: string}[]} Array of label objects
   */
  fetchLabels() {
    try {
      // First, get all group resource names
      const groupsResponse = People.ContactGroups.list();
      const resourceNames = groupsResponse.contactGroups.map(g => g.resourceName);

      // Then batch-fetch their details (name, etc.)
      const batchResponse = People.ContactGroups.batchGet({ resourceNames });

      return batchResponse.responses.map(r => ({
        id: r.contactGroup.resourceName,
        name: r.contactGroup.name
      }));
    } catch (error) {
      Logger.log(`Error fetching labels: ${error.message}`);
      return [];
    }
  }


  // ─── Lookup ─────────────────────────────────────────────────────────────────

  /**
   * Resolves a label ID to its human-readable name.
   * Returns null for system labels (myContacts, starred) and unknown IDs.
   *
   * @param {string} labelId The label/group ID (with or without 'contactGroups/' prefix)
   * @returns {string|null} Label name, or null if not found/system label
   */
  getLabelNameById(labelId) {
    // System labels are not user-created — skip them
    if (labelId === 'myContacts' || labelId === 'starred') return null;

    // Match with or without the 'contactGroups/' prefix
    const label = this.labels.find(
      l => l.id === labelId || l.id === `contactGroups/${labelId}`
    );

    return label ? label.name : null;
  }

  /**
   * Resolves multiple label IDs to names, filtering out unknowns.
   *
   * @param {string[]} labelIds Array of label IDs to resolve
   * @returns {string[]} Array of resolved label names (unknowns omitted)
   */
  getLabelNamesByIds(labelIds) {
    return labelIds
      .map(id => this.getLabelNameById(id))
      .filter(name => name !== null);
  }


  // ─── Existence checks ──────────────────────────────────────────────────────

  /**
   * Checks if a label exists by its ID.
   * @param {string} labelId Label ID to check
   * @returns {boolean}
   */
  labelExistsById(labelId) {
    return this.labels.some(
      l => l.id === labelId || l.id === `contactGroups/${labelId}`
    );
  }

  /**
   * Checks if a label exists by its name.
   * @param {string} labelName Label name to check
   * @returns {boolean}
   */
  labelExistsByName(labelName) {
    return this.labels.some(l => l.name === labelName);
  }


  // ─── Mutations ──────────────────────────────────────────────────────────────

  /**
   * Creates a new contact label (group) via the API.
   * Also adds it to the local cache.
   *
   * @param {string} name Name for the new label
   * @returns {{id: string, name: string}|null} The created label, or null on error
   */
  addLabel(name) {
    try {
      const created = People.ContactGroups.create({ contactGroup: { name } });
      const label = { id: created.resourceName, name: created.name };
      this.labels.push(label);
      return label;
    } catch (error) {
      Logger.log(`Error creating label: ${error.message}`);
      return null;
    }
  }


  // ─── Debug ──────────────────────────────────────────────────────────────────

  /**
   * Logs all label names to the Apps Script log.
   */
  logAllLabels() {
    this.labels.forEach(label => Logger.log(label.name));
  }
}
