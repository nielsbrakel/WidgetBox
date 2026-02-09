/**
 * TimerEngine - Shared timer/stopwatch logic
 * Handles multiple timers with start/stop/reset functionality
 */

class TimerEngine {
  constructor(options = {}) {
    this.timers = [];
    this.onUpdate = options.onUpdate || (() => {});
    this.onComplete = options.onComplete || (() => {});
    this.persistKey = options.persistKey || 'timers';
    this.autoRemoveFinished = options.autoRemoveFinished ?? false;
  }

  /**
   * Add a new timer
   * @param {number} duration - Duration in seconds
   * @param {string} label - Optional label for timer
   * @returns {string} Timer ID
   */
  addTimer(duration, label = '') {
    const id = `timer-${Date.now()}-${Math.random()}`;
    const timer = {
      id,
      duration,
      remaining: duration,
      label,
      isRunning: false,
      startTime: null,
      pausedTime: 0,
      laps: [],
    };
    this.timers.push(timer);
    this.onUpdate();
    return id;
  }

  /**
   * Remove timer by ID
   * @param {string} id - Timer ID
   */
  removeTimer(id) {
    this.timers = this.timers.filter(t => t.id !== id);
    this.onUpdate();
  }

  /**
   * Clear all timers
   */
  clearAll() {
    this.timers = [];
    this.onUpdate();
  }

  /**
   * Start/resume timer
   * @param {string} id - Timer ID
   */
  start(id) {
    const timer = this.getTimer(id);
    if (!timer) return;

    timer.isRunning = true;
    timer.startTime = Date.now() - (timer.duration - timer.remaining) * 1000;
    this.updateLoop();
  }

  /**
   * Stop/pause timer
   * @param {string} id - Timer ID
   */
  stop(id) {
    const timer = this.getTimer(id);
    if (!timer) return;

    timer.isRunning = false;
    this.onUpdate();
  }

  /**
   * Reset timer to original duration
   * @param {string} id - Timer ID
   */
  reset(id) {
    const timer = this.getTimer(id);
    if (!timer) return;

    timer.remaining = timer.duration;
    timer.isRunning = false;
    timer.startTime = null;
    timer.laps = [];
    this.onUpdate();
  }

  /**
   * Add lap time (for stopwatch)
   * @param {string} id - Timer ID
   * @returns {number} Lap time
   */
  addLap(id) {
    const timer = this.getTimer(id);
    if (!timer || !timer.isRunning) return null;

    const lapTime = timer.duration - timer.remaining;
    timer.laps.push({
      time: lapTime,
      timestamp: Date.now(),
    });
    this.onUpdate();
    return lapTime;
  }

  /**
   * Get timer by ID
   * @param {string} id - Timer ID
   * @returns {Object} Timer object
   */
  getTimer(id) {
    return this.timers.find(t => t.id === id);
  }

  /**
   * Get all timers
   * @returns {Array} Array of timers
   */
  getTimers() {
    return this.timers;
  }

  /**
   * Format seconds to HH:MM:SS
   * @param {number} seconds - Seconds
   * @param {boolean} showMillis - Include milliseconds
   * @returns {string} Formatted time
   */
  formatTime(seconds, showMillis = false) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 100);

    let result = '';
    if (hours > 0) {
      result += `${String(hours).padStart(2, '0')}:`;
    }
    result += `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    if (showMillis) {
      result += `.${String(millis).padStart(2, '0')}`;
    }

    return result;
  }

  /**
   * Internal update loop for running timers
   */
  updateLoop() {
    const runningTimers = this.timers.filter(t => t.isRunning);
    
    if (runningTimers.length === 0) return;

    const tick = () => {
      let anyRunning = false;

      runningTimers.forEach(timer => {
        if (!timer.isRunning) return;

        const elapsed = (Date.now() - timer.startTime) / 1000;
        timer.remaining = Math.max(0, timer.duration - elapsed);

        if (timer.remaining <= 0) {
          timer.remaining = 0;
          timer.isRunning = false;
          this.onComplete(timer.id);
          
          if (this.autoRemoveFinished) {
            this.removeTimer(timer.id);
          }
        } else {
          anyRunning = true;
        }
      });

      this.onUpdate();

      if (anyRunning) {
        requestAnimationFrame(tick);
      }
    };

    tick();
  }

  /**
   * Save timers to localStorage
   */
  save() {
    try {
      localStorage.setItem(this.persistKey, JSON.stringify(this.timers));
    } catch (err) {
      console.error('Failed to save timers:', err);
    }
  }

  /**
   * Load timers from localStorage
   */
  load() {
    try {
      const data = localStorage.getItem(this.persistKey);
      if (data) {
        this.timers = JSON.parse(data);
      }
    } catch (err) {
      console.error('Failed to load timers:', err);
    }
  }

  /**
   * Destroy engine and cleanup
   */
  destroy() {
    this.timers.forEach(t => {
      if (t.isRunning) {
        t.isRunning = false;
      }
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TimerEngine;
}
