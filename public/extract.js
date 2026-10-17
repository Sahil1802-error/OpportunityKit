/**
 * extract.js - Layered, deterministic extraction pipeline per Section 16.2.
 * 
 * Extracts requirements from user-pasted opportunity descriptions into a canonical
 * checklist schema with exact-sentence evidence attribution.
 * 
 * Works without any AI API key or external service.
 * Supports browser (window.OK.extract) and Node.js (module.exports).
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.OK = root.OK || {};
    root.OK.extract = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // Known skill tokens to scan for in text (comprehensive tech dictionary)
  const SKILL_KEYWORDS = [
    "JavaScript", "TypeScript", "Python", "Java", "C++", "C#", "Go", "Rust", "Ruby", "PHP",
    "HTML", "CSS", "React", "Next.js", "Angular", "Vue", "Node.js", "Express", "Django", "Flask",
    "FastAPI", "Spring Boot", "SQL", "PostgreSQL", "MySQL", "MongoDB", "SQLite", "Redis",
    "Docker", "Kubernetes", "AWS", "Azure", "GCP", "Git", "GitHub", "Linux", "Figma",
    "GraphQL", "REST API", "Tailwind CSS", "Bootstrap", "Machine Learning", "Data Structures",
    "Flutter", "Dart", "Swift", "Kotlin", "NLP"
  ];

  /**
   * Generates a stable unique ID for an extracted requirement.
   */
  function generateReqId(field, index) {
    return `req_${field}_${index}_${Math.random().toString(36).substring(2, 6)}`;
  }

  /**
   * Splits input text into discrete sentences / bullet points while preserving original strings.
   */
  function splitIntoSentences(text) {
    if (!text) return [];
    // Normalize newlines and bullet points
    const lines = text.split(/\r?\n/);
    const sentences = [];

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Strip bullet points like -, *, •, 1., etc.
      const cleaned = trimmed.replace(/^[-*•\d.)\]]+\s*/, '');
      if (!cleaned) return;

      // Further split long lines by sentence terminators if multiple sentences exist
      const sMatches = cleaned.split(/(?<=[.!?])\s+(?=[A-Z0-9])/);
      sMatches.forEach(s => {
        const sTrim = s.trim();
        if (sTrim.length > 0) {
          sentences.push(sTrim);
        }
      });
    });

    return sentences;
  }

  /**
   * Parses common date formats from a sentence.
   * e.g., "30 November 2026", "Nov 30, 2026", "12 December 2026", "2026-11-30", "30/11/2026"
   */
  function parseDateFromSentence(sentence) {
    const monthNames = {
      jan: "01", january: "01",
      feb: "02", february: "02",
      mar: "03", march: "03",
      apr: "04", april: "04",
      may: "05",
      jun: "06", june: "06",
      jul: "07", july: "07",
      aug: "08", august: "08",
      sep: "09", september: "09",
      oct: "10", october: "10",
      nov: "11", november: "11",
      dec: "12", december: "12"
    };

    // Pattern 1: 30 November 2026 or 30 Nov 2026 or 30th November 2026
    const p1 = sentence.match(/\b([0-3]?[0-9])(?:st|nd|rd|th)?\s+([A-Za-z]+),?\s+(20[2-9][0-9])\b/i);
    if (p1) {
      const day = String(parseInt(p1[1], 10)).padStart(2, '0');
      const mStr = p1[2].toLowerCase();
      const month = monthNames[mStr];
      const year = p1[3];
      if (month) return `${year}-${month}-${day}`;
    }

    // Pattern 2: November 30, 2026 or Nov 30 2026
    const p2 = sentence.match(/\b([A-Za-z]+)\s+([0-3]?[0-9])(?:st|nd|rd|th)?,?\s+(20[2-9][0-9])\b/i);
    if (p2) {
      const mStr = p2[1].toLowerCase();
      const month = monthNames[mStr];
      const day = String(parseInt(p2[2], 10)).padStart(2, '0');
      const year = p2[3];
      if (month) return `${year}-${month}-${day}`;
    }

    // Pattern 3: YYYY-MM-DD
    const p3 = sentence.match(/\b(20[2-9][0-9])[-/](0[1-9]|1[0-2])[-/]([0-3][0-9])\b/);
    if (p3) {
      return `${p3[1]}-${p3[2]}-${p3[3]}`;
    }

    // Pattern 4: DD/MM/YYYY
    const p4 = sentence.match(/\b([0-3][0-9])[-/](0[1-9]|1[0-2])[-/](20[2-9][0-9])\b/);
    if (p4) {
      return `${p4[3]}-${p4[2]}-${p4[1]}`;
    }

    // Pattern 5: "12 days from today" or "12 days"
    const p5 = sentence.match(/\b(\d+)\s+days\s+from\s+(?:today|now)\b/i);
    if (p5) {
      const days = parseInt(p5[1], 10);
      const d = new Date();
      d.setDate(d.getDate() + days);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }

    return null;
  }

  /**
   * Main extract function.
   * Analyzes arbitrary user opportunity text and returns an array of requirement items.
   * Also attaches any detected top-level deadline on the returned array property `detectedDeadline`.
   * 
   * @param {string} text
   * @returns {Array<object>}
   */
  function extract(text) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      const emptyResult = [];
      emptyResult.detectedDeadline = null;
      return emptyResult;
    }

    const sentences = splitIntoSentences(text);
    const requirements = [];
    let detectedDeadline = null;

    // Track fields already added to avoid duplicate extraction
    const extractedFields = new Set();
    const collectedSkills = [];
    const skillEvidences = [];

    sentences.forEach((s, idx) => {
      const lower = s.toLowerCase();

      // --- 1. Deadline detection ---
      if (lower.includes('deadline') || lower.includes('apply by') || lower.includes('closes on') || lower.includes('submission closes') || lower.includes('due date') || lower.includes('last date')) {
        const d = parseDateFromSentence(s);
        if (d && !detectedDeadline) {
          detectedDeadline = d;
        }
      } else if (!detectedDeadline) {
        // Opportunistic date check in sentences
        const d = parseDateFromSentence(s);
        if (d) detectedDeadline = d;
      }

      // --- 2. Eligibility: Year of study ---
      if (!extractedFields.has('year') && (lower.includes('year') || lower.includes('undergraduate') || lower.includes('final year'))) {
        // e.g. "2nd or 3rd year", "second or third year", "third year", "2nd-year", "final year"
        let years = null;
        let label = "Year of study";

        if (lower.includes('2nd or 3rd year') || lower.includes('2nd and 3rd year') || lower.includes('second or third year')) {
          years = [2, 3];
          label = "Year of study (2nd or 3rd year)";
        } else if (lower.includes('third year') || lower.includes('3rd year') || lower.includes('3rd-year')) {
          years = [3];
          label = "Year of study (3rd year)";
        } else if (lower.includes('second year') || lower.includes('2nd year') || lower.includes('2nd-year')) {
          years = [2];
          label = "Year of study (2nd year)";
        } else if (lower.includes('final year') || lower.includes('4th year')) {
          years = [4];
          label = "Year of study (Final year)";
        } else if (lower.includes('1st year') || lower.includes('first year')) {
          years = [1];
          label = "Year of study (1st year)";
        }

        if (years) {
          extractedFields.add('year');
          requirements.push({
            id: generateReqId('year', idx),
            category: "eligibility",
            field: "year",
            label: label,
            rule: "one_of",
            value: years,
            unit: "year",
            required: true,
            evidence: s,
            confidence: "high",
            effortType: "locked",
            estimatedDays: null,
            locked: true,
            active: true
          });
        }
      }

      // --- 3. Eligibility: CGPA / GPA cutoff ---
      if (!extractedFields.has('cgpa') && (lower.includes('cgpa') || lower.includes('gpa') || lower.includes('marks'))) {
        // Matches: "CGPA: 8.0", "CGPA of at least 7.0", "CGPA >= 7.5", "minimum CGPA of 7.5", "7.5+ CGPA", "CGPA 7.0/10"
        const cgpaMatch = s.match(/(?:cgpa|gpa|sgpa|marks)\s*(?:of\s+at\s+least|at\s+least|of\s+minimum|minimum\s+of|of|is|minimum|cutoff)?\s*(?:[:=]|>=|>)?\s*([0-9](?:\.[0-9]{1,2})?)/i) ||
                          s.match(/(?:minimum|at\s+least|cutoff|score\s+of)\s*[:=]?\s*([0-9](?:\.[0-9]{1,2})?)\s*(?:\+)?\s*(?:cgpa|gpa|sgpa|marks)/i) ||
                          s.match(/\b([0-9]\.[0-9]{1,2})\s*(?:\+)?\s*(?:cgpa|gpa|sgpa)\b/i);
        if (cgpaMatch) {
          const cutoff = parseFloat(cgpaMatch[1]);
          if (!isNaN(cutoff) && cutoff > 0 && cutoff <= 10) {
            extractedFields.add('cgpa');
            requirements.push({
              id: generateReqId('cgpa', idx),
              category: "eligibility",
              field: "cgpa",
              label: `Minimum CGPA cutoff (${cutoff}+)`,
              rule: "min",
              value: cutoff,
              unit: "cgpa",
              required: true,
              evidence: s,
              confidence: "high",
              effortType: "locked",
              estimatedDays: null,
              locked: true,
              active: true
            });
          }
        }
      }

      // --- 4. Eligibility: Income limit (Scholarships) ---
      if (!extractedFields.has('income') && (lower.includes('income') || lower.includes('lpa') || lower.includes('₹') || lower.includes('rs.'))) {
        // e.g. "income below ₹3,00,000", "income below 3,00,000", "below 3 LPA"
        const incomeMatch = s.match(/(?:income|family income)\s*(?:below|less than|under|<=|<)\s*[₹Rs.]*\s*([0-9,]+)/i) ||
                            s.match(/(?:below|under)\s*[₹Rs.]*\s*([0-9,]+)\s*(?:per year|\/year|lpa)/i);
        if (incomeMatch) {
          const rawNum = incomeMatch[1].replace(/,/g, '');
          let incomeVal = parseInt(rawNum, 10);
          if (incomeMatch[0].toLowerCase().includes('lpa') && incomeVal < 100) {
            incomeVal = incomeVal * 100000;
          }
          if (!isNaN(incomeVal) && incomeVal > 0) {
            extractedFields.add('income');
            requirements.push({
              id: generateReqId('income', idx),
              category: "eligibility",
              field: "income",
              label: `Annual family income limit (<= ₹${incomeVal.toLocaleString('en-IN')})`,
              rule: "max",
              value: incomeVal,
              unit: "INR",
              required: true,
              evidence: s,
              confidence: "high",
              effortType: "locked",
              estimatedDays: null,
              locked: true,
              active: true
            });
          }
        }
      }

      // --- 5. Eligibility: Team size (Hackathons / Competitions) ---
      if (!extractedFields.has('team_size') && (lower.includes('team') || lower.includes('participate'))) {
        const teamMatch = s.match(/teams?\s+of\s+([0-9]+)\s*(?:–|-|to)\s*([0-9]+)\s*(?:students|members|people)?/i);
        if (teamMatch) {
          const minTeam = parseInt(teamMatch[1], 10);
          const maxTeam = parseInt(teamMatch[2], 10);
          extractedFields.add('team_size');
          requirements.push({
            id: generateReqId('team_size', idx),
            category: "eligibility",
            field: "team_size",
            label: `Team size (${minTeam}–${maxTeam} members)`,
            rule: "min",
            value: minTeam,
            maxValue: maxTeam,
            unit: "members",
            required: true,
            evidence: s,
            confidence: "high",
            effortType: "quick",
            estimatedDays: 0,
            locked: false,
            active: true
          });
        }
      }

      // --- 6. Skills extraction ---
      // IMPORTANT: Section 16.6 Test C explicit rule:
      // "Teams may use any programming language" must NOT create a language skill requirement!
      const isAnyLanguageExemption = lower.includes('any programming language') || lower.includes('any language');

      if (!isAnyLanguageExemption) {
        const detectedSkillsInSentence = [];
        SKILL_KEYWORDS.forEach(kw => {
          const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const kwRegex = new RegExp(`(?<=[^a-zA-Z0-9#+]|^)${escaped}(?=[^a-zA-Z0-9#+]|$)`, 'i');
          if (kwRegex.test(s)) {
            // Avoid false positive "Java" when word is "JavaScript"
            if (kw === 'Java' && /\bjavascript\b/i.test(s)) {
              const nonJs = s.replace(/javascript/gi, '');
              if (!/\bjava\b/i.test(nonJs)) return;
            }
            detectedSkillsInSentence.push(kw);
          }
        });

        if (detectedSkillsInSentence.length > 0) {
          const isSkillContext = lower.includes('skill') || lower.includes('know') || lower.includes('require') ||
                                 lower.includes('experience') || lower.includes('proficien') || lower.includes('stack') ||
                                 lower.includes('infra') || lower.includes('tech') || lower.includes('tool') ||
                                 lower.includes('good at') || lower.includes('familiar') ||
                                 lower.includes('react and javascript') || lower.includes('html, css') ||
                                 detectedSkillsInSentence.length >= 2 || s.startsWith('-') || s.startsWith('•') || s.startsWith('*');
          if (isSkillContext) {
            detectedSkillsInSentence.forEach(sk => {
              if (!collectedSkills.includes(sk)) {
                collectedSkills.push(sk);
              }
            });
            skillEvidences.push(s);
          }
        }
      }

      // --- 7. Documents extraction ---
      // Resume / CV
      if (!extractedFields.has('resume') && (lower.includes('resume') || lower.includes('cv'))) {
        extractedFields.add('resume');
        requirements.push({
          id: generateReqId('resume', idx),
          category: "documents",
          field: "resume",
          label: "Resume / CV",
          rule: "present",
          value: true,
          unit: null,
          required: true,
          evidence: s,
          confidence: "high",
          effortType: "days",
          estimatedDays: 2,
          locked: false,
          active: true
        });
      }

      // Income Certificate
      if (!extractedFields.has('income_certificate') && lower.includes('income certificate')) {
        extractedFields.add('income_certificate');
        requirements.push({
          id: generateReqId('income_certificate', idx),
          category: "documents",
          field: "income_certificate",
          label: "Income Certificate",
          rule: "present",
          value: true,
          unit: null,
          required: true,
          evidence: s,
          confidence: "high",
          effortType: "days",
          estimatedDays: 2,
          locked: false,
          active: true
        });
      }

      // Marksheet
      if (!extractedFields.has('marksheet') && (lower.includes('marksheet') || lower.includes('transcript'))) {
        extractedFields.add('marksheet');
        requirements.push({
          id: generateReqId('marksheet', idx),
          category: "documents",
          field: "marksheet",
          label: "Latest Marksheet / Academic Transcript",
          rule: "present",
          value: true,
          unit: null,
          required: true,
          evidence: s,
          confidence: "high",
          effortType: "days",
          estimatedDays: 2,
          locked: false,
          active: true
        });
      }

      // Statement (e.g. 300-word statement)
      if (!extractedFields.has('statement') && (lower.includes('statement') || lower.includes('sop') || lower.includes('essay'))) {
        const wordMatch = s.match(/([0-9]+)\s*-?\s*words?\s+statement/i);
        const stmtLabel = wordMatch ? `${wordMatch[1]}-word Personal Statement` : "Personal Statement / SOP";
        extractedFields.add('statement');
        requirements.push({
          id: generateReqId('statement', idx),
          category: "documents",
          field: "statement",
          label: stmtLabel,
          rule: "present",
          value: true,
          unit: null,
          required: true,
          evidence: s,
          confidence: "high",
          effortType: "days",
          estimatedDays: 2,
          locked: false,
          active: true
        });
      }

      // Prototype (Hackathon)
      if (!extractedFields.has('prototype') && (lower.includes('working prototype') || lower.includes('prototype'))) {
        extractedFields.add('prototype');
        requirements.push({
          id: generateReqId('prototype', idx),
          category: "documents",
          field: "prototype",
          label: "Working Prototype",
          rule: "present",
          value: true,
          unit: null,
          required: true,
          evidence: s,
          confidence: "high",
          effortType: "days",
          estimatedDays: 3,
          locked: false,
          active: true
        });
      }

      // Repository (Hackathon)
      if (!extractedFields.has('repository') && (lower.includes('public repository') || lower.includes('code repository') || lower.includes('github repo'))) {
        extractedFields.add('repository');
        requirements.push({
          id: generateReqId('repository', idx),
          category: "links",
          field: "repository",
          label: "Public Code Repository",
          rule: "url",
          value: true,
          unit: null,
          required: true,
          evidence: s,
          confidence: "high",
          effortType: "quick",
          estimatedDays: 0,
          locked: false,
          active: true
        });
      }

      // Demo Video (Hackathon)
      if (!extractedFields.has('demo_video') && (lower.includes('demo video') || lower.includes('video demo'))) {
        extractedFields.add('demo_video');
        requirements.push({
          id: generateReqId('demo_video', idx),
          category: "documents",
          field: "demo_video",
          label: "Short Demo Video",
          rule: "present",
          value: true,
          unit: null,
          required: true,
          evidence: s,
          confidence: "high",
          effortType: "days",
          estimatedDays: 2,
          locked: false,
          active: true
        });
      }

      // --- 8. Links extraction (Portfolio / GitHub) ---
      if (!extractedFields.has('links') && !extractedFields.has('repository')) {
        const hasPortfolio = lower.includes('portfolio');
        const hasGithub = lower.includes('github');

        if (hasPortfolio && hasGithub) {
          extractedFields.add('links');
          requirements.push({
            id: generateReqId('links', idx),
            category: "links",
            field: "links",
            label: "Portfolio or GitHub Profile",
            rule: "has_any",
            value: ["portfolio", "github"],
            unit: null,
            required: true,
            evidence: s,
            confidence: "high",
            effortType: "quick",
            estimatedDays: 0,
            locked: false,
            active: true
          });
        } else if (hasPortfolio && (lower.includes('link') || lower.includes('url') || lower.includes('website') || lower.includes('include') || lower.includes('provide'))) {
          extractedFields.add('links');
          requirements.push({
            id: generateReqId('portfolio', idx),
            category: "links",
            field: "portfolio",
            label: "Portfolio Website URL",
            rule: "url",
            value: true,
            unit: null,
            required: true,
            evidence: s,
            confidence: "high",
            effortType: "quick",
            estimatedDays: 0,
            locked: false,
            active: true
          });
        } else if (hasGithub && (lower.includes('link') || lower.includes('profile') || lower.includes('include') || lower.includes('provide'))) {
          extractedFields.add('links');
          requirements.push({
            id: generateReqId('github', idx),
            category: "links",
            field: "github",
            label: "GitHub Profile URL",
            rule: "url",
            value: true,
            unit: null,
            required: true,
            evidence: s,
            confidence: "high",
            effortType: "quick",
            estimatedDays: 0,
            locked: false,
            active: true
          });
        }
      }

      // --- 9. Logistics / Availability / Duration ---
      if (!extractedFields.has('availability') && (lower.includes('week') || lower.includes('month') || lower.includes('duration') || lower.includes('available for') || lower.includes('lasting') || lower.includes('lasts'))) {
        const weekMatch = s.match(/(?:available for|duration of|lasts|lasting)?\s*([0-9]+)\s*weeks?/i);
        const monthMatch = s.match(/(?:available for|duration of|lasts|lasting)?\s*([0-9]+)\s*months?/i);

        if (weekMatch) {
          const weeks = parseInt(weekMatch[1], 10);
          extractedFields.add('availability');
          requirements.push({
            id: generateReqId('availability', idx),
            category: "logistics",
            field: "availability",
            label: `Availability (${weeks} weeks)`,
            rule: "min",
            value: weeks,
            unit: "weeks",
            required: true,
            evidence: s,
            confidence: "high",
            effortType: "quick",
            estimatedDays: 0,
            locked: false,
            active: true
          });
        } else if (monthMatch) {
          const weeks = parseInt(monthMatch[1], 10) * 4;
          extractedFields.add('availability');
          requirements.push({
            id: generateReqId('availability', idx),
            category: "logistics",
            field: "availability",
            label: `Availability (${weeks} weeks / ${monthMatch[1]} months)`,
            rule: "min",
            value: weeks,
            unit: "weeks",
            required: true,
            evidence: s,
            confidence: "high",
            effortType: "quick",
            estimatedDays: 0,
            locked: false,
            active: true
          });
        }
      }

      // --- 10. Work mode / Location ---
      if (!extractedFields.has('location') && (lower.includes('hybrid') || lower.includes('remote') || lower.includes('on-site') || lower.includes('onsite'))) {
        let locType = "On-site";
        if (lower.includes('hybrid')) locType = "Hybrid";
        else if (lower.includes('remote')) locType = "Remote";

        const cityMatch = s.match(/\bin\s+([A-Z][a-zA-Z]+)\b/);
        const locLabel = cityMatch ? `${locType} (${cityMatch[1]})` : locType;

        extractedFields.add('location');
        requirements.push({
          id: generateReqId('location', idx),
          category: "logistics",
          field: "location",
          label: `Work mode: ${locLabel}`,
          rule: "custom",
          value: locLabel,
          unit: null,
          required: false,
          evidence: s,
          confidence: "high",
          effortType: "quick",
          estimatedDays: 0,
          locked: false,
          active: true
        });
      }
    });

    // Consolidate collected skills across all requirement lines
    if (collectedSkills.length > 0) {
      const skillsReq = {
        id: generateReqId('skills', 0),
        category: "skills",
        field: "skills",
        label: `Required skills (${collectedSkills.join(', ')})`,
        rule: "has_all",
        value: collectedSkills,
        unit: null,
        required: true,
        evidence: skillEvidences.join('; ') || `Required skills: ${collectedSkills.join(', ')}`,
        confidence: "high",
        effortType: "days",
        estimatedDays: 5,
        locked: false,
        active: true
      };
      // Insert after cgpa/year if present to preserve canonical order
      const cgpaIdx = requirements.findIndex(r => r.field === 'cgpa');
      const yearIdx = requirements.findIndex(r => r.field === 'year');
      if (cgpaIdx !== -1) {
        requirements.splice(cgpaIdx + 1, 0, skillsReq);
      } else if (yearIdx !== -1) {
        requirements.splice(yearIdx + 1, 0, skillsReq);
      } else {
        requirements.unshift(skillsReq);
      }
    }

    // Attach detected deadline as property on array for UI convenience
    requirements.detectedDeadline = detectedDeadline;

    return requirements;
  }

  /**
   * Filters raw unstructured opportunity text (e.g. from brochures or JD PDFs)
   * to strictly isolate the job requirements, eligibility, qualifications, deliverables,
   * and timeline/deadline part, eliminating non-essential corporate boilerplates:
   * - "About Us" / "Who we are" / Company history
   * - "Perks & Benefits" (free lunch, health cover, gym)
   * - "Equal Opportunity Employer" / EEO / Diversity disclaimers
   * - Copyright footers, legal terms, privacy policies
   * 
   * @param {string} text
   * @returns {string}
   */
  function filterEssentialOpportunityText(text) {
    if (!text || typeof text !== 'string') return '';

    const BOILERPLATE_HEADERS = [
      /^about(\s+(us|the\s+company|our\s+team|our\s+company|the\s+organization|the\s+firm|our\s+business))\b/i,
      /^who\s+we\s+are\b/i,
      /^our\s+(mission|story|culture|vision|values|journey|background)\b/i,
      /^company\s+(overview|profile|background)\b/i,
      /^(perks|benefits|what\s+we\s+offer|why\s+join\s+us|compensation(\s*(&|and)\s*benefits)?|work\s+culture)\b/i,
      /^(equal\s+opportunity(\s+employer)?|eeo(\s+statement)?|diversity(\s*(&|and)\s*inclusion)?)\b/i,
      /^(privacy\s+policy|terms(\s*(&|and)\s*conditions)?|legal\s+disclaimer|disclaimer|copyright(\s+notice)?)\b/i,
      /^(how\s+we\s+hire|life\s+at\s+[a-z0-9_\s]+)\b/i
    ];

    const BOILERPLATE_BODY_PATTERNS = [
      /equal\s+opportunity\s+employer/i,
      /all\s+qualified\s+applicants\s+will\s+receive\s+consideration\s+for\s+employment/i,
      /without\s+regard\s+to\s+race,\s*color,\s*religion/i,
      /copyright\s*(©|\(c\)|20\d\d)/i,
      /all\s+rights\s+reserved/i,
      /founded\s+in\s+20\d\d/i,
      /free\s+(company\s+)?(lunch|snacks|coffee|breakfast)/i,
      /wellness\s+reimbursement|gym\s+membership|medical\s+insurance/i
    ];

    // Split into logical blocks by double or multiple newlines
    const rawBlocks = text.split(/\n\s*\n+/);
    const essentialBlocks = [];

    for (const block of rawBlocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;

      const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean);
      const firstLine = lines[0].replace(/[:\-–—#*]+$/, '').trim();

      // Check if header marks a non-essential section
      const isBoilerplateHeader = BOILERPLATE_HEADERS.some(re => re.test(firstLine));
      if (isBoilerplateHeader) {
        continue;
      }

      // Check if body text matches corporate boilerplates without strong requirement signals
      const isBoilerplateBody = BOILERPLATE_BODY_PATTERNS.some(re => re.test(trimmed));
      const hasRequirementSignal = /\b(cgpa|gpa|b\.?tech|m\.?tech|b\.?e|mca|b\.?sc|intern|skills|tech\s+stack|requirements?|qualifications?|eligib|deadline|apply\s+by|cutoff|duration|weeks|months|resume|github|portfolio|marksheet|transcript|deliverable)\b/i.test(trimmed);

      if (isBoilerplateBody && !hasRequirementSignal) {
        continue;
      }

      essentialBlocks.push(trimmed);
    }

    const filtered = essentialBlocks.join('\n\n').trim();
    // If filtering was successful and retained essential content, return filtered; otherwise return original text
    return (filtered.length >= 30) ? filtered : text.trim();
  }

  return {
    extract,
    splitIntoSentences,
    parseDateFromSentence,
    filterEssentialOpportunityText,
    SKILL_KEYWORDS
  };
});
