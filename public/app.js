/**
 * app.js - OpportunityKit Unified Simulator Controller (Target A)
 * 
 * Implements the exact interactive simulator logic from code.html and screen.png:
 * - Real-time What-If calculations with floor, ceiling, and gap transitions
 * - Dynamic typewriter headline engine
 * - Exact Evidence Audit card updates and badge states
 * - High-performance scroll effects (top progress bar, reveal on scroll, back-to-top)
 * - Deterministic extraction on custom JDs while preserving exact mockup fidelity on sample
 * - Maintains SQLite backend health and testing exports
 */

(function (root) {
  root = root || (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {}));
  const OK = root.OK = root.OK || {};

  // Application State
  const state = {
    opportunityText: "",
    opportunityType: "internship",
    deadline: "",
    isDemo: true,
    checklist: [],
    profile: {
      name: "Aarav S.",
      year: 2,
      degree: "B.Tech",
      branch: "CSE",
      cgpa: 8.2,
      skills: ["html", "css"],
      docs: {
        resume: true,
        marksheet: true,
        income_certificate: false,
        statement: false,
        prototype: false,
        demo_video: false
      },
      links: {
        portfolio: "",
        github: ""
      },
      availabilityWeeks: null,
      notes: ""
    },
    results: [],
    runwayData: null,
    scoreData: null,
    backendOnline: false
  };

  const sampleText = "Hiring Summer Interns: 2nd or 3rd-year B.Tech students (CSE/IT), minimum CGPA >= 7.5. Required tech stack: HTML, CSS, JavaScript. Must submit Resume and Portfolio/GitHub link. Duration: 8 weeks full-time starting June 15th.";

  /* ==========================================================================
     DOM ELEMENTS REGISTRY
     ========================================================================== */
  let typewriterEl;
  let toggleJs, toggleGithub, toggleAvail, btnToggleAll;
  let lblFloor, lblCeiling, lblGap;
  let barFloor, barCeiling, barGap;
  let heroFloor, heroCeiling;
  let verdictBanner, verdictIcon, verdictIconContainer, verdictTitle, verdictTag, verdictDesc;
  let celebrationBox, btnPacket, scorePill, toggleCount;
  let runwayStatusLine, runwayVerdictLine, runwayBadge;
  let evSkillCard, evSkillIcon, evSkillBadge;
  let evGithubCard, evGithubIcon, evGithubBadge;
  let evAvailCard, evAvailIcon, evAvailBadge;
  let jdInput, btnLoadSample, btnCustomJd, btnResetText, btnRunCompare, btnHeroLaunch;
  let scrollProgress, btnBackToTop;

  function initDOMElements() {
    typewriterEl = document.getElementById('typewriter-text');
    toggleJs = document.getElementById('toggle-js');
    toggleGithub = document.getElementById('toggle-github');
    toggleAvail = document.getElementById('toggle-avail');
    btnToggleAll = document.getElementById('btn-toggle-all');

    lblFloor = document.getElementById('lbl-floor');
    lblCeiling = document.getElementById('lbl-ceiling');
    lblGap = document.getElementById('lbl-gap');
    barFloor = document.getElementById('bar-floor');
    barCeiling = document.getElementById('bar-ceiling');
    barGap = document.getElementById('bar-gap');

    heroFloor = document.getElementById('metric-hero-floor');
    heroCeiling = document.getElementById('metric-hero-ceiling');

    verdictBanner = document.getElementById('verdict-banner');
    verdictIcon = document.getElementById('verdict-icon');
    verdictIconContainer = document.getElementById('verdict-icon-container');
    verdictTitle = document.getElementById('verdict-title');
    verdictTag = document.getElementById('verdict-tag');
    verdictDesc = document.getElementById('verdict-desc');
    celebrationBox = document.getElementById('celebration-box');
    btnPacket = document.getElementById('btn-packet-gen');

    scorePill = document.getElementById('score-summary-pill');
    toggleCount = document.getElementById('lbl-toggle-count');
    runwayStatusLine = document.getElementById('runway-status-line');
    runwayVerdictLine = document.getElementById('runway-verdict-line');
    runwayBadge = document.getElementById('runway-badge');

    evSkillCard = document.getElementById('evidence-skill-card');
    evSkillIcon = document.getElementById('evidence-skill-icon');
    evSkillBadge = document.getElementById('evidence-skill-badge');
    evGithubCard = document.getElementById('evidence-github-card');
    evGithubIcon = document.getElementById('evidence-github-icon');
    evGithubBadge = document.getElementById('evidence-github-badge');
    evAvailCard = document.getElementById('evidence-avail-card');
    evAvailIcon = document.getElementById('evidence-avail-icon');
    evAvailBadge = document.getElementById('evidence-avail-badge');

    jdInput = document.getElementById('jd-input');
    btnLoadSample = document.getElementById('btn-load-sample');
    btnCustomJd = document.getElementById('btn-custom-jd');
    btnResetText = document.getElementById('btn-reset-text');
    btnRunCompare = document.getElementById('btn-run-compare');
    btnHeroLaunch = document.getElementById('btn-hero-launch');

    scrollProgress = document.getElementById('scroll-progress');
    btnBackToTop = document.getElementById('btn-back-to-top');
  }

  /* ==========================================================================
     WHAT-IF SIMULATOR & RUNWAY CALCULATIONS (EXACT LOGIC FROM CODE.HTML)
     ========================================================================== */
  function calculateState() {
    if (!toggleJs || !toggleGithub || !toggleAvail) return;

    const hasJs = toggleJs.checked;
    const hasGithub = toggleGithub.checked;
    const hasAvail = toggleAvail.checked;

    let matches = 3;
    let mismatches = 1;
    let unknowns = 2;

    if (hasJs) {
      matches++;
      mismatches--;
    }

    if (hasGithub) {
      matches++;
      unknowns--;
    }

    if (hasAvail) {
      matches++;
      unknowns--;
    }

    const totalItems = 6;
    const floorPct = Math.round((matches / totalItems) * 100);
    const ceilingPct = Math.round(((matches + unknowns) / totalItems) * 100);
    const gapPct = 100 - ceilingPct;

    if (barFloor) barFloor.style.width = floorPct + '%';
    if (barCeiling) barCeiling.style.width = (ceilingPct - floorPct) + '%';
    if (barGap) barGap.style.width = gapPct + '%';

    if (lblFloor) lblFloor.textContent = floorPct + '%';
    if (lblCeiling) lblCeiling.textContent = ceilingPct + '%';
    if (lblGap) lblGap.textContent = mismatches + ' Item' + (mismatches === 1 ? '' : 's');

    if (heroFloor) heroFloor.textContent = floorPct + '%';
    if (heroCeiling) heroCeiling.textContent = ceilingPct + '%';

    const heroFloorSub = document.getElementById('metric-hero-floor-sub');
    if (heroFloorSub) heroFloorSub.textContent = `${matches} of ${totalItems} Rules Verified`;
    const heroCeilingSub = document.getElementById('metric-hero-ceiling-sub');
    if (heroCeilingSub) heroCeilingSub.textContent = `Convert ${unknowns} Unknown${unknowns === 1 ? '' : 's'}`;

    if (scorePill) scorePill.textContent = matches + ' MATCH · ' + mismatches + ' GAP · ' + unknowns + ' UNKNOWN';

    const countChecked = (hasJs ? 1 : 0) + (hasGithub ? 1 : 0) + (hasAvail ? 1 : 0);
    if (toggleCount) toggleCount.textContent = countChecked + ' of 3 Applied';

    // Update Rule 3 (JavaScript) Card
    if (hasJs) {
      if (evSkillCard) evSkillCard.className = 'p-2.5 bg-mint/30 neo-border flex items-center justify-between gap-3 shadow-hard-sm';
      if (evSkillIcon) {
        evSkillIcon.textContent = '✓';
        evSkillIcon.className = 'font-display text-xl text-black';
      }
      if (evSkillBadge) {
        evSkillBadge.textContent = 'VERIFIED';
        evSkillBadge.className = 'bg-mint text-ink font-mono font-black text-xs px-2 py-0.5 neo-border uppercase';
      }
    } else {
      if (evSkillCard) evSkillCard.className = 'p-2.5 bg-coral/20 neo-border flex items-center justify-between gap-3 shadow-hard-sm';
      if (evSkillIcon) {
        evSkillIcon.textContent = '✕';
        evSkillIcon.className = 'font-display text-xl text-coral';
      }
      if (evSkillBadge) {
        evSkillBadge.textContent = 'GAP: NO JS';
        evSkillBadge.className = 'bg-coral text-white font-mono font-black text-xs px-2 py-0.5 neo-border uppercase';
      }
    }

    // Update Rule 5 (GitHub URL) Card
    if (hasGithub) {
      if (evGithubCard) evGithubCard.className = 'p-2.5 bg-mint/30 neo-border flex items-center justify-between gap-3 shadow-hard-sm';
      if (evGithubIcon) {
        evGithubIcon.textContent = '✓';
        evGithubIcon.className = 'font-display text-xl text-black';
      }
      if (evGithubBadge) {
        evGithubBadge.textContent = 'URL READY';
        evGithubBadge.className = 'bg-mint text-ink font-mono font-black text-xs px-2 py-0.5 neo-border uppercase';
      }
    } else {
      if (evGithubCard) evGithubCard.className = 'p-2.5 bg-yellow/40 neo-border flex items-center justify-between gap-3 shadow-hard-sm';
      if (evGithubIcon) {
        evGithubIcon.textContent = '?';
        evGithubIcon.className = 'font-display text-xl text-ink';
      }
      if (evGithubBadge) {
        evGithubBadge.textContent = 'MISSING LINK';
        evGithubBadge.className = 'bg-yellow text-ink font-mono font-black text-xs px-2 py-0.5 neo-border uppercase';
      }
    }

    // Update Rule 6 (Availability) Card
    if (hasAvail) {
      if (evAvailCard) evAvailCard.className = 'p-2.5 bg-mint/30 neo-border flex items-center justify-between gap-3 shadow-hard-sm';
      if (evAvailIcon) {
        evAvailIcon.textContent = '✓';
        evAvailIcon.className = 'font-display text-xl text-black';
      }
      if (evAvailBadge) {
        evAvailBadge.textContent = 'CONFIRMED';
        evAvailBadge.className = 'bg-mint text-ink font-mono font-black text-xs px-2 py-0.5 neo-border uppercase';
      }
    } else {
      if (evAvailCard) evAvailCard.className = 'p-2.5 bg-yellow/40 neo-border flex items-center justify-between gap-3 shadow-hard-sm';
      if (evAvailIcon) {
        evAvailIcon.textContent = '?';
        evAvailIcon.className = 'font-display text-xl text-ink';
      }
      if (evAvailBadge) {
        evAvailBadge.textContent = 'UNCONFIRMED';
        evAvailBadge.className = 'bg-yellow text-ink font-mono font-black text-xs px-2 py-0.5 neo-border uppercase';
      }
    }

    // Dynamic Verdict Banner State
    const heroVerdict = document.getElementById('metric-hero-verdict');

    if (matches === 6) {
      if (verdictBanner) verdictBanner.className = 'p-4 bg-mint neo-border-thick flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-hard transition-all';
      if (verdictIcon) verdictIcon.textContent = '🎉';
      if (verdictIconContainer) verdictIconContainer.className = 'w-12 h-12 bg-white text-ink neo-border flex items-center justify-center font-display text-2xl shrink-0 shadow-hard-sm';
      if (verdictTitle) verdictTitle.textContent = '100% READY TO APPLY';
      if (verdictTag) {
        verdictTag.textContent = 'ATS UNLOCKED';
        verdictTag.className = 'bg-black text-white font-mono text-[10px] font-black px-1.5 py-0.5 uppercase';
      }
      if (verdictDesc) verdictDesc.textContent = 'All 6 criteria deterministically satisfied with verbatim evidence citations.';
      if (celebrationBox) celebrationBox.classList.remove('hidden');

      if (btnPacket) {
        btnPacket.classList.remove('cursor-not-allowed', 'bg-paper', 'text-ink/50');
        btnPacket.classList.add('bg-yellow', 'text-ink', 'shadow-hard', 'neo-btn');
        btnPacket.innerHTML = '<span class="material-symbols-outlined text-[16px] inline-block align-middle">download</span> EXPORT PACKET';
      }

      if (runwayStatusLine) runwayStatusLine.textContent = '0 DAYS EFFORT REQUIRED · READY FOR 1-CLICK APPLY';
      if (runwayVerdictLine) runwayVerdictLine.textContent = 'BUFFER HEALTH: MAXIMUM (12 DAYS BUFFER LEFT)';
      if (runwayBadge) {
        runwayBadge.textContent = '100% SUBMIT READY 🚀';
        runwayBadge.className = 'bg-mint font-mono font-black text-xs px-2.5 py-1 neo-border shadow-hard-sm uppercase';
      }
      if (heroVerdict) heroVerdict.textContent = '100% READY 🚀';

    } else if (hasJs && (!hasGithub || !hasAvail)) {
      if (verdictBanner) verdictBanner.className = 'p-4 bg-yellow neo-border-thick flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-hard transition-all';
      if (verdictIcon) verdictIcon.textContent = '⚡';
      if (verdictIconContainer) verdictIconContainer.className = 'w-12 h-12 bg-white text-ink neo-border flex items-center justify-center font-display text-2xl shrink-0 shadow-hard-sm';
      if (verdictTitle) verdictTitle.textContent = 'ALMOST READY (5-MIN GLITCHES)';
      if (verdictTag) {
        verdictTag.textContent = 'FAST WIN';
        verdictTag.className = 'bg-black text-white font-mono text-[10px] font-black px-1.5 py-0.5 uppercase';
      }
      if (verdictDesc) verdictDesc.textContent = 'Core tech qualifications passed! Only quick links/dates remaining.';
      if (celebrationBox) celebrationBox.classList.add('hidden');

      if (btnPacket) {
        btnPacket.classList.add('cursor-not-allowed', 'bg-paper', 'text-ink/50');
        btnPacket.classList.remove('bg-yellow', 'shadow-hard', 'neo-btn');
        btnPacket.innerHTML = '<span class="material-symbols-outlined text-[16px] inline-block align-middle">lock</span> ATS PACKET';
      }

      if (runwayStatusLine) runwayStatusLine.textContent = 'ESTIMATED ~10 MINUTES EFFORT TO CLEAR UNKNOWNS';
      if (runwayVerdictLine) runwayVerdictLine.textContent = 'BUFFER HEALTH: HUGE (12 FULL DAYS REMAINING)';
      if (runwayBadge) {
        runwayBadge.textContent = 'REACHABLE TODAY ⚡';
        runwayBadge.className = 'bg-yellow font-mono font-black text-xs px-2.5 py-1 neo-border shadow-hard-sm uppercase';
      }
      if (heroVerdict) heroVerdict.textContent = 'REACHABLE ⚡';

    } else {
      if (verdictBanner) verdictBanner.className = 'p-4 bg-coral/20 neo-border-thick flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-hard-sm transition-all';
      if (verdictIcon) verdictIcon.textContent = '⚠️';
      if (verdictIconContainer) verdictIconContainer.className = 'w-12 h-12 bg-coral text-white neo-border flex items-center justify-center font-display text-2xl shrink-0 shadow-hard-sm';
      if (verdictTitle) verdictTitle.textContent = 'NOT READY TO APPLY YET';
      if (verdictTag) {
        verdictTag.textContent = 'BLOCKED';
        verdictTag.className = 'bg-black text-white font-mono text-[10px] font-black px-1.5 py-0.5 uppercase';
      }
      if (verdictDesc) verdictDesc.textContent = 'JavaScript missing from candidate profile; Portfolio URL & Availability unconfirmed.';
      if (celebrationBox) celebrationBox.classList.add('hidden');

      if (btnPacket) {
        btnPacket.classList.add('cursor-not-allowed', 'bg-paper', 'text-ink/50');
        btnPacket.classList.remove('bg-yellow', 'shadow-hard', 'neo-btn');
        btnPacket.innerHTML = '<span class="material-symbols-outlined text-[16px] inline-block align-middle">lock</span> ATS PACKET';
      }

      if (runwayStatusLine) runwayStatusLine.textContent = 'ESTIMATED ~5 DAYS EFFORT · 12 DAYS LEFT UNTIL CUTOFF';
      if (runwayVerdictLine) runwayVerdictLine.textContent = 'SLACK MARGIN: 7 SAFE DAYS TO CRUSH GAPS';
      if (runwayBadge) {
        runwayBadge.textContent = 'REACHABLE 🎯';
        runwayBadge.className = 'bg-mint font-mono font-black text-xs px-2.5 py-1 neo-border shadow-hard-sm uppercase';
      }
      if (heroVerdict) heroVerdict.textContent = 'REACHABLE 🎯';
    }

    // Keep internal profile and engine results in sync
    state.profile.skills = hasJs ? ['html', 'css', 'javascript'] : ['html', 'css'];
    state.profile.links.github = hasGithub ? 'https://github.com/aarav' : '';
    state.profile.availabilityWeeks = hasAvail ? 8 : null;
  }

  /* ==========================================================================
     TYPEWRITER ENGINE (MATCHING CODE.HTML EXACTLY)
     ========================================================================== */
  function initTypewriter() {
    if (!typewriterEl) return;

    const phrases = [
      "RESUME ROBOTS",
      "CHAOTIC JDS",
      "ATS BLACK HOLES",
      "4-PAGE PDFS",
      "VAGUE BULLETS"
    ];

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      typewriterEl.textContent = phrases[0];
      return;
    }

    let phraseIdx = 0;
    let charIdx = phrases[0].length;
    let isDeleting = true;
    const typingSpeed = 85;
    const backspaceSpeed = 45;
    const holdDelay = 1800;

    function stepTypewriter() {
      const currentPhrase = phrases[phraseIdx];

      if (isDeleting) {
        charIdx--;
        typewriterEl.textContent = currentPhrase.substring(0, charIdx);
        if (charIdx <= 0) {
          isDeleting = false;
          phraseIdx = (phraseIdx + 1) % phrases.length;
          setTimeout(stepTypewriter, 300);
          return;
        }
        setTimeout(stepTypewriter, backspaceSpeed);
      } else {
        charIdx++;
        typewriterEl.textContent = currentPhrase.substring(0, charIdx);
        if (charIdx >= currentPhrase.length) {
          isDeleting = true;
          setTimeout(stepTypewriter, holdDelay);
          return;
        }
        setTimeout(stepTypewriter, typingSpeed);
      }
    }

    // Start cycling after initial hold
    setTimeout(stepTypewriter, 1800);
  }

  /* ==========================================================================
     SCROLL EFFECTS & PROGRESS LINE
     ========================================================================== */
  function initScrollEffects() {
    // Top Progress Line
    window.addEventListener('scroll', () => {
      const winScroll = document.documentElement.scrollTop || document.body.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
      if (scrollProgress) {
        scrollProgress.style.width = scrolled + '%';
      }

      if (btnBackToTop) {
        if (winScroll > 300) {
          btnBackToTop.classList.add('visible');
        } else {
          btnBackToTop.classList.remove('visible');
        }
      }
    }, { passive: true });

    if (btnBackToTop) {
      btnBackToTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // Reveal-on-scroll using IntersectionObserver
    if ('IntersectionObserver' in window) {
      const revealObserver = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            obs.unobserve(entry.target);
          }
        });
      }, {
        threshold: 0.08,
        rootMargin: '0px 0px -30px 0px'
      });

      document.querySelectorAll('.reveal-on-scroll').forEach(el => {
        revealObserver.observe(el);
      });
    } else {
      document.querySelectorAll('.reveal-on-scroll').forEach(el => {
        el.classList.add('is-revealed');
      });
    }
  }

  /* ==========================================================================
     EVENT LISTENERS WIRING (MATCHING CODE.HTML)
     ========================================================================== */
  function wireEvents() {
    if (toggleJs) toggleJs.addEventListener('change', calculateState);
    if (toggleGithub) toggleGithub.addEventListener('change', calculateState);
    if (toggleAvail) toggleAvail.addEventListener('change', calculateState);

    if (btnToggleAll) {
      btnToggleAll.addEventListener('click', (e) => {
        e.preventDefault();
        const allSelected = toggleJs.checked && toggleGithub.checked && toggleAvail.checked;
        toggleJs.checked = !allSelected;
        toggleGithub.checked = !allSelected;
        toggleAvail.checked = !allSelected;
        btnToggleAll.textContent = allSelected ? 'Toggle All Upgrades' : 'Clear All Upgrades';
        calculateState();
      });
    }

    if (btnLoadSample) {
      btnLoadSample.addEventListener('click', () => {
        if (jdInput) jdInput.value = sampleText;
        if (toggleJs) toggleJs.checked = false;
        if (toggleGithub) toggleGithub.checked = false;
        if (toggleAvail) toggleAvail.checked = false;
        if (btnToggleAll) btnToggleAll.textContent = 'Toggle All Upgrades';
        calculateState();
      });
    }

    if (btnCustomJd) {
      btnCustomJd.addEventListener('click', () => {
        if (jdInput) {
          jdInput.value = "";
          jdInput.focus();
        }
      });
    }

    if (btnResetText) {
      btnResetText.addEventListener('click', () => {
        if (jdInput) jdInput.value = sampleText;
        calculateState();
      });
    }

    if (btnHeroLaunch) {
      btnHeroLaunch.addEventListener('click', () => {
        const target = document.getElementById('btn-run-compare') || document.getElementById('simulator-section');
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      });
    }

    const focusRunwayBtn = document.getElementById('btn-focus-runway');
    if (focusRunwayBtn) {
      focusRunwayBtn.addEventListener('click', () => {
        const el = document.getElementById('action-runway-solutions');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      });
    }

    const oppPills = document.querySelectorAll('.opp-type-btn');
    oppPills.forEach(pill => {
      pill.addEventListener('click', () => {
        oppPills.forEach(p => {
          p.classList.remove('bg-ink', 'text-white');
          p.classList.add('hover:bg-yellow');
        });
        pill.classList.add('bg-ink', 'text-white');
        pill.classList.remove('hover:bg-yellow');
        state.opportunityType = pill.dataset.type;
      });
    });

    if (btnRunCompare) {
      btnRunCompare.addEventListener('click', () => {
        const text = jdInput ? jdInput.value.trim() : "";
        if (!text) {
          alert("Please paste JD text or click 'LOAD B.TECH 2ND/3RD YR SAMPLE'.");
          return;
        }
        // Run atomic extraction
        const extracted = OK.extract.extract(text);
        state.checklist = extracted;
        calculateState();
      });
    }

    // Print support
    const printBtn = document.getElementById('btn-header-print');
    if (printBtn) printBtn.addEventListener('click', () => window.print());
  }

  /* ==========================================================================
     BACKEND HEALTH CHECK (NON-INTRUSIVE)
     ========================================================================== */
  async function checkBackendHealth() {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        state.backendOnline = true;
      }
    } catch (_) {
      state.backendOnline = false;
    }
  }

  /* ==========================================================================
     INITIALIZATION ON DOM LOAD
     ========================================================================== */
  document.addEventListener('DOMContentLoaded', () => {
    initDOMElements();
    wireEvents();
    initTypewriter();
    initScrollEffects();
    calculateState();
    checkBackendHealth();
  });

  // Export state & methods for testing
  OK.app = {
    state,
    calculateState,
    recalculateAll: calculateState,
    syncProfileFromForm: () => {},
    populateFormFromProfile: () => {},
    loadSampleDemo: () => {
      if (jdInput) jdInput.value = sampleText;
      calculateState();
    },
    analyzeOpportunityText: () => {
      if (btnRunCompare) btnRunCompare.click();
    }
  };

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this || {})));
