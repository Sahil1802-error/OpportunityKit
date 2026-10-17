/**
 * compare.js - Requirement evaluation, alias normalization, and plain-language reasoning.
 * 
 * Supports browser (window.OK.compare) and Node.js (module.exports).
 * Implements Section 4.1, 4.2, 16.3, 16.4.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.OK = root.OK || {};
    root.OK.compare = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // Canonical skill alias dictionary
  const SKILL_ALIASES = {
    "js": "JavaScript",
    "javascript": "JavaScript",
    "ts": "TypeScript",
    "typescript": "TypeScript",
    "py": "Python",
    "python": "Python",
    "html": "HTML",
    "html5": "HTML",
    "css": "CSS",
    "css3": "CSS",
    "react": "React",
    "reactjs": "React",
    "react.js": "React",
    "node": "Node.js",
    "nodejs": "Node.js",
    "node.js": "Node.js",
    "postgres": "PostgreSQL",
    "postgresql": "PostgreSQL",
    "mongo": "MongoDB",
    "mongodb": "MongoDB",
    "golang": "Go",
    "cpp": "C++",
    "cplusplus": "C++",
    "csharp": "C#",
    "c#": "C#",
    "ml": "Machine Learning"
  };

  /**
   * Normalizes a skill name using alias dictionary and whitespace/case cleanup.
   * Ensures Java != JavaScript.
   * @param {string} skill
   * @returns {string}
   */
  function normalize(skill) {
    if (!skill || typeof skill !== 'string') return "";
    const clean = skill.trim();
    const lower = clean.toLowerCase();
    if (SKILL_ALIASES[lower]) {
      return SKILL_ALIASES[lower];
    }
    // Capitalize first character if standard word
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }

  /**
   * Validates if a string is a well-formed http:// or https:// URL.
   */
  function isValidHttpUrl(string) {
    if (!string || typeof string !== 'string') return false;
    const trimmed = string.trim();
    if (!/^https?:\/\//i.test(trimmed)) return false;
    try {
      const url = new URL(trimmed);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
      return false;
    }
  }

  /**
   * Resolves the profile value corresponding to a requirement field.
   * Distinguishes non-provided (null/undefined/'') from explicit 0 or false.
   */
  function resolveProfileValue(field, profile) {
    if (!profile) return undefined;

    switch (field) {
      case 'year':
        return profile.year !== undefined && profile.year !== null && profile.year !== '' ? Number(profile.year) : undefined;
      case 'cgpa':
        return profile.cgpa !== undefined && profile.cgpa !== null && profile.cgpa !== '' ? Number(profile.cgpa) : undefined;
      case 'branch':
        return profile.branch ? profile.branch.trim() : undefined;
      case 'degree':
        return profile.degree ? profile.degree.trim() : undefined;
      case 'skills':
        return Array.isArray(profile.skills) ? profile.skills : [];
      case 'resume':
      case 'docs':
        return profile.docs ? profile.docs.resume : undefined;
      case 'income_certificate':
        return profile.docs ? profile.docs.income_certificate : undefined;
      case 'marksheet':
        return profile.docs ? profile.docs.marksheet : undefined;
      case 'statement':
        return profile.docs ? profile.docs.statement : undefined;
      case 'prototype':
        return profile.docs ? profile.docs.prototype : undefined;
      case 'demo_video':
        return profile.docs ? profile.docs.demo_video : undefined;
      case 'portfolio':
        return profile.links ? profile.links.portfolio : undefined;
      case 'github':
        return profile.links ? profile.links.github : undefined;
      case 'repository':
        return profile.links ? (profile.links.github || profile.links.repository || profile.links.portfolio) : undefined;
      case 'links':
        return profile.links;
      case 'availability':
        return profile.availabilityWeeks !== undefined && profile.availabilityWeeks !== null && profile.availabilityWeeks !== '' ? Number(profile.availabilityWeeks) : undefined;
      case 'income':
        return profile.income !== undefined && profile.income !== null && profile.income !== '' ? Number(profile.income) : undefined;
      case 'team_size':
        return profile.teamSize !== undefined && profile.teamSize !== null && profile.teamSize !== '' ? Number(profile.teamSize) : undefined;
      default:
        // Check if custom field exists on profile
        if (profile[field] !== undefined) return profile[field];
        if (profile.docs && profile.docs[field] !== undefined) return profile.docs[field];
        if (profile.links && profile.links[field] !== undefined) return profile.links[field];
        return undefined;
    }
  }

  /**
   * Compares an individual checklist requirement against the student profile.
   * Canonical rule schema (Section 16.3): one_of, min, max, equals, has_all, has_any, present, url, custom.
   * Section 4.2 aliases: in_set, gte, lte, bool_required, url_required, gte_weeks.
   * 
   * @param {object} item
   * @param {object} profile
   * @returns {object} { reqId, status, reason, missingValues, effortType, locked, evidence, displayStatus }
   */
  const BRANCH_SYNONYMS = {
    "cse": "cse", "cs": "cse", "computer science": "cse", "computer science engineering": "cse",
    "it": "it", "information technology": "it",
    "ece": "ece", "electronics": "ece", "electronics and communication": "ece",
    "ee": "ee", "electrical": "ee", "electrical engineering": "ee",
    "me": "me", "mechanical": "me", "mechanical engineering": "me"
  };

  function normalizeBranch(b) {
    if (!b) return "";
    const clean = String(b).trim().toLowerCase().replace(/[^a-z0-9 ]/g, '');
    return BRANCH_SYNONYMS[clean] || clean;
  }

  function compare(item, profile) {
    const rawRule = (item.rule || 'custom').toLowerCase();
    // Normalize aliases to canonical schema
    let rule = rawRule;
    if (rawRule === 'in_set') rule = 'one_of';
    if (rawRule === 'gte' || rawRule === 'gte_weeks') rule = 'min';
    if (rawRule === 'lte') rule = 'max';
    if (rawRule === 'bool_required') rule = 'present';
    if (rawRule === 'url_required') rule = 'url';

    const field = item.field;
    const expected = item.value;
    const profileVal = resolveProfileValue(field, profile);

    // Default return template
    const result = {
      reqId: item.id,
      field: item.field,
      category: item.category,
      label: item.label,
      status: "MISSING_INFO",
      reason: "",
      missingValues: [],
      effortType: item.effortType || "quick",
      estimatedDays: item.estimatedDays !== undefined ? item.estimatedDays : null,
      locked: item.locked === true,
      evidence: item.evidence || "",
      active: item.active !== false
    };

    // 1. Check if profile answer is truly missing / unsupplied
    const isValMissing = profileVal === undefined || profileVal === null || (typeof profileVal === 'string' && profileVal.trim() === '');

    // --- EVALUATION PER RULE ---

    if (rule === 'one_of') {
      const allowed = Array.isArray(expected) ? expected : [expected];
      if (isValMissing) {
        result.status = "MISSING_INFO";
        result.reason = `${item.label} is not set in your profile. Provide your ${field} to check eligibility.`;
      } else {
        const matches = allowed.some(a => {
          if (field === 'branch') {
            const normA = normalizeBranch(a);
            const normP = normalizeBranch(profileVal);
            return normA === normP || normA.includes(normP) || normP.includes(normA);
          }
          if (field === 'degree') {
            const cleanA = String(a).toLowerCase().replace(/[^a-z0-9]/g, '');
            const cleanP = String(profileVal).toLowerCase().replace(/[^a-z0-9]/g, '');
            return cleanA === cleanP;
          }
          return String(a).toLowerCase() === String(profileVal).toLowerCase();
        });
        if (matches) {
          result.status = "MATCH";
          result.reason = `${profileVal} satisfies the required ${allowed.join(' or ')}.`;
        } else {
          result.status = "MISMATCH";
          result.reason = `Your ${field} is ${profileVal}; the opportunity requires ${allowed.join(' or ')}.`;
        }
      }
    } else if (rule === 'min') {
      const minThreshold = Number(expected);
      if (isValMissing) {
        result.status = "MISSING_INFO";
        if (field === 'availability') {
          result.reason = `Availability is blank. Confirm whether you can commit to ${minThreshold} weeks.`;
        } else if (field === 'cgpa') {
          result.reason = `No CGPA provided. Minimum required is ${minThreshold}.`;
        } else {
          result.reason = `${item.label} is blank in your profile.`;
        }
      } else {
        const numVal = Number(profileVal);
        if (numVal >= minThreshold) {
          result.status = "MATCH";
          if (field === 'cgpa') {
            result.reason = `Your CGPA is ${numVal}; the minimum requirement is ${minThreshold}.`;
          } else if (field === 'availability') {
            result.reason = `Your availability of ${numVal} weeks meets the ${minThreshold}-week requirement.`;
          } else {
            result.reason = `${numVal} satisfies the minimum of ${minThreshold}.`;
          }
        } else {
          result.status = "MISMATCH";
          if (field === 'cgpa') {
            result.reason = `Your CGPA is ${numVal}; below the minimum cutoff of ${minThreshold}.`;
          } else if (field === 'availability') {
            result.reason = `Your availability is ${numVal} weeks; the opportunity requires at least ${minThreshold} weeks.`;
          } else {
            result.reason = `${numVal} is below the required minimum of ${minThreshold}.`;
          }
        }
      }
    } else if (rule === 'max') {
      const maxThreshold = Number(expected);
      if (isValMissing) {
        result.status = "MISSING_INFO";
        result.reason = `${item.label} is blank in your profile.`;
      } else {
        const numVal = Number(profileVal);
        if (numVal <= maxThreshold) {
          result.status = "MATCH";
          result.reason = `${numVal.toLocaleString('en-IN')} satisfies the maximum cutoff of ${maxThreshold.toLocaleString('en-IN')}.`;
        } else {
          result.status = "MISMATCH";
          result.reason = `${numVal.toLocaleString('en-IN')} exceeds the maximum allowed limit of ${maxThreshold.toLocaleString('en-IN')}.`;
        }
      }
    } else if (rule === 'has_all') {
      const requiredSkills = (Array.isArray(expected) ? expected : [expected]).map(normalize);
      const studentSkills = (Array.isArray(profileVal) ? profileVal : []).map(normalize);

      const missingSkills = [];
      const presentSkills = [];

      requiredSkills.forEach(reqSkill => {
        const found = studentSkills.some(stSkill => stSkill.toLowerCase() === reqSkill.toLowerCase());
        if (found) {
          presentSkills.push(reqSkill);
        } else {
          missingSkills.push(reqSkill);
        }
      });

      result.missingValues = missingSkills;

      if (studentSkills.length === 0) {
        result.status = "MISSING_INFO";
        result.reason = `No skills listed in profile. Required: ${requiredSkills.join(', ')}.`;
      } else if (missingSkills.length === 0) {
        result.status = "MATCH";
        result.reason = `All required skills (${requiredSkills.join(', ')}) are present in your profile.`;
      } else {
        result.status = "MISMATCH";
        if (presentSkills.length > 0) {
          result.reason = `${missingSkills.join(', ')} not listed in your skills; ${presentSkills.join(', ')} present.`;
        } else {
          result.reason = `None of the required skills (${requiredSkills.join(', ')}) are listed in your profile.`;
        }
      }
    } else if (rule === 'has_any') {
      // e.g. links: portfolio or github
      if (field === 'links' && profile.links) {
        const options = Array.isArray(expected) ? expected : ['portfolio', 'github'];
        const satisfiedOptions = [];

        options.forEach(opt => {
          const val = profile.links[opt];
          if (isValidHttpUrl(val)) {
            satisfiedOptions.push(`${opt} (${val})`);
          }
        });

        if (satisfiedOptions.length > 0) {
          result.status = "MATCH";
          result.reason = `Valid link provided: ${satisfiedOptions.join(', ')}.`;
        } else {
          // Check if any invalid string was provided
          const hasInvalid = options.some(opt => profile.links[opt] && profile.links[opt].trim().length > 0);
          if (hasInvalid) {
            result.status = "MISMATCH";
            result.reason = `Provided link is not a valid URL beginning with http:// or https://.`;
          } else {
            result.status = "MISSING_INFO";
            result.reason = `No ${options.join(' or ')} link was provided. Add a valid link if you have one.`;
          }
        }
      } else {
        result.status = "MISSING_INFO";
        result.reason = `No links provided in profile.`;
      }
    } else if (rule === 'present') {
      if (isValMissing) {
        result.status = "MISSING_INFO";
        result.reason = `${item.label} status is not confirmed. Mark ready when prepared.`;
      } else if (profileVal === true || profileVal === "true") {
        result.status = "MATCH";
        result.reason = `${item.label} is marked ready.`;
      } else {
        result.status = "MISMATCH";
        result.reason = `${item.label} is not yet ready.`;
      }
    } else if (rule === 'url') {
      if (isValMissing) {
        result.status = "MISSING_INFO";
        result.reason = `No ${item.label} URL provided.`;
      } else if (isValidHttpUrl(profileVal)) {
        result.status = "MATCH";
        result.reason = `Valid ${item.label} provided (${profileVal}).`;
      } else {
        result.status = "MISMATCH";
        result.reason = `Invalid URL. A valid URL beginning with http:// or https:// is required.`;
      }
    } else if (rule === 'equals') {
      if (isValMissing) {
        result.status = "MISSING_INFO";
        result.reason = `${item.label} not specified in profile.`;
      } else if (String(profileVal).toLowerCase() === String(expected).toLowerCase()) {
        result.status = "MATCH";
        result.reason = `${profileVal} matches ${expected}.`;
      } else {
        result.status = "MISMATCH";
        result.reason = `Profile has "${profileVal}", expected "${expected}".`;
      }
    } else {
      // Custom requirement
      if (isValMissing) {
        result.status = "MISSING_INFO";
        result.reason = `Custom requirement needs your confirmation.`;
      } else if (profileVal === true || profileVal === 'true' || profileVal === 'yes') {
        result.status = "MATCH";
        result.reason = `Confirmed satisfied.`;
      } else {
        result.status = "MISMATCH";
        result.reason = `Marked as not satisfied.`;
      }
    }

    return result;
  }

  /**
   * Unified user-facing display status mapping function.
   * Implements Section 1A.3 and conflict resolution rules:
   * 
   * MATCH -> "MATCH"
   * MISMATCH (locked) -> "MISMATCH" + "LOCKED"
   * MISMATCH (fixable) -> "WORK NEEDED" (sub-label: Mismatch)
   * MISSING_INFO (fixable/prep) -> "WORK NEEDED" (sub-label: Missing info)
   * MISSING_INFO (unknown answer needed) -> "MISSING INFO" (sub-label: unknown, not a failure)
   */
  function displayStatus(result) {
    if (!result) {
      return { label: "UNKNOWN", subLabel: "", badgeClass: "status-unknown" };
    }

    if (result.status === 'MATCH') {
      return {
        label: "MATCH",
        subLabel: "Satisfied",
        badgeClass: "status-match",
        isLocked: false
      };
    }

    if (result.status === 'MISMATCH') {
      if (result.locked === true || result.effortType === 'locked') {
        return {
          label: "MISMATCH",
          tag: "LOCKED",
          subLabel: "Non-fixable eligibility blocker",
          badgeClass: "status-mismatch status-locked",
          isLocked: true
        };
      }
      return {
        label: "WORK NEEDED",
        subLabel: "Mismatch: preparation or update required",
        badgeClass: "status-work-needed",
        isLocked: false
      };
    }

    // MISSING_INFO
    if (result.effortType === 'quick') {
      return {
        label: "MISSING INFO",
        subLabel: "Unknown, not a failure",
        badgeClass: "status-missing-info",
        isLocked: false
      };
    }

    return {
      label: "WORK NEEDED",
      subLabel: "Missing info: answer or document needed",
      badgeClass: "status-work-needed",
      isLocked: false
    };
  }

  return {
    normalize,
    isValidHttpUrl,
    resolveProfileValue,
    compare,
    displayStatus,
    SKILL_ALIASES
  };
});
