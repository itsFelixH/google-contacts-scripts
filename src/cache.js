/**
 * Simple caching utility using PropertiesService for Google Apps Script
 * @class Cache
 */
class Cache {
  /**
   * Cache expiration time in milliseconds (default: 1 hour)
   * @type {number}
   */
  static DEFAULT_TTL = 60 * 60 * 1000; // 1 hour

  /**
   * Gets cached data
   * @param {string} key - Cache key
   * @returns {*} Cached data or null if not found/expired
   */
  static get(key) {
    try {
      const cached = PropertiesService.getScriptProperties().getProperty(key);
      if (!cached) return null;

      const data = JSON.parse(cached);
      if (Date.now() > data.expires) {
        Cache.delete(key);
        return null;
      }

      return data.value;
    } catch (error) {
      Logger.log(`Cache get error for key ${key}: ${error.message}`);
      return null;
    }
  }

  /**
   * Sets cached data
   * @param {string} key - Cache key
   * @param {*} value - Data to cache
   * @param {number} [ttl] - Time to live in milliseconds
   */
  static set(key, value, ttl = Cache.DEFAULT_TTL) {
    try {
      const data = {
        value: value,
        expires: Date.now() + ttl,
        created: Date.now()
      };

      PropertiesService.getScriptProperties().setProperty(key, JSON.stringify(data));
    } catch (error) {
      Logger.log(`Cache set error for key ${key}: ${error.message}`);
    }
  }

  /**
   * Deletes cached data
   * @param {string} key - Cache key
   */
  static delete(key) {
    try {
      PropertiesService.getScriptProperties().deleteProperty(key);
    } catch (error) {
      Logger.log(`Cache delete error for key ${key}: ${error.message}`);
    }
  }

  /**
   * Clears all cached data
   */
  static clear() {
    try {
      PropertiesService.getScriptProperties().deleteAllProperties();
      Logger.log('Cache cleared');
    } catch (error) {
      Logger.log(`Cache clear error: ${error.message}`);
    }
  }

  /**
   * Gets cache statistics
   * @returns {Object} Cache statistics
   */
  static getStats() {
    try {
      const properties = PropertiesService.getScriptProperties().getProperties();
      const keys = Object.keys(properties);
      let validEntries = 0;
      let expiredEntries = 0;

      keys.forEach(key => {
        try {
          const data = JSON.parse(properties[key]);
          if (Date.now() > data.expires) {
            expiredEntries++;
          } else {
            validEntries++;
          }
        } catch (error) {
          // Invalid cache entry
        }
      });

      return {
        totalEntries: keys.length,
        validEntries,
        expiredEntries
      };
    } catch (error) {
      Logger.log(`Cache stats error: ${error.message}`);
      return { totalEntries: 0, validEntries: 0, expiredEntries: 0 };
    }
  }
}