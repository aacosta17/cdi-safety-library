(function () {
  const RULES = [
    {
      before: /(?:install|secure).*(?:j[- ]?hooks?|cable supports?|cable tray|pathway|conduit|raceway)/i,
      after: /(?:\bpull\b.*(?:cable|wire|fiber)|(?:cable|wire|fiber).*\bpull\b)/i,
      message: 'Install the cable supports, tray, pathway, or conduit before pulling cable through it.'
    },
    {
      before: /(?:drill|core|cut|create|open).*(?:penetration|opening)|(?:penetration|opening).*(?:drill|core|cut|create|open)/i,
      after: /firestop/i,
      message: 'Complete the penetration work before installing firestop.'
    },
    {
      before: /(?:install|mount|secure|connect|terminate|splice|program|configure|aim|repair)/i,
      after: /(?:\btest\b|commission|functional check|verify operation)/i,
      message: 'Complete installation, connection, and termination work before testing or commissioning.'
    },
    {
      before: /(?:lock out|lockout|loto|zero energy|de-energize|isolate hazardous energy)/i,
      after: /(?:electrical|panel|energized|power|terminate|connect)/i,
      message: 'Complete required energy isolation and zero-energy verification before the affected electrical work.'
    }
  ];

  function isSetup(text) {
    return /review (?:today['’]s )?work|inspect (?:the )?(?:route|area|tools|equipment|ladder|lift)|stage (?:materials|tools)|establish (?:controls|barricades)|set up (?:the )?(?:work area|ladder|lift|barricade)/i.test(text);
  }

  function isPhysicalWork(text) {
    return /\b(?:install|pull|route|mount|terminate|connect|splice|test|commission|repair|drill|cut|firestop|excavat|demolish|program|configure|aim)\b/i.test(text) && !isSetup(text);
  }

  function phase(text) {
    const low = String(text || '').toLowerCase();
    if (/review .*work|inspect .*route|establish .*controls/.test(low)) return 10;
    if (/stage .*materials|inspect .*tools|set up .*ladder|set up .*lift|move .*material/.test(low)) return 20;
    if (/lock out|lockout|loto|zero energy|de-energize|isolate hazardous energy/.test(low)) return 25;
    if (/j[- ]?hooks?|cable supports?|cable tray|pathway|conduit|raceway/.test(low) && /install|secure/.test(low)) return 30;
    if (/drill|core|cut|penetration|opening/.test(low) && !/firestop/.test(low)) return 35;
    if (/\bpull\b.*(?:cable|wire|fiber)|(?:cable|wire|fiber).*\bpull\b/.test(low)) return 40;
    if (/firestop/.test(low)) return 50;
    if (/install|mount|secure|terminate|connect|splice|program|configure|aim|repair/.test(low)) return 60;
    if (/\btest\b|commission|verify operation|functional check/.test(low)) return 70;
    if (/^housekeeping\b|clean the work area.*remove .*barricade/.test(low)) return 100;
    return 55;
  }

  function stableSort(steps) {
    return steps
      .map((text, index) => ({ text, index, phase: phase(text) }))
      .sort((a, b) => a.phase - b.phase || a.index - b.index)
      .map(item => item.text);
  }

  function analyze(rows) {
    const issues = [];
    const add = (row, message) => {
      if (row && !issues.some(issue => issue.card === row.card && issue.message === message)) {
        issues.push({ card: row.card, message });
      }
    };

    const firstPhysical = rows.find(row => isPhysicalWork(row.text));
    rows.filter(row => isSetup(row.text)).forEach(row => {
      if (firstPhysical && row.index > firstPhysical.index) {
        add(row, 'Move crew review, area controls, staging, and equipment setup before the physical work begins.');
      }
    });

    for (const rule of RULES) {
      const beforeRows = rows.filter(row => rule.before.test(row.text));
      const afterRows = rows.filter(row => rule.after.test(row.text));
      if (!beforeRows.length || !afterRows.length) continue;
      const firstBefore = beforeRows[0];
      const firstAfter = afterRows[0];
      if (firstAfter.index < firstBefore.index) add(firstAfter, rule.message);
    }

    const housekeeping = rows.filter(row => /^housekeeping\b|clean the work area.*remove .*barricade/i.test(row.text));
    housekeeping.forEach(row => {
      if (row.index !== rows.length - 1) {
        add(row, 'Housekeeping, area restoration, and barricade removal must be the final step.');
      }
    });

    return issues;
  }

  window.CDISequence = { analyze, phase, stableSort };
})();
