/**
 * samples.js - Isolated demo fixtures and test data per Section 8 of the specification.
 * 
 * IMPORTANT: Per Section 16.7, this file contains ONLY demo fixtures and regression test data.
 * The core extraction and comparison engines (extract.js, compare.js, score.js, effort.js)
 * MUST NOT import or rely on these values as defaults for real user analysis.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.OK = root.OK || {};
    root.OK.samples = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  const SAMPLE_OPPORTUNITY_TEXT = `Frontend Engineering Internship (Summer 2026)
We are looking for enthusiastic engineering students to join our core product team.

Eligibility & Requirements:
- Applicants must be in the 2nd or 3rd year of B.Tech / B.E.
- Minimum CGPA of 7.5 or above.
- Required skills: HTML, CSS, JavaScript.
- Up-to-date resume required.
- Must provide a portfolio or GitHub link to past projects.
- Must be available for 8 weeks full-time.
- Application deadline: 12 days from today.`;

  const SAMPLE_OPPORTUNITY_REQUIREMENTS = [
    {
      id: "req_year",
      category: "eligibility",
      field: "year",
      label: "Year of study (2nd or 3rd year)",
      rule: "one_of",
      value: [2, 3],
      unit: "year",
      required: true,
      evidence: "Applicants must be in the 2nd or 3rd year of B.Tech / B.E.",
      confidence: "high",
      effortType: "locked",
      estimatedDays: null,
      locked: true,
      active: true
    },
    {
      id: "req_cgpa",
      category: "eligibility",
      field: "cgpa",
      label: "Minimum CGPA cutoff (7.5+)",
      rule: "min",
      value: 7.5,
      unit: "cgpa",
      required: true,
      evidence: "Minimum CGPA of 7.5 or above.",
      confidence: "high",
      effortType: "locked",
      estimatedDays: null,
      locked: true,
      active: true
    },
    {
      id: "req_skills",
      category: "skills",
      field: "skills",
      label: "Required skills (HTML, CSS, JavaScript)",
      rule: "has_all",
      value: ["HTML", "CSS", "JavaScript"],
      unit: null,
      required: true,
      evidence: "Required skills: HTML, CSS, JavaScript.",
      confidence: "high",
      effortType: "days",
      estimatedDays: 5,
      locked: false,
      active: true
    },
    {
      id: "req_resume",
      category: "documents",
      field: "resume",
      label: "Resume / CV",
      rule: "present",
      value: true,
      unit: null,
      required: true,
      evidence: "Up-to-date resume required.",
      confidence: "high",
      effortType: "days",
      estimatedDays: 2,
      locked: false,
      active: true
    },
    {
      id: "req_link",
      category: "links",
      field: "links",
      label: "Portfolio or GitHub profile",
      rule: "has_any",
      value: ["portfolio", "github"],
      unit: null,
      required: true,
      evidence: "Must provide a portfolio or GitHub link to past projects.",
      confidence: "high",
      effortType: "quick",
      estimatedDays: 0,
      locked: false,
      active: true
    },
    {
      id: "req_availability",
      category: "logistics",
      field: "availability",
      label: "Availability (8 weeks)",
      rule: "min",
      value: 8,
      unit: "weeks",
      required: true,
      evidence: "Must be available for 8 weeks full-time.",
      confidence: "high",
      effortType: "quick",
      estimatedDays: 0,
      locked: false,
      active: true
    }
  ];

  const SAMPLE_STUDENT_PROFILE = {
    name: "Alex Sharma",
    year: 2,
    branch: "CSE",
    degree: "B.Tech",
    cgpa: 8.2,
    skills: ["HTML", "CSS", "Python"],
    docs: {
      resume: true,
      marksheet: false,
      income_certificate: false
    },
    links: {
      portfolio: "",
      github: "",
      website: ""
    },
    availabilityWeeks: null,
    notes: "Eager to learn frontend engineering frameworks."
  };

  /**
   * Helper to return sample deadline date ISO string (12 days in the future)
   */
  function getSampleDeadlineDate() {
    const d = new Date();
    d.setDate(d.getDate() + 12);
    // YYYY-MM-DD
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return {
    SAMPLE_OPPORTUNITY_TEXT,
    SAMPLE_OPPORTUNITY_REQUIREMENTS,
    SAMPLE_STUDENT_PROFILE,
    getSampleDeadlineDate
  };
});
