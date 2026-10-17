/**
 * score.js - Readiness Range, Score out of 100, Achievable Score, and Verdict.
 * Supports browser (window.OK.score) and Node.js (module.exports).
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.OK = root.OK || {};
    root.OK.score = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  /**
   * score(results, runwayData)
   * 
   * Returns:
   * {
   *   total,
   *   matches,
   *   missing,
   *   mismatches,
   *   floor,          // confirmed score out of 100
   *   ceiling,        // max possible if missing items confirmed
   *   achievable,     // deadline-restricted achievable score out of 100
   *   scoreOut100: floor,
   *   rangeText: "X%–Y%",
   *   explanation: string,
   *   assumptions: string[]
   * }
   */
  function score(results, runwayData = null) {
    const activeResults = (results || []).filter(r => r.active !== false);
    const total = activeResults.length;

    if (total === 0) {
      return {
        total: 0,
        matches: 0,
        missing: 0,
        mismatches: 0,
        floor: 0,
        ceiling: 0,
        achievable: 0,
        scoreOut100: 0,
        rangeText: "0%–0%",
        explanation: "No active requirements tracked. Add requirements to calculate readiness.",
        assumptions: []
      };
    }

    let matches = 0;
    let missing = 0;
    let mismatches = 0;
    let lockedMismatches = 0;

    activeResults.forEach(r => {
      if (r.status === 'MATCH') {
        matches++;
      } else if (r.status === 'MISSING_INFO') {
        missing++;
      } else if (r.status === 'MISMATCH') {
        mismatches++;
        if (r.locked === true || r.effortType === 'locked') {
          lockedMismatches++;
        }
      }
    });

    const floor = Math.round((matches / total) * 100);
    const ceiling = Math.round(((matches + missing) / total) * 100);

    // Calculate deadline-aware achievable score
    let achievable = floor;
    const assumptions = [];

    if (runwayData) {
      if (runwayData.state === 'blocked-by-locked') {
        achievable = floor;
        assumptions.push("Locked eligibility criteria cannot be remediated before the deadline; score capped at confirmed floor.");
      } else if (runwayData.state === 'passed') {
        achievable = floor;
        assumptions.push("Application deadline has passed; no additional gaps can be resolved.");
      } else if (runwayData.state === 'reachable') {
        achievable = ceiling;
        assumptions.push("All missing details and fixable gaps fit within the remaining timeline.");
      } else if (runwayData.state === 'not-reachable') {
        // Only quick tasks + what fits
        const quickMissing = activeResults.filter(
          r => r.status === 'MISSING_INFO' && r.effortType === 'quick'
        ).length;
        const achievableCount = matches + quickMissing;
        achievable = Math.round((achievableCount / total) * 100);
        assumptions.push(`Limited time remaining (${runwayData.daysLeft} days vs ${runwayData.daysNeeded} days needed); only quick profile confirmations assumed.`);
      } else {
        achievable = ceiling;
        assumptions.push("No deadline specified; assuming all missing info can be provided.");
      }
    } else {
      achievable = ceiling;
      assumptions.push("Assuming all missing information can be provided.");
    }

    const explanation = `Readiness score reflects requirement completion (${matches} confirmed matches out of ${total} tracked items = ${floor}%). Ceiling of ${ceiling}% assumes all ${missing} missing items are satisfied. ${mismatches} mismatch(es) require remediation.`;

    return {
      total,
      matches,
      missing,
      mismatches,
      lockedMismatches,
      floor,
      ceiling,
      achievable,
      scoreOut100: floor,
      rangeText: `${floor}%–${ceiling}%`,
      explanation,
      assumptions
    };
  }

  /**
   * verdict(results)
   * 
   * Returns one of:
   * - "skip" (Not eligible for this opportunity — consider skipping it)
   * - "not-ready" (Not ready to apply yet)
   * - "ready" (Ready to apply)
   * - "empty" (Add requirements to evaluate this opportunity)
   */
  function verdict(results) {
    const activeResults = (results || []).filter(r => r.active !== false);
    if (activeResults.length === 0) {
      return "empty";
    }

    // 1. If any requirement has a locked mismatch
    const hasLockedMismatch = activeResults.some(
      r => r.status === 'MISMATCH' && (r.locked === true || r.effortType === 'locked')
    );
    if (hasLockedMismatch) {
      return "skip";
    }

    // 2. Else if any mismatch or missing item exists
    const hasGaps = activeResults.some(r => r.status === 'MISMATCH' || r.status === 'MISSING_INFO');
    if (hasGaps) {
      return "not-ready";
    }

    // 3. All match
    return "ready";
  }

  /**
   * verdictDetails(verdictCode)
   * Returns human-readable label, badge color class, and descriptive text.
   */
  function verdictDetails(code) {
    switch (code) {
      case "ready":
        return {
          code: "ready",
          label: "Ready to Apply",
          tagClass: "verdict-ready",
          description: "All tracked requirements are confirmed satisfied by your profile. You meet the criteria as listed!"
        };
      case "not-ready":
        return {
          code: "not-ready",
          label: "Not Ready to Apply Yet",
          tagClass: "verdict-not-ready",
          description: "Some requirements have gaps or missing information. Review the Fix Plan to see what can be completed."
        };
      case "skip":
        return {
          code: "skip",
          label: "Not Eligible — Consider Skipping",
          tagClass: "verdict-skip",
          description: "One or more fixed eligibility rules (such as year of study or CGPA cutoff) are not met and cannot be fixed for this cycle."
        };
      case "empty":
      default:
        return {
          code: "empty",
          label: "No Requirements",
          tagClass: "verdict-empty",
          description: "Add requirements to evaluate this opportunity."
        };
    }
  }

  return {
    score,
    verdict,
    verdictDetails
  };
});
