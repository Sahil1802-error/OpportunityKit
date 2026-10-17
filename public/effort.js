/**
 * effort.js - Fix-Effort classification, lookup table, and Deadline Runway calculations.
 * Supports browser (window.OK.effort) and Node.js (module.exports).
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.OK = root.OK || {};
    root.OK.effort = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // Default configurable effort estimates table (in days)
  const DEFAULT_EFFORT_LOOKUP = {
    quick: {
      defaultDays: 0,
      label: "Quick (0 days / minutes)",
      description: "Quick confirmation or adding an existing link / detail."
    },
    days: {
      defaultDays: 3,
      skillDays: 5,
      docDays: 2,
      label: "Days (1–5 days)",
      description: "Preparing a document or learning a focused skill."
    },
    weeks: {
      defaultDays: 10,
      label: "Weeks (1–3 weeks)",
      description: "Substantial new competency requiring sustained preparation."
    },
    locked: {
      defaultDays: 0,
      label: "Locked (Non-fixable)",
      description: "Fixed eligibility rule that cannot be altered for this opportunity."
    }
  };

  /**
   * Helper to normalize a date to midnight UTC date-only to eliminate time zone off-by-one errors.
   */
  function normalizeDateOnly(dateInput) {
    if (!dateInput) return null;
    let d;
    if (typeof dateInput === 'string') {
      // If YYYY-MM-DD format
      const parts = dateInput.trim().split(/[-/]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          // YYYY-MM-DD
          return new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
        } else if (parts[2].length === 4) {
          // DD/MM/YYYY
          return new Date(Date.UTC(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10)));
        }
      }
      d = new Date(dateInput);
    } else if (dateInput instanceof Date) {
      d = dateInput;
    } else {
      return null;
    }

    if (isNaN(d.getTime())) return null;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  /**
   * Calculate calendar days between two dates.
   */
  function calendarDaysBetween(fromDate, toDate) {
    const d1 = normalizeDateOnly(fromDate);
    const d2 = normalizeDateOnly(toDate);
    if (!d1 || !d2) return null;
    const diffMs = d2.getTime() - d1.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * runway(results, deadline, todayDate)
   * 
   * Parallel-safe calculation:
   * - Quick tasks contribute 0 days
   * - Parallel skills take max(skillTasks)
   * - Document tasks take sum(documentTasks)
   * 
   * Returns: {
   *   daysNeeded,
   *   daysLeft,
   *   reachable,
   *   state: "reachable" | "not-reachable" | "passed" | "no-deadline" | "blocked-by-locked",
   *   explanation,
   *   breakdown: { skillDays, docDays, quickTasksCount }
   * }
   */
  function runway(results, deadline, todayDate = new Date()) {
    const normalizedToday = normalizeDateOnly(todayDate);
    const normalizedDeadline = normalizeDateOnly(deadline);

    // 1. Check for locked blockers first
    const hasLockedBlocker = (results || []).some(
      r => r.status === 'MISMATCH' && (r.locked === true || r.effortType === 'locked')
    );

    // 2. Compute days needed from non-matched items
    let maxSkillDays = 0;
    let sumDocDays = 0;
    let quickCount = 0;
    const fixableGaps = [];

    (results || []).forEach(r => {
      // Only items needing work (MISMATCH or MISSING_INFO that are not locked)
      if (r.status !== 'MATCH' && !(r.locked || r.effortType === 'locked')) {
        fixableGaps.push(r);
        const effortType = r.effortType || 'days';
        const customDays = typeof r.estimatedDays === 'number' ? r.estimatedDays : null;

        if (effortType === 'quick') {
          quickCount++;
        } else if (r.category === 'skills' || r.field === 'skills') {
          const days = customDays !== null ? customDays : DEFAULT_EFFORT_LOOKUP.days.skillDays;
          if (days > maxSkillDays) {
            maxSkillDays = days;
          }
        } else if (r.category === 'documents' || r.field === 'resume' || r.field === 'docs') {
          const days = customDays !== null ? customDays : DEFAULT_EFFORT_LOOKUP.days.docDays;
          sumDocDays += days;
        } else {
          // General gap
          const days = customDays !== null ? customDays : (DEFAULT_EFFORT_LOOKUP[effortType]?.defaultDays || 2);
          if (effortType === 'weeks') {
            if (days > maxSkillDays) maxSkillDays = days;
          } else {
            sumDocDays += days;
          }
        }
      }
    });

    const daysNeeded = maxSkillDays + sumDocDays;

    // 3. Handle missing deadline
    if (!normalizedDeadline) {
      return {
        daysNeeded,
        daysLeft: null,
        reachable: null,
        state: hasLockedBlocker ? 'blocked-by-locked' : 'no-deadline',
        explanation: hasLockedBlocker
          ? "Opportunity has fixed eligibility criteria that are not met. Consider skipping."
          : "Add an application deadline to calculate your deadline runway.",
        breakdown: { skillDays: maxSkillDays, docDays: sumDocDays, quickTasksCount: quickCount, totalGaps: fixableGaps.length }
      };
    }

    // 4. Calculate days left
    const daysLeft = calendarDaysBetween(normalizedToday, normalizedDeadline);

    // 5. If deadline passed
    if (daysLeft < 0) {
      return {
        daysNeeded,
        daysLeft,
        reachable: false,
        state: 'passed',
        explanation: `Application deadline passed ${Math.abs(daysLeft)} day(s) ago.`,
        breakdown: { skillDays: maxSkillDays, docDays: sumDocDays, quickTasksCount: quickCount, totalGaps: fixableGaps.length }
      };
    }

    // 6. If blocked by locked requirement
    if (hasLockedBlocker) {
      return {
        daysNeeded,
        daysLeft,
        reachable: false,
        state: 'blocked-by-locked',
        explanation: `Blocked by non-fixable eligibility requirements (e.g. year of study or CGPA cutoff), even though ${daysLeft} day(s) remain.`,
        breakdown: { skillDays: maxSkillDays, docDays: sumDocDays, quickTasksCount: quickCount, totalGaps: fixableGaps.length }
      };
    }

    // 7. Reachable check
    const reachable = daysNeeded <= daysLeft;
    const state = reachable ? 'reachable' : 'not-reachable';
    let explanation = '';
    if (daysNeeded === 0) {
      explanation = `All requirements confirmed or only instant tasks remain! ${daysLeft} day(s) left.`;
    } else if (reachable) {
      explanation = `Reachable: Estimated ${daysNeeded} day(s) of preparation needed with ${daysLeft} day(s) remaining.`;
    } else {
      explanation = `Tight runway: Estimated ${daysNeeded} day(s) needed exceeds the ${daysLeft} day(s) remaining before deadline.`;
    }

    return {
      daysNeeded,
      daysLeft,
      reachable,
      state,
      explanation,
      breakdown: { skillDays: maxSkillDays, docDays: sumDocDays, quickTasksCount: quickCount, totalGaps: fixableGaps.length }
    };
  }

  return {
    DEFAULT_EFFORT_LOOKUP,
    normalizeDateOnly,
    calendarDaysBetween,
    runway
  };
});
