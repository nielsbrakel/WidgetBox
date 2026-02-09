/**
 * BaseWidget - Shared helper for all Homey Widgets
 * Provides common functionality: settings, locale formatting, refresh scheduling
 */

class BaseWidget {
  constructor(options = {}) {
    this.options = {
      refreshInterval: 1000,
      ...options,
    };
    this.refreshTimer = null;
  }

  /**
   * Initialize widget settings from widget.compose.json defaults
   * @param {Object} settings - Settings definition from compose file
   * @returns {Object} Default settings object
   */
  initSettings(settings = {}) {
    const defaults = {};
    for (const [key, config] of Object.entries(settings)) {
      if (config.type === 'boolean') {
        defaults[key] = config.value ?? false;
      } else if (config.type === 'number') {
        defaults[key] = config.value ?? config.min ?? 0;
      } else if (config.type === 'dropdown') {
        defaults[key] = config.values?.[0]?.id ?? config.value ?? '';
      } else if (config.type === 'text') {
        defaults[key] = config.value ?? '';
      }
    }
    return defaults;
  }

  /**
   * Format date/time using Intl API with Homey locale
   * @param {Date} date - Date to format
   * @param {Object} options - Intl.DateTimeFormat options
   * @param {string} locale - BCP 47 language tag (e.g., 'en', 'nl')
   * @returns {string} Formatted string
   */
  formatLocaleDateTime(date, options = {}, locale = 'en-US') {
    try {
      const formatter = new Intl.DateTimeFormat(locale, options);
      return formatter.format(date);
    } catch (err) {
      console.error('LocaleDateTime format error:', err);
      return date.toString();
    }
  }

  /**
   * Format time with optional seconds
   * @param {Date} date - Date object
   * @param {boolean} showSeconds - Include seconds
   * @param {boolean} use12Hour - Use 12-hour format
   * @returns {string} HH:MM(:SS)
   */
  formatTime(date, showSeconds = false, use12Hour = false) {
    const options = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: use12Hour,
    };

    if (showSeconds) {
      options.second = '2-digit';
    }

    return this.formatLocaleDateTime(date, options, this.getLocale());
  }

  /**
   * Get Homey language/locale
   * Fallback to 'en' if not available
   * @returns {string} BCP 47 locale string
   */
  getLocale() {
    if (typeof window !== 'undefined' && window.Homey) {
      const lang = window.Homey.i18n?.getLanguage?.();
      if (lang) {
        // Map simple lang codes to full locale codes
        const localeMap = {
          en: 'en-US',
          nl: 'nl-NL',
          de: 'de-DE',
          fr: 'fr-FR',
        };
        return localeMap[lang] || `${lang}-${lang.toUpperCase()}`;
      }
    }
    return 'en-US';
  }

  /**
   * Schedule recurring refresh of widget content
   * @param {Function} callback - Function to call on each refresh
   * @param {number} interval - Interval in ms
   */
  scheduleRefresh(callback, interval = this.options.refreshInterval) {
    this.clearRefresh();
    callback(); // Run immediately
    this.refreshTimer = setInterval(callback, interval);
  }

  /**
   * Clear scheduled refresh
   */
  clearRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Load data with optional caching
   * @param {string} url - URL to fetch
   * @param {Object} options - fetch options
   * @returns {Promise<any>} Parsed JSON
   */
  async fetchData(url, options = {}) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (err) {
      console.error('Fetch error:', err);
      throw err;
    }
  }

  /**
   * Get local storage with namespace
   * @param {string} key - Storage key
   * @param {string} namespace - Widget namespace
   * @returns {any} Stored value or null
   */
  getStorage(key, namespace = 'default') {
    try {
      const data = localStorage.getItem(`${namespace}:${key}`);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.error('Storage get error:', err);
      return null;
    }
  }

  /**
   * Set local storage with namespace
   * @param {string} key - Storage key
   * @param {any} value - Value to store
   * @param {string} namespace - Widget namespace
   */
  setStorage(key, value, namespace = 'default') {
    try {
      localStorage.setItem(`${namespace}:${key}`, JSON.stringify(value));
    } catch (err) {
      console.error('Storage set error:', err);
    }
  }

  /**
   * Apply theme-aware styling (light/dark mode)
   * @param {HTMLElement} element - Element to apply theme to
   */
  applyTheme(element) {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (darkMode) {
        element.classList.add('homey-dark-mode');
      } else {
        element.classList.remove('homey-dark-mode');
      }
    }
  }

  /**
   * Parse setting value from data attribute or default
   * @param {HTMLElement} element - Element with data-* attributes
   * @param {string} attrName - Attribute name (without 'data-')
   * @param {any} defaultValue - Default value
   * @returns {any} Parsed value
   */
  getSetting(element, attrName, defaultValue) {
    const attr = element.dataset[attrName];
    if (attr === undefined) return defaultValue;
    if (attr === 'true') return true;
    if (attr === 'false') return false;
    if (!isNaN(attr)) return Number(attr);
    return attr;
  }

  /**
   * Destroy widget and cleanup
   */
  destroy() {
    this.clearRefresh();
  }
}

// Export for browser and Node
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BaseWidget;
}
