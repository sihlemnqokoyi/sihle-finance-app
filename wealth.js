(() => {
  const RETIREMENT_TYPES = new Set(["Provident Fund", "Retirement Annuity"]);
  const money = n => new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(Number(n) || 0);
  const num = id => Number(document.getElementById(id)?.value || 0);

  function migrate() {
    data.investments = (data.investments || []).map(f => ({
      name: f.name || "Investment",
      type: f.type || (String(f.name).toLowerCase().includes("provident") ? "Provident Fund" : String(f.name).toLowerCase().includes("retirement") || String(f.name).toLowerCase().includes(" ra") ? "Retirement Annuity" : "Unit Trust"),
      value: Number(f.value) || 0,
      contribution: Number(f.contribution) || 0,
      target: Number(f.target) || 0,
      annualReturn: Number(f.annualReturn ?? 9),
      history: Array.isArray(f.history) ? f.history : []
    }));
    save();
  }

  function futureValue(pv, monthly, annualRate, months) {
    const r = annualRate / 100 / 12;
    if (!months) return pv;
    if (!r) return pv + monthly * months;
    return pv * Math.pow(1 + r, months) + monthly * ((Math.pow(1 + r, months) - 1) / r);
  }

  function totals() {
    const total = data.investments.reduce((s, f) => s + Number(f.value || 0), 0);
    const contributions = data.investments.reduce((s, f) => s + Number(f.contribution || 0), 0);
    const retirement = data.investments.filter(f => RETIREMENT_TYPES.has(f.type)).reduce((s, f) => s + Number(f.value || 0), 0);
    return { total, contributions, retirement };
  }

  function renderFunds() {
    const list = document.getElementById("investmentList");
    if (!list) return;
    const currentAge = num("currentAge") || 29;
    const monthsTo60 = Math.max(0, (60 - currentAge) * 12);
    const t = totals();
    document.getElementById("totalInvestments").textContent = money(t.total);
    document.getElementById("totalContributions").textContent = money(t.contributions);
    document.getElementById("retirementAssets").textContent = money(t.retirement);
    const at60 = data.investments.reduce((s, f) => s + futureValue(f.value, f.contribution, f.annualReturn, monthsTo60), 0);
    document.getElementById("age60Value").textContent = money(at60);

    list.innerHTML = data.investments.length ? data.investments.map((f, i) => {
      const pct = f.target ? Math.min(100, (f.value / f.target) * 100) : 0;
      return `<div class="list-item"><div style="flex:1"><strong>${f.name}</strong><small>${f.type} · ${money(f.value)} · ${money(f.contribution)}/month · ${f.annualReturn}% assumed return</small><div class="progress"><div style="width:${pct}%"></div></div></div><button class="danger" onclick="removeInvestment(${i})">Delete</button></div>`;
    }).join("") : "<p>No investments added yet.</p>";

    const select = document.getElementById("statementFund");
    if (select) select.innerHTML = data.investments.map((f, i) => `<option value="${i}">${f.name}</option>`).join("");
    renderGuidance();
  }

  function renderGuidance() {
    const box = document.getElementById("investmentGuidance");
    if (!box) return;
    const surplus = data.salary - monthlyExpenses();
    const t = totals();
    const emergency = data.investments.find(f => f.type === "Emergency Fund" || /emergency/i.test(f.name));
    const emergencyMonths = monthlyExpenses() ? Number(emergency?.value || 0) / monthlyExpenses() : 0;
    const suggestions = [];
    if (emergencyMonths < 3) suggestions.push(`<div class="recommendation"><strong>1. Strengthen your emergency fund</strong>You currently have about ${emergencyMonths.toFixed(1)} months of expenses recorded. A practical first target is 3–6 months before taking more investment risk.</div>`);
    if (surplus > 0) suggestions.push(`<div class="recommendation"><strong>2. Invest the surplus deliberately</strong>Your modelled monthly surplus is ${money(surplus)}. A starting allocation to test is 50% long-term diversified investments, 30% emergency/short-term goals and 20% flexible spending.</div>`);
    const ra = data.investments.find(f => f.type === "Retirement Annuity");
    if (ra && !ra.contribution) suggestions.push(`<div class="recommendation"><strong>3. Review the dormant RA</strong>Your RA is preserved but has no current contribution. Compare its fees, underlying funds and tax role with your employer provident fund before restarting contributions.</div>`);
    suggestions.push(`<div class="recommendation"><strong>Scenario guidance—not personalised financial advice</strong>The app uses the figures and return assumptions you enter. Actual returns, taxes, fees and inflation can differ materially. Use the output to compare choices, then verify major investment decisions with a licensed South African financial adviser.</div>`);
    box.innerHTML = suggestions.join("");
  }

  function runForecast() {
    const age = num("currentAge") || 29;
    const retirementAge = num("retirementAge") || 60;
    const returnRate = num("returnRate") || 0;
    const salaryGrowth = num("salaryGrowth") || 0;
    const inflation = num("expenseInflation") || 0;
    const extra = num("extraInvestment") || 0;
    let salary = Number(data.salary || 0) * 12;
    let expenses = monthlyExpenses() * 12;
    let portfolio = totals().total;
    const annualExisting = totals().contributions * 12;
    const rows = [];
    const years = Math.max(0, retirementAge - age);
    for (let y = 1; y <= years; y++) {
      const surplus = Math.max(0, salary - expenses);
      const investable = annualExisting + extra * 12 + surplus;
      portfolio = portfolio * (1 + returnRate / 100) + investable;
      rows.push({ year: new Date().getFullYear() + y, salary, expenses, surplus, portfolio });
      salary *= 1 + salaryGrowth / 100;
      expenses *= 1 + inflation / 100;
    }
    document.getElementById("forecastRows").innerHTML = rows.map(r => `<tr><td>${r.year}</td><td>${money(r.salary)}</td><td>${money(r.expenses)}</td><td>${money(r.surplus)}</td><td>${money(r.portfolio)}</td></tr>`).join("");
    const final = rows.at(-1)?.portfolio || portfolio;
    document.getElementById("forecastSummary").textContent = `Under these assumptions, your recorded investments could grow to approximately ${money(final)} by age ${retirementAge}. This is a scenario, not a guarantee.`;
    const realReturn = returnRate - inflation;
    document.getElementById("forecastAdvice").innerHTML = `<div class="recommendation"><strong>Real-return check</strong>Your assumed return exceeds expense inflation by ${realReturn.toFixed(1)} percentage points.</div><div class="recommendation"><strong>Stress test</strong>Run the forecast again at returns 2–3 percentage points lower and inflation 1–2 points higher. A plan that still works under that case is more resilient.</div>`;
  }

  function analyseDecision() {
    const cost = num("decisionCost");
    if (!cost) return;
    const type = document.getElementById("decisionType").value;
    const name = document.getElementById("decisionItem").value || type;
    const surplus = data.salary - monthlyExpenses();
    const t = totals();
    let cls = "warn", text = "";
    if (type === "New monthly commitment" || type === "Vehicle") {
      const remaining = surplus - cost;
      const ratio = data.salary ? cost / data.salary : 1;
      cls = remaining >= 5000 && ratio <= .15 ? "good" : remaining >= 0 ? "warn" : "bad";
      text = `After adding ${money(cost)} per month, your estimated surplus would be ${money(remaining)}. The commitment would use ${(ratio * 100).toFixed(1)}% of net pay.`;
    } else {
      const months = surplus > 0 ? cost / surplus : Infinity;
      cls = months <= 1 ? "good" : months <= 4 ? "warn" : "bad";
      text = Number.isFinite(months) ? `It represents about ${months.toFixed(1)} months of your current surplus. Paying cash without touching retirement funds is the safer benchmark.` : "Your current model has no positive surplus for this purchase.";
    }
    document.getElementById("decisionResult").className = `decision-result ${cls}`;
    document.getElementById("decisionResult").innerHTML = `<strong>${name}</strong><br>${text}<br><small>Total investments recorded: ${money(t.total)}. Retirement assets should generally not be treated as spending money.</small>`;
  }

  migrate();

  const originalRender = window.render;
  if (typeof originalRender === "function") {
    window.render = function () { originalRender(); renderFunds(); };
  }

  const form = document.getElementById("investmentForm");
  if (form) form.onsubmit = e => {
    if (e.submitter?.value === "cancel") return;
    data.investments.push({
      name: document.getElementById("investmentName").value,
      type: document.getElementById("investmentType").value,
      value: num("investmentValue"),
      contribution: num("investmentContribution"),
      target: num("investmentTarget"),
      annualReturn: num("investmentReturn"),
      history: []
    });
    save(); form.reset(); renderFunds();
  };

  document.getElementById("updateFundValue")?.addEventListener("click", () => {
    const i = Number(document.getElementById("statementFund").value);
    const value = num("fundStatementValue");
    const date = document.getElementById("fundStatementDate").value || new Date().toISOString().slice(0, 10);
    if (!data.investments[i] || value < 0) return;
    data.investments[i].value = value;
    data.investments[i].history.push({ date, value });
    save(); renderFunds();
    document.getElementById("fundUpdateStatus").textContent = `${data.investments[i].name} updated to ${money(value)}.`;
  });
  document.getElementById("runForecast")?.addEventListener("click", runForecast);
  document.getElementById("calculateDecision")?.addEventListener("click", analyseDecision);

  renderFunds();
  runForecast();
})();