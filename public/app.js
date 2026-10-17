/**
 * app.js - Main Application Controller for OpportunityKit.
 * 
 * Neo-Brutalist Unified Simulator Controller:
 * Manages state, reactive recalculation, typewriter effect, scroll progress,
 * intersection observer reveals, candidate profile slide-out drawer,
 * in-memory document parsing, live what-if engine, and SQLite backend sync.
 */

(function (root) {
  root = root || (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {}));
  const OK = root.OK = root.OK || {};

  // Application State
  const state = {
    opportunityText: "",
    opportunityType: "internship",
    deadline: "",
    isDemo: false,
    checklist: [],
    profile: {
      name: "",
      year: null,
      degree: "",
      branch: "",
      cgpa: null,
      skills: [],
      docs: {
        resume: false,
        marksheet: false,
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
    backendOnline: false,
    pendingResumeSuggestions: null
  };

  /* ==========================================================================
     DOM ELEMENTS REGISTRY
     ========================================================================== */
  const el = {};

  function initDOMElements() {
    // Top & Hero Controls
    el.scrollProgress = document.getElementById('scroll-progress');
    el.typewriterText = document.getElementById('typewriter-text');
    el.btnHeroLaunch = document.getElementById('btn-hero-launch');
    el.btnLoadSample = document.getElementById('btn-load-sample');
    el.btnCustomJd = document.getElementById('btn-custom-jd');
    el.btnHeaderPrint = document.getElementById('btn-header-print');
    el.btnBackToTop = document.getElementById('btn-back-to-top');

    // Hero HUD Metrics
    el.metricHeroFloor = document.getElementById('metric-hero-floor');
    el.metricHeroFloorSub = document.getElementById('metric-hero-floor-sub');
    el.metricHeroCeiling = document.getElementById('metric-hero-ceiling');
    el.metricHeroCeilingSub = document.getElementById('metric-hero-ceiling-sub');
    el.metricHeroSprint = document.getElementById('metric-hero-sprint');
    el.metricHeroSprintSub = document.getElementById('metric-hero-sprint-sub');
    el.metricHeroVerdict = document.getElementById('metric-hero-verdict');

    // Screen 1: Raw Post & Candidate Snapshot
    el.jdInput = document.getElementById('jd-input');
    el.btnResetText = document.getElementById('btn-reset-text');
    el.btnFocusEssential = document.getElementById('btn-focus-essential');
    el.oppFileInput = document.getElementById('opp-file-input');
    el.btnUploadOppFile = document.getElementById('btn-upload-opp-file');
    el.oppFileStatus = document.getElementById('opp-file-status');
    el.candidateSnapshotName = document.getElementById('candidate-snapshot-name');
    el.candidateSnapshotCgpa = document.getElementById('candidate-snapshot-cgpa');
    el.btnSnapshotEditProfile = document.getElementById('btn-snapshot-edit-profile');
    el.btnRunCompare = document.getElementById('btn-run-compare');
    el.simulatorTargetBadge = document.getElementById('simulator-target-badge');

    // Screen 2: Checklist & Rules
    el.rulesCountPill = document.getElementById('rules-count-pill');
    el.checklistCardsContainer = document.getElementById('checklist-cards-container');
    el.btnAddReqModal = document.getElementById('btn-add-req-modal');

    // Screen 3: Verdict & Runway
    el.verdictBanner = document.getElementById('verdict-banner');
    el.verdictIcon = document.getElementById('verdict-icon');
    el.verdictIconContainer = document.getElementById('verdict-icon-container');
    el.verdictTitle = document.getElementById('verdict-title');
    el.verdictTag = document.getElementById('verdict-tag');
    el.verdictDesc = document.getElementById('verdict-desc');
    el.btnPacketGen = document.getElementById('btn-packet-gen');

    el.scoreSummaryPill = document.getElementById('score-summary-pill');
    el.barFloor = document.getElementById('bar-floor');
    el.barCeiling = document.getElementById('bar-ceiling');
    el.barGap = document.getElementById('bar-gap');
    el.lblFloor = document.getElementById('lbl-floor');
    el.lblCeiling = document.getElementById('lbl-ceiling');
    el.lblGap = document.getElementById('lbl-gap');

    el.runwayStatusLine = document.getElementById('runway-status-line');
    el.runwayVerdictLine = document.getElementById('runway-verdict-line');
    el.runwayBadge = document.getElementById('runway-badge');

    // Screen 4: Tactile Cheat Codes (What-If Toggles)
    el.toggleJs = document.getElementById('toggle-js');
    el.toggleGithub = document.getElementById('toggle-github');
    el.toggleAvail = document.getElementById('toggle-avail');
    el.celebrationBox = document.getElementById('celebration-box');
    el.btnToggleAll = document.getElementById('btn-toggle-all');
    el.lblToggleCount = document.getElementById('lbl-toggle-count');

    // Evidence Audit Specific Card Elements (for instant sample feedback)
    el.evSkillIcon = document.getElementById('evidence-skill-icon');
    el.evSkillBadge = document.getElementById('evidence-skill-badge');
    el.evGithubIcon = document.getElementById('evidence-github-icon');
    el.evGithubBadge = document.getElementById('evidence-github-badge');
    el.evAvailIcon = document.getElementById('evidence-avail-icon');
    el.evAvailBadge = document.getElementById('evidence-avail-badge');

    // Profile Drawer Elements
    el.profileDrawerBackdrop = document.getElementById('profile-drawer-backdrop');
    el.btnOpenProfileDrawer = document.getElementById('btn-open-profile-drawer');
    el.btnCloseProfileDrawer = document.getElementById('btn-close-profile-drawer');
    el.backendStatusText = document.getElementById('backend-status-text');
    el.backendStatusIndicator = document.getElementById('backend-status-indicator');
    el.profileSaveIndicator = document.getElementById('profile-save-indicator');

    el.profName = document.getElementById('prof-name');
    el.profYear = document.getElementById('prof-year');
    el.profDegree = document.getElementById('prof-degree');
    el.profBranch = document.getElementById('prof-branch');
    el.profCgpa = document.getElementById('prof-cgpa');
    el.cgpaValidationMsg = document.getElementById('cgpa-validation-msg');
    el.profAvailability = document.getElementById('prof-availability');
    el.oppDeadline = document.getElementById('opp-deadline');
    el.profSkills = document.getElementById('prof-skills');
    el.profLinkPortfolio = document.getElementById('prof-link-portfolio');
    el.profLinkGithub = document.getElementById('prof-link-github');

    el.profDocResume = document.getElementById('prof-doc-resume');
    el.profDocMarksheet = document.getElementById('prof-doc-marksheet');
    el.profDocIncome = document.getElementById('prof-doc-income');
    el.profDocStatement = document.getElementById('prof-doc-statement');
    el.profDocPrototype = document.getElementById('prof-doc-prototype');
    el.profDocVideo = document.getElementById('prof-doc-video');

    el.btnProfileSave = document.getElementById('btn-profile-save');
    el.btnProfileSample = document.getElementById('btn-profile-sample');
    el.btnProfileClear = document.getElementById('btn-profile-clear');

    // Resume Upload in Drawer
    el.resumeFileInput = document.getElementById('resume-file-input');
    el.btnTriggerUpload = document.getElementById('btn-trigger-upload');
    el.uploadStatusText = document.getElementById('upload-status-text');

    // Modals
    el.modalAddReq = document.getElementById('modal-add-req');
    el.btnCloseAddModal = document.getElementById('btn-close-add-modal');
    el.btnCancelAddModal = document.getElementById('btn-cancel-add-modal');
    el.btnSaveNewReq = document.getElementById('btn-save-new-req');
    el.newReqLabel = document.getElementById('new-req-label');
    el.newReqCategory = document.getElementById('new-req-category');
    el.newReqEffort = document.getElementById('new-req-effort');
    el.newReqEvidence = document.getElementById('new-req-evidence');

    el.modalResumeReview = document.getElementById('modal-resume-review');
    el.btnCloseResumeModal = document.getElementById('btn-close-resume-modal');
    el.btnRejectResume = document.getElementById('btn-reject-resume');
    el.btnAcceptResume = document.getElementById('btn-accept-resume');
    el.resumeSuggestionsList = document.getElementById('resume-suggestions-list');

    el.btnFocusRunway = document.getElementById('btn-focus-runway');
  }

  /* ==========================================================================
     CORE RECALCULATION & COMPARISON (LIVE WHAT-IF ENGINE)
     ========================================================================== */
  function recalculateAll() {
    // 1. Read profile from form inputs
    syncProfileFromForm();

    // 2. Read deadline from form input
    state.deadline = el.oppDeadline && el.oppDeadline.value ? el.oppDeadline.value.trim() : null;

    // 3. Evaluate each active requirement against candidate profile
    state.results = state.checklist.map(item => {
      const res = OK.compare.compare(item, state.profile);
      res.active = item.active !== false;
      return res;
    });

    // 4. Calculate Deadline Runway
    state.runwayData = OK.effort.runway(state.results, state.deadline);

    // 5. Calculate Score and Verdict
    state.scoreData = OK.score.score(state.results, state.runwayData);
    const verdictCode = OK.score.verdict(state.results);
    state.scoreData.verdictCode = verdictCode;
    state.scoreData.verdictDetails = OK.score.verdictDetails(verdictCode);

    // 6. Update all UI representations
    updateCandidateSnapshot();
    renderChecklistCards();
    renderVerdictAndRunway();
    syncWhatIfToggles();
  }

  /* ==========================================================================
     CANDIDATE SNAPSHOT & PROFILE SYNC
     ========================================================================== */
  function updateCandidateSnapshot() {
    const p = state.profile;
    const name = p.name ? p.name : "Candidate";
    const yearStr = p.year ? `B.Tech ${p.year}${p.year === 1 ? 'st' : p.year === 2 ? 'nd' : p.year === 3 ? 'rd' : 'th'} Yr` : "Year Unset";
    
    if (el.candidateSnapshotName) {
      el.candidateSnapshotName.textContent = `${name} (${yearStr})`;
    }

    if (el.candidateSnapshotCgpa) {
      if (p.cgpa !== null && p.cgpa !== undefined && p.cgpa !== '') {
        const passStatus = parseFloat(p.cgpa) >= 7.5 ? '[PASS]' : '[GAP]';
        el.candidateSnapshotCgpa.textContent = `${p.cgpa} / 10 CGPA ${passStatus}`;
        el.candidateSnapshotCgpa.className = parseFloat(p.cgpa) >= 7.5 ? 'font-mono text-xs font-black text-mint-dark' : 'font-mono text-xs font-black text-coral';
      } else {
        el.candidateSnapshotCgpa.textContent = 'CGPA Not Provided';
        el.candidateSnapshotCgpa.className = 'font-mono text-xs font-black text-ink/60';
      }
    }
  }

  function syncProfileFromForm() {
    state.profile.name = el.profName ? el.profName.value.trim() : "";
    state.profile.year = el.profYear && el.profYear.value ? parseInt(el.profYear.value, 10) : null;
    state.profile.degree = el.profDegree ? el.profDegree.value.trim() : "";
    state.profile.branch = el.profBranch ? el.profBranch.value.trim() : "";

    const cgpaVal = el.profCgpa ? el.profCgpa.value.trim() : "";
    if (cgpaVal !== "") {
      const parsed = parseFloat(cgpaVal);
      if (!isNaN(parsed)) {
        if (parsed > 10) {
          if (el.cgpaValidationMsg) {
            el.cgpaValidationMsg.textContent = "CGPA must be on 0–10 scale.";
            el.cgpaValidationMsg.classList.remove('hidden');
          }
        } else {
          if (el.cgpaValidationMsg) el.cgpaValidationMsg.classList.add('hidden');
          state.profile.cgpa = parsed;
        }
      }
    } else {
      state.profile.cgpa = null;
      if (el.cgpaValidationMsg) el.cgpaValidationMsg.classList.add('hidden');
    }

    const availVal = el.profAvailability ? el.profAvailability.value.trim() : "";
    state.profile.availabilityWeeks = availVal !== "" ? parseInt(availVal, 10) : null;

    if (el.profSkills) {
      const rawSkills = el.profSkills.value.split(',').map(s => s.trim()).filter(s => s.length > 0);
      state.profile.skills = rawSkills.map(OK.compare.normalize);
    }

    state.profile.links = {
      portfolio: el.profLinkPortfolio ? el.profLinkPortfolio.value.trim() : "",
      github: el.profLinkGithub ? el.profLinkGithub.value.trim() : ""
    };

    state.profile.docs = {
      resume: el.profDocResume ? el.profDocResume.checked : false,
      marksheet: el.profDocMarksheet ? el.profDocMarksheet.checked : false,
      income_certificate: el.profDocIncome ? el.profDocIncome.checked : false,
      statement: el.profDocStatement ? el.profDocStatement.checked : false,
      prototype: el.profDocPrototype ? el.profDocPrototype.checked : false,
      demo_video: el.profDocVideo ? el.profDocVideo.checked : false
    };
  }

  function populateFormFromProfile(p) {
    if (!p) return;
    if (el.profName) el.profName.value = p.name || "";
    if (el.profYear) el.profYear.value = p.year !== null && p.year !== undefined ? String(p.year) : "";
    if (el.profDegree) el.profDegree.value = p.degree || "";
    if (el.profBranch) el.profBranch.value = p.branch || "";
    if (el.profCgpa) el.profCgpa.value = p.cgpa !== null && p.cgpa !== undefined ? String(p.cgpa) : "";
    if (el.profAvailability) el.profAvailability.value = p.availabilityWeeks !== null && p.availabilityWeeks !== undefined ? String(p.availabilityWeeks) : "";

    if (el.profSkills) {
      el.profSkills.value = Array.isArray(p.skills) ? p.skills.join(', ') : "";
    }

    if (el.profLinkPortfolio) el.profLinkPortfolio.value = (p.links && p.links.portfolio) || "";
    if (el.profLinkGithub) el.profLinkGithub.value = (p.links && p.links.github) || "";

    if (p.docs) {
      if (el.profDocResume) el.profDocResume.checked = !!p.docs.resume;
      if (el.profDocMarksheet) el.profDocMarksheet.checked = !!p.docs.marksheet;
      if (el.profDocIncome) el.profDocIncome.checked = !!p.docs.income_certificate;
      if (el.profDocStatement) el.profDocStatement.checked = !!p.docs.statement;
      if (el.profDocPrototype) el.profDocPrototype.checked = !!p.docs.prototype;
      if (el.profDocVideo) el.profDocVideo.checked = !!p.docs.demo_video;
    }
  }

  /* ==========================================================================
     CHECKLIST & AUDIT RENDERING
     ========================================================================== */
  function renderChecklistCards() {
    if (!el.checklistCardsContainer) return;
    el.checklistCardsContainer.innerHTML = '';
    const items = state.checklist;

    if (el.rulesCountPill) {
      el.rulesCountPill.textContent = `${items.length} HARD RULE${items.length === 1 ? '' : 'S'}`;
    }

    if (!items || items.length === 0) {
      el.checklistCardsContainer.innerHTML = `
        <div class="p-4 bg-paper neo-border text-center font-mono text-xs font-bold text-ink/70">
          No criteria detected yet. Paste opportunity text or click 'Load Sample'.
        </div>
      `;
      return;
    }

    state.results.forEach((res, index) => {
      const disp = OK.compare.displayStatus(res);
      const item = state.checklist[index] || {};

      let icon = '✓';
      let iconColorClass = 'text-black';
      let cardBgClass = 'bg-mint/30';
      let badgeBgClass = 'bg-mint text-ink';

      if (disp.label === 'MATCH') {
        icon = '✓';
        iconColorClass = 'text-black';
        cardBgClass = 'bg-mint/30';
        badgeBgClass = 'bg-mint text-ink font-mono font-black text-xs px-2 py-0.5 neo-border uppercase';
      } else if (disp.label === 'WORK NEEDED' || disp.label === 'GAP') {
        icon = '✕';
        iconColorClass = 'text-coral';
        cardBgClass = 'bg-coral/20';
        badgeBgClass = 'bg-coral text-white font-mono font-black text-xs px-2 py-0.5 neo-border uppercase';
      } else if (disp.label === 'MISSING INFO' || disp.label === 'MISSING') {
        icon = '?';
        iconColorClass = 'text-ink';
        cardBgClass = 'bg-yellow/40';
        badgeBgClass = 'bg-yellow text-ink font-mono font-black text-xs px-2 py-0.5 neo-border uppercase';
      } else if (disp.isLocked) {
        icon = '🔒';
        iconColorClass = 'text-coral';
        cardBgClass = 'bg-coral/30';
        badgeBgClass = 'bg-black text-white font-mono font-black text-xs px-2 py-0.5 neo-border uppercase';
      }

      let displayVal = item.value;
      if (Array.isArray(displayVal)) displayVal = displayVal.join(', ');
      else if (displayVal === true) displayVal = 'Required';

      const card = document.createElement('div');
      card.className = `p-2.5 ${cardBgClass} neo-border flex items-center justify-between gap-3 shadow-hard-sm`;

      card.innerHTML = `
        <div class="flex items-center gap-2.5 flex-1 min-w-0">
          <span class="font-display text-xl ${iconColorClass} shrink-0">${icon}</span>
          <div class="min-w-0">
            <span class="font-mono text-xs font-black uppercase">${escapeHtml(res.label || res.field)}:</span>
            <span class="font-mono text-xs ml-1 bg-white px-1.5 py-0.5 neo-border inline-block">${escapeHtml(String(displayVal || ''))}</span>
            <p class="font-mono text-[11px] text-ink/70 italic truncate">
              ${item.evidence ? `Evidence: "${escapeHtml(item.evidence)}"` : escapeHtml(res.reason || 'Criteria requirement')}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span class="${badgeBgClass}">${escapeHtml(disp.label)}</span>
          <button type="button" class="btn-delete-req font-mono text-[11px] font-black hover:text-coral px-1" data-index="${index}" title="Remove rule">
            ✕
          </button>
        </div>
      `;

      el.checklistCardsContainer.appendChild(card);
    });

    // Wire delete rule handlers
    el.checklistCardsContainer.querySelectorAll('.btn-delete-req').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.index, 10);
        state.checklist.splice(idx, 1);
        recalculateAll();
      });
    });
  }

  /* ==========================================================================
     VERDICT & RUNWAY RENDERING
     ========================================================================== */
  function renderVerdictAndRunway() {
    const s = state.scoreData;
    const rw = state.runwayData;
    if (!s) return;

    // Mini HUD updates
    if (el.metricHeroFloor) el.metricHeroFloor.textContent = `${s.floor}%`;
    if (el.metricHeroFloorSub) el.metricHeroFloorSub.textContent = `${s.matches} of ${s.total} Rules Verified`;
    if (el.metricHeroCeiling) el.metricHeroCeiling.textContent = `${s.ceiling}%`;
    if (el.metricHeroCeilingSub) el.metricHeroCeilingSub.textContent = `Convert ${s.missing} Unknowns`;

    const daysNeeded = rw ? rw.daysNeeded : 5;
    const daysLeft = rw && rw.daysLeft !== null ? rw.daysLeft : 12;
    if (el.metricHeroSprint) el.metricHeroSprint.textContent = `${daysNeeded} DAYS`;
    if (el.metricHeroSprintSub) el.metricHeroSprintSub.textContent = `vs ${daysLeft} Day Deadline`;

    // Verdict Badge in HUD
    let hudVerdict = "REACHABLE 🎯";
    if (s.total === 0) hudVerdict = "NO CRITERIA 📋";
    else if (s.floor === 100 && s.total > 0) hudVerdict = "100% READY 🚀";
    else if (s.verdictCode === 'skip') hudVerdict = "BLOCKED 🔒";
    else if (s.verdictCode === 'caution') hudVerdict = "CAUTION ⚠️";
    else if (mismatchCount === 0 && s.missing > 0) hudVerdict = "ALMOST READY ⚡";
    else hudVerdict = "WORK NEEDED ⚠️";
    if (el.metricHeroVerdict) el.metricHeroVerdict.textContent = hudVerdict;

    // Segmented Runway Bar
    const gapPct = s.total > 0 ? 100 - s.ceiling : 0;
    const unknownPct = s.total > 0 ? s.ceiling - s.floor : 0;
    if (el.barFloor) el.barFloor.style.width = `${s.floor}%`;
    if (el.barCeiling) el.barCeiling.style.width = `${unknownPct}%`;
    if (el.barGap) el.barGap.style.width = `${gapPct}%`;

    if (el.lblFloor) el.lblFloor.textContent = `${s.floor}%`;
    if (el.lblCeiling) el.lblCeiling.textContent = `${s.ceiling}%`;
    const mismatchCount = state.results.filter(r => r.status === 'MISMATCH').length;
    if (el.lblGap) el.lblGap.textContent = `${mismatchCount} Item${mismatchCount === 1 ? '' : 's'}`;

    if (el.scoreSummaryPill) {
      if (s.total === 0) {
        el.scoreSummaryPill.textContent = "0 REQUIREMENTS TRACKED";
      } else {
        el.scoreSummaryPill.textContent = `${s.matches} MATCH · ${mismatchCount} GAP · ${s.missing} UNKNOWN`;
      }
    }

    // Dynamic Verdict Alert Box
    if (s.total === 0) {
      if (el.verdictBanner) el.verdictBanner.className = 'p-4 bg-paper neo-border-thick flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-hard-sm transition-all';
      if (el.verdictIcon) el.verdictIcon.textContent = '📋';
      if (el.verdictIconContainer) el.verdictIconContainer.className = 'w-12 h-12 bg-white text-ink neo-border flex items-center justify-center font-display text-2xl shrink-0 shadow-hard-sm';
      if (el.verdictTitle) el.verdictTitle.textContent = 'NO CRITERIA DETECTED YET';
      if (el.verdictTag) {
        el.verdictTag.textContent = 'EMPTY';
        el.verdictTag.className = 'bg-ink text-white font-mono text-[10px] font-black px-1.5 py-0.5 uppercase';
      }
      if (el.verdictDesc) el.verdictDesc.textContent = 'Paste opportunity text or upload a document to automatically extract and verify eligibility criteria.';
      if (el.celebrationBox) el.celebrationBox.classList.add('hidden');

      if (el.btnPacketGen) {
        el.btnPacketGen.classList.add('cursor-not-allowed', 'bg-paper', 'text-ink/50');
        el.btnPacketGen.classList.remove('bg-yellow', 'shadow-hard', 'neo-btn');
        el.btnPacketGen.innerHTML = '<span class="material-symbols-outlined text-[16px] inline-block align-middle">lock</span> ATS PACKET';
      }

      if (el.runwayStatusLine) el.runwayStatusLine.textContent = 'NO ACTIVE REQUIREMENTS DETECTED';
      if (el.runwayVerdictLine) el.runwayVerdictLine.textContent = 'PASTE A JOB/INTERNSHIP DESCRIPTION TO CALCULATE RUNWAY';
      if (el.runwayBadge) {
        el.runwayBadge.textContent = 'EMPTY CRITERIA';
        el.runwayBadge.className = 'bg-paper font-mono font-black text-xs px-2.5 py-1 neo-border shadow-hard-sm uppercase';
      }
    } else if (s.floor === 100 && s.total > 0) {
      if (el.verdictBanner) el.verdictBanner.className = 'p-4 bg-mint neo-border-thick flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-hard transition-all';
      if (el.verdictIcon) el.verdictIcon.textContent = '🎉';
      if (el.verdictIconContainer) el.verdictIconContainer.className = 'w-12 h-12 bg-white text-ink neo-border flex items-center justify-center font-display text-2xl shrink-0 shadow-hard-sm';
      if (el.verdictTitle) el.verdictTitle.textContent = '100% READY TO APPLY';
      if (el.verdictTag) {
        el.verdictTag.textContent = 'ATS UNLOCKED';
        el.verdictTag.className = 'bg-black text-white font-mono text-[10px] font-black px-1.5 py-0.5 uppercase';
      }
      if (el.verdictDesc) el.verdictDesc.textContent = `All ${s.total} criteria deterministically verified and satisfied with exact citations.`;
      if (el.celebrationBox) el.celebrationBox.classList.remove('hidden');

      if (el.btnPacketGen) {
        el.btnPacketGen.classList.remove('cursor-not-allowed', 'bg-paper', 'text-ink/50');
        el.btnPacketGen.classList.add('bg-yellow', 'text-ink', 'shadow-hard', 'neo-btn');
        el.btnPacketGen.innerHTML = '<span class="material-symbols-outlined text-[16px] inline-block align-middle">download</span> EXPORT PACKET';
      }

      if (el.runwayStatusLine) el.runwayStatusLine.textContent = '0 DAYS EFFORT REQUIRED · READY FOR 1-CLICK APPLY';
      if (el.runwayVerdictLine) el.runwayVerdictLine.textContent = `BUFFER HEALTH: MAXIMUM (${daysLeft} DAYS BUFFER LEFT)`;
      if (el.runwayBadge) {
        el.runwayBadge.textContent = '100% SUBMIT READY 🚀';
        el.runwayBadge.className = 'bg-mint font-mono font-black text-xs px-2.5 py-1 neo-border shadow-hard-sm uppercase';
      }
    } else if (mismatchCount === 0 && s.missing > 0) {
      if (el.verdictBanner) el.verdictBanner.className = 'p-4 bg-yellow neo-border-thick flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-hard transition-all';
      if (el.verdictIcon) el.verdictIcon.textContent = '⚡';
      if (el.verdictIconContainer) el.verdictIconContainer.className = 'w-12 h-12 bg-white text-ink neo-border flex items-center justify-center font-display text-2xl shrink-0 shadow-hard-sm';
      if (el.verdictTitle) el.verdictTitle.textContent = `ALMOST READY (${s.missing} UNCONFIRMED)`;
      if (el.verdictTag) {
        el.verdictTag.textContent = 'FAST WIN';
        el.verdictTag.className = 'bg-black text-white font-mono text-[10px] font-black px-1.5 py-0.5 uppercase';
      }

      const missingLabels = state.results.filter(r => r.status === 'MISSING_INFO').map(r => r.label || r.field);
      if (el.verdictDesc) el.verdictDesc.textContent = `Confirmed items match! Need confirmation for: ${missingLabels.slice(0, 3).join(', ')}${missingLabels.length > 3 ? '...' : ''}.`;
      if (el.celebrationBox) el.celebrationBox.classList.add('hidden');

      if (el.btnPacketGen) {
        el.btnPacketGen.classList.add('cursor-not-allowed', 'bg-paper', 'text-ink/50');
        el.btnPacketGen.classList.remove('bg-yellow', 'shadow-hard', 'neo-btn');
        el.btnPacketGen.innerHTML = '<span class="material-symbols-outlined text-[16px] inline-block align-middle">lock</span> ATS PACKET';
      }

      if (el.runwayStatusLine) el.runwayStatusLine.textContent = `ESTIMATED ~${daysNeeded > 0 ? daysNeeded + ' DAYS' : '10 MINUTES'} EFFORT TO CLEAR UNKNOWNS`;
      if (el.runwayVerdictLine) el.runwayVerdictLine.textContent = `BUFFER HEALTH: GOOD (${daysLeft} FULL DAYS REMAINING)`;
      if (el.runwayBadge) {
        el.runwayBadge.textContent = 'REACHABLE TODAY ⚡';
        el.runwayBadge.className = 'bg-yellow font-mono font-black text-xs px-2.5 py-1 neo-border shadow-hard-sm uppercase';
      }
    } else {
      if (el.verdictBanner) el.verdictBanner.className = 'p-4 bg-coral/20 neo-border-thick flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-hard-sm transition-all';
      if (el.verdictIcon) el.verdictIcon.textContent = '⚠️';
      if (el.verdictIconContainer) el.verdictIconContainer.className = 'w-12 h-12 bg-coral text-white neo-border flex items-center justify-center font-display text-2xl shrink-0 shadow-hard-sm';
      if (el.verdictTitle) el.verdictTitle.textContent = s.verdictCode === 'skip' ? 'BLOCKED — NOT ELIGIBLE' : 'NOT READY TO APPLY YET';
      if (el.verdictTag) {
        el.verdictTag.textContent = s.verdictCode === 'skip' ? 'BLOCKED' : 'ACTION REQ';
        el.verdictTag.className = 'bg-black text-white font-mono text-[10px] font-black px-1.5 py-0.5 uppercase';
      }

      // Dynamic specific gap breakdown
      const gapSummaries = state.results.filter(r => r.status === 'MISMATCH').map(r => r.reason);
      if (el.verdictDesc) {
        el.verdictDesc.textContent = gapSummaries.length > 0 ? gapSummaries.slice(0, 2).join('; ') : (s.verdictDetails ? s.verdictDetails.description : 'Identified criteria gaps require remediation.');
      }
      if (el.celebrationBox) el.celebrationBox.classList.add('hidden');

      if (el.btnPacketGen) {
        el.btnPacketGen.classList.add('cursor-not-allowed', 'bg-paper', 'text-ink/50');
        el.btnPacketGen.classList.remove('bg-yellow', 'shadow-hard', 'neo-btn');
        el.btnPacketGen.innerHTML = '<span class="material-symbols-outlined text-[16px] inline-block align-middle">lock</span> ATS PACKET';
      }

      const slack = daysLeft !== null ? daysLeft - daysNeeded : null;
      if (el.runwayStatusLine) el.runwayStatusLine.textContent = `ESTIMATED ~${daysNeeded} DAYS EFFORT · ${daysLeft !== null ? `${daysLeft} DAYS LEFT UNTIL CUTOFF` : 'NO CUTOFF SET'}`;
      if (el.runwayVerdictLine) el.runwayVerdictLine.textContent = slack !== null && slack >= 0 ? `SLACK MARGIN: ${slack} SAFE DAYS TO CRUSH GAPS` : 'DEADLINE TIGHT: IMMEDIATE SPRINT REQUIRED';
      if (el.runwayBadge) {
        el.runwayBadge.textContent = rw && rw.reachable ? 'REACHABLE 🎯' : 'RISK: SHORT RUNWAY';
        el.runwayBadge.className = rw && rw.reachable ? 'bg-mint font-mono font-black text-xs px-2.5 py-1 neo-border shadow-hard-sm uppercase' : 'bg-coral text-white font-mono font-black text-xs px-2.5 py-1 neo-border shadow-hard-sm uppercase';
      }
    }
  }

  /* ==========================================================================
     WHAT-IF TACTILE UPGRADE ENGINE
     ========================================================================== */
  function syncWhatIfToggles() {
    const hasJs = state.profile.skills && state.profile.skills.some(s => s.toLowerCase() === 'javascript' || s.toLowerCase() === 'js');
    const hasGithub = !!(state.profile.links && state.profile.links.github);
    const hasAvail = state.profile.availabilityWeeks !== null && state.profile.availabilityWeeks >= 8;

    if (el.toggleJs) el.toggleJs.checked = hasJs;
    if (el.toggleGithub) el.toggleGithub.checked = hasGithub;
    if (el.toggleAvail) el.toggleAvail.checked = hasAvail;

    const count = (hasJs ? 1 : 0) + (hasGithub ? 1 : 0) + (hasAvail ? 1 : 0);
    if (el.lblToggleCount) el.lblToggleCount.textContent = `${count} of 3 Applied`;
  }

  function handleWhatIfToggleChange() {
    const p = state.profile;
    
    // JS skill toggle
    if (el.toggleJs) {
      const skills = (p.skills || []).map(OK.compare.normalize);
      const filtered = skills.filter(s => s.toLowerCase() !== 'javascript');
      if (el.toggleJs.checked) {
        filtered.push('JavaScript');
      }
      p.skills = filtered;
      if (el.profSkills) el.profSkills.value = p.skills.join(', ');
    }

    // GitHub URL toggle
    if (el.toggleGithub) {
      p.links = p.links || {};
      p.links.github = el.toggleGithub.checked ? 'https://github.com/alex-sharma' : '';
      if (el.profLinkGithub) el.profLinkGithub.value = p.links.github;
    }

    // Availability toggle
    if (el.toggleAvail) {
      p.availabilityWeeks = el.toggleAvail.checked ? 8 : null;
      if (el.profAvailability) el.profAvailability.value = p.availabilityWeeks !== null ? '8' : '';
    }

    recalculateAll();
  }

  /* ==========================================================================
     TYPEWRITER ANIMATION ENGINE
     ========================================================================== */
  function initTypewriter() {
    if (!el.typewriterText) return;

    const phrases = [
      "CHAOTIC JDS",
      "RESUME ROBOTS",
      "ATS BLACK HOLES",
      "4-PAGE PDFS",
      "VAGUE BULLETS"
    ];

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      el.typewriterText.textContent = phrases[0];
      return;
    }

    let phraseIdx = 0;
    let charIdx = phrases[0].length;
    let isDeleting = true;
    const typingSpeed = 80;
    const backspaceSpeed = 40;
    const holdDelay = 1800;

    function step() {
      const current = phrases[phraseIdx];

      if (isDeleting) {
        charIdx--;
        el.typewriterText.textContent = current.substring(0, charIdx);
        if (charIdx <= 0) {
          isDeleting = false;
          phraseIdx = (phraseIdx + 1) % phrases.length;
          setTimeout(step, 300);
          return;
        }
        setTimeout(step, backspaceSpeed);
      } else {
        charIdx++;
        el.typewriterText.textContent = current.substring(0, charIdx);
        if (charIdx >= current.length) {
          isDeleting = true;
          setTimeout(step, holdDelay);
          return;
        }
        setTimeout(step, typingSpeed);
      }
    }

    setTimeout(step, 1800);
  }

  /* ==========================================================================
     SCROLL EFFECTS & OBSERVER REVEAL
     ========================================================================== */
  function initScrollEffects() {
    // Top Progress Line
    window.addEventListener('scroll', () => {
      const winScroll = document.documentElement.scrollTop || document.body.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
      if (el.scrollProgress) {
        el.scrollProgress.style.width = `${scrolled}%`;
      }

      // Back to top visibility
      if (el.btnBackToTop) {
        if (winScroll > 320) {
          el.btnBackToTop.classList.add('visible');
        } else {
          el.btnBackToTop.classList.remove('visible');
        }
      }
    }, { passive: true });

    if (el.btnBackToTop) {
      el.btnBackToTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // IntersectionObserver for Reveal-on-scroll elements
    if ('IntersectionObserver' in window) {
      const revealObserver = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            obs.unobserve(entry.target);
          }
        });
      }, {
        root: null,
        threshold: 0.08,
        rootMargin: '0px 0px -40px 0px'
      });

      document.querySelectorAll('.reveal-on-scroll').forEach(elem => {
        revealObserver.observe(elem);
      });
    } else {
      document.querySelectorAll('.reveal-on-scroll').forEach(elem => {
        elem.classList.add('is-revealed');
      });
    }
  }

  /* ==========================================================================
     OPPORTUNITY TEXT ANALYSIS & EXTRACTION
     ========================================================================== */
  function analyzeOpportunityText() {
    const text = el.jdInput ? el.jdInput.value.trim() : "";
    if (!text) {
      loadSampleDemo();
      return;
    }

    state.opportunityText = text;
    state.isDemo = false;

    // Run deterministic extractor
    const extracted = OK.extract.extract(text);
    state.checklist = extracted;

    // Sync detected deadline if found
    if (extracted.detectedDeadline && el.oppDeadline) {
      el.oppDeadline.value = extracted.detectedDeadline;
    }

    if (el.simulatorTargetBadge) {
      el.simulatorTargetBadge.textContent = `⚡ OPPORTUNITY SCANNED · ${extracted.length} CRITERIA IDENTIFIED`;
    }

    recalculateAll();
  }

  function loadSampleDemo() {
    state.isDemo = true;
    if (el.jdInput) el.jdInput.value = OK.samples.SAMPLE_OPPORTUNITY_TEXT;
    if (el.oppDeadline) el.oppDeadline.value = OK.samples.getSampleDeadlineDate();

    // Extract requirements from sample text (via real extractor)
    const extracted = OK.extract.extract(OK.samples.SAMPLE_OPPORTUNITY_TEXT);
    state.checklist = extracted;

    // Load sample profile
    state.profile = JSON.parse(JSON.stringify(OK.samples.SAMPLE_STUDENT_PROFILE));
    populateFormFromProfile(state.profile);

    if (el.simulatorTargetBadge) {
      el.simulatorTargetBadge.textContent = '🔥 FINTECH SUMMER INTERN · CUTOFF IN 12 DAYS';
    }

    recalculateAll();
  }

  /* ==========================================================================
     BACKEND SQLITE PERSISTENCE
     ========================================================================== */
  async function checkBackendHealth() {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        state.backendOnline = true;
        if (el.backendStatusText) el.backendStatusText.textContent = `SQLite Online (${data.database})`;
        if (el.backendStatusIndicator) el.backendStatusIndicator.className = 'w-3 h-3 bg-mint-dark rounded-full neo-border';
        loadProfileFromBackend();
        return;
      }
    } catch (_) {}

    state.backendOnline = false;
    if (el.backendStatusText) el.backendStatusText.textContent = 'Backend Offline (Using Local Cache)';
    if (el.backendStatusIndicator) el.backendStatusIndicator.className = 'w-3 h-3 bg-yellow rounded-full neo-border';
    loadProfileFromDraft();
  }

  async function loadProfileFromBackend() {
    try {
      const res = await fetch('/api/profile');
      if (res.ok) {
        const data = await res.json();
        if (data && data.profile) {
          state.profile = data.profile;
          populateFormFromProfile(data.profile);
          if (el.profileSaveIndicator) el.profileSaveIndicator.textContent = 'SQLite Synced';
          recalculateAll();
          return;
        }
      }
    } catch (e) {
      console.warn("Failed to load profile from backend", e);
    }
    loadProfileFromDraft();
  }

  async function saveProfileToBackend() {
    syncProfileFromForm();
    if (el.profileSaveIndicator) el.profileSaveIndicator.textContent = "Saving...";

    try {
      localStorage.setItem('ok_profile_draft', JSON.stringify(state.profile));
    } catch (_) {}

    if (!state.backendOnline) {
      if (el.profileSaveIndicator) el.profileSaveIndicator.textContent = "Saved to Draft";
      return;
    }

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state.profile)
      });
      if (res.ok) {
        if (el.profileSaveIndicator) el.profileSaveIndicator.textContent = "SQLite Synced";
      } else {
        if (el.profileSaveIndicator) el.profileSaveIndicator.textContent = "Save Failed";
      }
    } catch (_) {
      if (el.profileSaveIndicator) el.profileSaveIndicator.textContent = "Saved to Draft";
    }
  }

  async function deleteProfileFromBackend() {
    if (!confirm("Reset saved student profile and clear personal details?")) return;

    state.profile = {
      name: "", year: null, degree: "", branch: "", cgpa: null, skills: [],
      docs: { resume: false, marksheet: false, income_certificate: false, statement: false, prototype: false, demo_video: false },
      links: { portfolio: "", github: "" },
      availabilityWeeks: null, notes: ""
    };
    populateFormFromProfile(state.profile);

    try {
      localStorage.removeItem('ok_profile_draft');
    } catch (_) {}

    if (state.backendOnline) {
      try {
        await fetch('/api/profile', { method: 'DELETE' });
      } catch (_) {}
    }

    if (el.profileSaveIndicator) el.profileSaveIndicator.textContent = "Cleared";
    recalculateAll();
  }

  function loadProfileFromDraft() {
    try {
      const draft = localStorage.getItem('ok_profile_draft');
      if (draft) {
        const p = JSON.parse(draft);
        state.profile = p;
        populateFormFromProfile(p);
        if (el.profileSaveIndicator) el.profileSaveIndicator.textContent = "Loaded Draft";
        recalculateAll();
      }
    } catch (_) {}
  }

  /* ==========================================================================
     IN-MEMORY FILE UPLOADS (OPPORTUNITY & RESUME)
     ========================================================================== */
  async function handleOpportunityFileUpload(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      console.warn("File exceeds 10MB limit.");
      return;
    }

    if (el.oppFileStatus) {
      el.oppFileStatus.textContent = `Extracting ${file.name} in-memory...`;
      el.oppFileStatus.className = 'font-mono text-[11px] font-bold text-ink';
    }

    try {
      const formData = new FormData();
      formData.append('document', file);

      const res = await fetch('/api/opportunity/extract-file', {
        method: 'POST',
        headers: { 'x-file-name': file.name },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        console.warn('Document extraction notice:', data.error);
        if (el.oppFileStatus) {
          el.oppFileStatus.textContent = '';
        }
        return;
      }

      if (data.text) {
        if (el.jdInput) el.jdInput.value = data.text;
        if (el.oppFileStatus) {
          el.oppFileStatus.textContent = `Extracted essential requirements & timeline (${data.textLength} chars) from ${file.name}.`;
          el.oppFileStatus.className = 'font-mono text-[11px] font-bold text-mint-dark';
        }
        analyzeOpportunityText();
      } else {
        if (el.oppFileStatus) el.oppFileStatus.textContent = '';
      }

    } catch (err) {
      console.warn('Upload error:', err.message);
      if (el.oppFileStatus) {
        el.oppFileStatus.textContent = '';
      }
    }
  }

  async function handleResumeUpload(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      console.warn("File exceeds 5MB limit.");
      return;
    }

    if (el.uploadStatusText) el.uploadStatusText.textContent = `Decoding in-memory...`;

    try {
      const formData = new FormData();
      formData.append('resume', file);

      const res = await fetch('/api/resume/extract', {
        method: 'POST',
        headers: { 'x-file-name': file.name },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        console.warn('Resume extraction notice:', data.error);
        if (el.uploadStatusText) el.uploadStatusText.textContent = '';
        return;
      }

      if (data.suggestions) {
        state.pendingResumeSuggestions = data.suggestions;
        openResumeSuggestionsModal(data.suggestions);
        if (el.uploadStatusText) el.uploadStatusText.textContent = `Decoded ${file.name}.`;
      } else {
        if (el.uploadStatusText) el.uploadStatusText.textContent = '';
      }

    } catch (err) {
      console.warn('Upload error:', err.message);
      if (el.uploadStatusText) el.uploadStatusText.textContent = '';
    }
  }

  function openResumeSuggestionsModal(sug) {
    if (!el.resumeSuggestionsList) return;
    el.resumeSuggestionsList.innerHTML = '';

    const items = [];
    if (sug.name) items.push({ field: 'name', label: `Name: ${sug.name}`, val: sug.name });
    if (sug.degree) items.push({ field: 'degree', label: `Degree: ${sug.degree}`, val: sug.degree });
    if (sug.branch) items.push({ field: 'branch', label: `Branch: ${sug.branch}`, val: sug.branch });
    if (sug.cgpa) items.push({ field: 'cgpa', label: `CGPA: ${sug.cgpa}`, val: sug.cgpa });
    if (sug.skills && sug.skills.length > 0) items.push({ field: 'skills', label: `Skills: ${sug.skills.join(', ')}`, val: sug.skills });
    if (sug.links && sug.links.github) items.push({ field: 'github', label: `GitHub: ${sug.links.github}`, val: sug.links.github });

    items.forEach((it, idx) => {
      const lbl = document.createElement('label');
      lbl.className = 'flex items-center gap-2 p-2 bg-paper neo-border font-mono text-xs font-bold cursor-pointer';
      lbl.innerHTML = `<input type="checkbox" class="w-4 h-4 neo-border resume-sug-item" data-field="${it.field}" checked> ${escapeHtml(it.label)}`;
      lbl.dataset.value = JSON.stringify(it.val);
      el.resumeSuggestionsList.appendChild(lbl);
    });

    if (el.modalResumeReview) el.modalResumeReview.style.display = 'flex';
  }

  function applyResumeSuggestions() {
    if (!el.resumeSuggestionsList) return;
    const checked = el.resumeSuggestionsList.querySelectorAll('.resume-sug-item:checked');

    checked.forEach(chk => {
      const field = chk.dataset.field;
      const parent = chk.closest('label');
      const val = JSON.parse(parent.dataset.value);

      if (field === 'name') state.profile.name = val;
      if (field === 'degree') state.profile.degree = val;
      if (field === 'branch') state.profile.branch = val;
      if (field === 'cgpa') state.profile.cgpa = val;
      if (field === 'github') {
        state.profile.links = state.profile.links || {};
        state.profile.links.github = val;
      }
      if (field === 'skills') {
        const merged = new Set([...(state.profile.skills || []), ...val]);
        state.profile.skills = Array.from(merged);
      }
    });

    if (state.profile.docs) state.profile.docs.resume = true;

    populateFormFromProfile(state.profile);
    if (el.modalResumeReview) el.modalResumeReview.style.display = 'none';
    recalculateAll();
  }

  /* ==========================================================================
     HELPER UTILITIES
     ========================================================================== */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ==========================================================================
     EVENT LISTENERS WIRING
     ========================================================================== */
  function wireEvents() {
    // Hero & Simulator CTAs
    if (el.btnHeroLaunch) {
      el.btnHeroLaunch.addEventListener('click', () => {
        document.getElementById('simulator-section').scrollIntoView({ behavior: 'smooth' });
      });
    }

    if (el.btnLoadSample) el.btnLoadSample.addEventListener('click', loadSampleDemo);

    if (el.btnCustomJd) {
      el.btnCustomJd.addEventListener('click', () => {
        if (el.jdInput) {
          el.jdInput.value = "";
          el.jdInput.focus();
        }
      });
    }

    const btnLoadSampleInline = document.getElementById('btn-load-sample-inline');
    if (btnLoadSampleInline) {
      btnLoadSampleInline.addEventListener('click', () => {
        if (el.jdInput) el.jdInput.value = OK.samples.SAMPLE_OPPORTUNITY_TEXT;
        if (el.oppDeadline) el.oppDeadline.value = OK.samples.getSampleDeadlineDate();
        analyzeOpportunityText();
      });
    }

    if (el.btnResetText) {
      el.btnResetText.addEventListener('click', () => {
        if (el.jdInput) {
          el.jdInput.value = "";
          el.jdInput.focus();
          state.opportunityText = "";
          state.checklist = [];
          recalculateAll();
        }
      });
    }

    if (el.btnRunCompare) el.btnRunCompare.addEventListener('click', analyzeOpportunityText);
    if (el.btnHeaderPrint) el.btnHeaderPrint.addEventListener('click', () => window.print());

    if (el.jdInput) {
      let jdDebounce = null;
      const triggerAnalyze = () => {
        clearTimeout(jdDebounce);
        jdDebounce = setTimeout(() => {
          if (el.jdInput.value.trim().length > 0) {
            analyzeOpportunityText();
          } else {
            state.opportunityText = "";
            state.checklist = [];
            recalculateAll();
          }
        }, 150);
      };
      ['input', 'change', 'paste', 'keyup'].forEach(evt => el.jdInput.addEventListener(evt, triggerAnalyze));
    }

    if (el.btnFocusRunway) {
      el.btnFocusRunway.addEventListener('click', () => {
        document.getElementById('action-runway-solutions').scrollIntoView({ behavior: 'smooth' });
      });
    }

    // Opportunity Category Selector Pills
    document.querySelectorAll('.opp-type-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.opp-type-btn').forEach(b => {
          b.classList.remove('bg-ink', 'text-white');
          b.classList.add('hover:bg-yellow');
        });
        e.currentTarget.classList.add('bg-ink', 'text-white');
        e.currentTarget.classList.remove('hover:bg-yellow');
        state.opportunityType = e.currentTarget.dataset.type;
      });
    });

    // What-If Toggles Listeners
    if (el.toggleJs) el.toggleJs.addEventListener('change', handleWhatIfToggleChange);
    if (el.toggleGithub) el.toggleGithub.addEventListener('change', handleWhatIfToggleChange);
    if (el.toggleAvail) el.toggleAvail.addEventListener('change', handleWhatIfToggleChange);

    if (el.btnToggleAll) {
      el.btnToggleAll.addEventListener('click', (e) => {
        e.preventDefault();
        const allOn = el.toggleJs.checked && el.toggleGithub.checked && el.toggleAvail.checked;
        el.toggleJs.checked = !allOn;
        el.toggleGithub.checked = !allOn;
        el.toggleAvail.checked = !allOn;
        handleWhatIfToggleChange();
      });
    }

    // Profile Drawer Open/Close
    const openDrawer = () => {
      if (el.profileDrawerBackdrop) el.profileDrawerBackdrop.style.display = 'flex';
    };
    const closeDrawer = () => {
      if (el.profileDrawerBackdrop) el.profileDrawerBackdrop.style.display = 'none';
    };

    if (el.btnOpenProfileDrawer) el.btnOpenProfileDrawer.addEventListener('click', openDrawer);
    if (el.btnSnapshotEditProfile) el.btnSnapshotEditProfile.addEventListener('click', openDrawer);
    const cardProfile = document.getElementById('card-snapshot-profile');
    const cardCgpa = document.getElementById('card-snapshot-cgpa');
    if (cardProfile) cardProfile.addEventListener('click', openDrawer);
    if (cardCgpa) cardCgpa.addEventListener('click', openDrawer);
    if (el.btnCloseProfileDrawer) el.btnCloseProfileDrawer.addEventListener('click', closeDrawer);

    if (el.profileDrawerBackdrop) {
      el.profileDrawerBackdrop.addEventListener('click', (e) => {
        if (e.target === el.profileDrawerBackdrop) closeDrawer();
      });
    }

    // Profile Actions
    if (el.btnProfileSave) el.btnProfileSave.addEventListener('click', saveProfileToBackend);
    if (el.btnProfileSample) {
      el.btnProfileSample.addEventListener('click', () => {
        populateFormFromProfile(OK.samples.SAMPLE_STUDENT_PROFILE);
        recalculateAll();
      });
    }
    if (el.btnProfileClear) el.btnProfileClear.addEventListener('click', deleteProfileFromBackend);

    // Live form inputs recalculation
    const liveInputs = [
      el.profName, el.profYear, el.profDegree, el.profBranch, el.profCgpa,
      el.profAvailability, el.profSkills, el.profLinkPortfolio, el.profLinkGithub,
      el.profDocResume, el.profDocMarksheet, el.profDocIncome,
      el.profDocStatement, el.profDocPrototype, el.profDocVideo,
      el.oppDeadline
    ];

    liveInputs.forEach(input => {
      if (input) {
        input.addEventListener('input', recalculateAll);
        input.addEventListener('change', recalculateAll);
      }
    });

    // In-memory JD Document Upload trigger
    if (el.btnUploadOppFile && el.oppFileInput) {
      el.btnUploadOppFile.addEventListener('click', () => el.oppFileInput.click());
      el.oppFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          handleOpportunityFileUpload(e.target.files[0]);
        }
      });
    }

    // In-memory Resume Upload trigger
    if (el.btnTriggerUpload && el.resumeFileInput) {
      el.btnTriggerUpload.addEventListener('click', () => el.resumeFileInput.click());
      el.resumeFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          handleResumeUpload(e.target.files[0]);
        }
      });
    }

    // Resume Suggestions Modal
    if (el.btnAcceptResume) el.btnAcceptResume.addEventListener('click', applyResumeSuggestions);
    if (el.btnRejectResume) {
      el.btnRejectResume.addEventListener('click', () => {
        if (el.modalResumeReview) el.modalResumeReview.style.display = 'none';
      });
    }
    if (el.btnCloseResumeModal) {
      el.btnCloseResumeModal.addEventListener('click', () => {
        if (el.modalResumeReview) el.modalResumeReview.style.display = 'none';
      });
    }

    // Add Custom Rule Modal
    if (el.btnAddReqModal) {
      el.btnAddReqModal.addEventListener('click', () => {
        if (el.newReqLabel) el.newReqLabel.value = '';
        if (el.newReqEvidence) el.newReqEvidence.value = '';
        if (el.modalAddReq) el.modalAddReq.style.display = 'flex';
      });
    }
    if (el.btnCloseAddModal) {
      el.btnCloseAddModal.addEventListener('click', () => {
        if (el.modalAddReq) el.modalAddReq.style.display = 'none';
      });
    }
    if (el.btnCancelAddModal) {
      el.btnCancelAddModal.addEventListener('click', () => {
        if (el.modalAddReq) el.modalAddReq.style.display = 'none';
      });
    }

    if (el.btnSaveNewReq) {
      el.btnSaveNewReq.addEventListener('click', () => {
        const label = el.newReqLabel ? el.newReqLabel.value.trim() : "";
        if (!label) return;

        const category = el.newReqCategory ? el.newReqCategory.value : 'other';
        const effort = el.newReqEffort ? el.newReqEffort.value : 'days';
        const evidence = el.newReqEvidence ? el.newReqEvidence.value.trim() : "";

        const newReq = {
          id: `custom_${Date.now()}`,
          category: category,
          field: 'custom',
          label: label,
          rule: 'custom',
          value: true,
          unit: null,
          required: true,
          evidence: evidence,
          confidence: 'high',
          effortType: effort,
          estimatedDays: effort === 'quick' ? 0 : (effort === 'weeks' ? 10 : 3),
          locked: effort === 'locked',
          active: true
        };

        state.checklist.push(newReq);
        if (el.modalAddReq) el.modalAddReq.style.display = 'none';
        recalculateAll();
      });
    }
  }

  /* ==========================================================================
     INITIALIZATION ON DOM LOAD
     ========================================================================== */
  document.addEventListener('DOMContentLoaded', async () => {
    initDOMElements();
    wireEvents();
    initTypewriter();
    initScrollEffects();
    await checkBackendHealth();

    // Check if user has a previously saved profile in backend or localStorage
    let savedProfile = null;
    try {
      if (state.backendOnline) {
        const res = await fetch('/api/profile');
        if (res.ok) {
          const data = await res.json();
          if (data && data.profile) savedProfile = data.profile;
        }
      }
      if (!savedProfile && typeof localStorage !== 'undefined') {
        const local = localStorage.getItem('ok_profile_draft') || localStorage.getItem('ok_user_profile');
        if (local) savedProfile = JSON.parse(local);
      }
    } catch (_) {}

    if (savedProfile) {
      state.profile = savedProfile;
      populateFormFromProfile(state.profile);
    } else {
      state.profile = {
        name: "Aarav S.",
        year: 2,
        degree: "B.Tech",
        branch: "CSE",
        cgpa: 8.0,
        skills: ["HTML", "CSS", "JavaScript"],
        docs: { resume: true, marksheet: true },
        links: { github: "https://github.com/aarav", portfolio: "" },
        availabilityWeeks: 8,
        notes: ""
      };
      populateFormFromProfile(state.profile);
    }

    if (el.jdInput && el.jdInput.value.trim().length > 0) {
      analyzeOpportunityText();
    } else {
      recalculateAll();
    }
  });

  // Export methods and state for testing / external control
  OK.app = {
    state,
    recalculateAll,
    syncProfileFromForm,
    populateFormFromProfile,
    loadSampleDemo,
    analyzeOpportunityText
  };

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this || {})));
