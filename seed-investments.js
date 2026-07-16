(() => {
  const SEED_VERSION = "2026-07-investments-v1";
  if (localStorage.getItem("sihleSeedVersion") === SEED_VERSION) return;

  const seeds = [
    {
      name: "STANLIB Unit Trusts",
      type: "Unit Trust",
      value: 405989.08,
      contribution: 0,
      target: 1000000,
      annualReturn: 9,
      history: [{ date: "2026-07-16", value: 405989.08 }]
    },
    {
      name: "INN8 Retirement Annuity",
      type: "Retirement Annuity",
      value: 47864.03,
      contribution: 0,
      target: 1000000,
      annualReturn: 9,
      history: [{ date: "2026-06-30", value: 47864.03 }]
    },
    {
      name: "Alexander Forbes Provident Fund",
      type: "Provident Fund",
      value: 43059.15,
      contribution: 4967.46,
      target: 3000000,
      annualReturn: 9,
      history: [{ date: "2026-03-31", value: 43059.15 }]
    }
  ];

  data.investments = Array.isArray(data.investments) ? data.investments : [];

  for (const seed of seeds) {
    const existing = data.investments.find(f => f.name === seed.name);
    if (existing) {
      existing.type = seed.type;
      existing.value = seed.value;
      existing.contribution = seed.contribution;
      existing.target = existing.target || seed.target;
      existing.annualReturn = existing.annualReturn || seed.annualReturn;
      existing.history = Array.isArray(existing.history) ? existing.history : [];
      if (!existing.history.some(h => h.date === seed.history[0].date && Number(h.value) === seed.value)) {
        existing.history.push(seed.history[0]);
      }
    } else {
      data.investments.push(seed);
    }
  }

  localStorage.setItem("sihleSeedVersion", SEED_VERSION);
  save();
  if (typeof render === "function") render();
})();
