const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const DURATION_SECONDS = Number(process.env.DURATION_SECONDS || 30);
const CONCURRENCY = Number(process.env.CONCURRENCY || 5);
const WARMUP_SECONDS = Number(process.env.WARMUP_SECONDS || 5);
const OUTPUT_ROOT = process.env.OUTPUT_ROOT || path.resolve(process.cwd(), 'reports', 'perf');

const USERS = {
  student: {
    email: process.env.STUDENT_EMAIL || 'student1@itu.edu.tr',
    password: process.env.STUDENT_PASSWORD || '123456',
  },
  company: {
    email: process.env.COMPANY_EMAIL || 'companyb@company.com',
    password: process.env.COMPANY_PASSWORD || '123456',
  },
  faculty: {
    email: process.env.FACULTY_EMAIL || 'faculty@itu.edu.tr',
    password: process.env.FACULTY_PASSWORD || '123456',
  },
  central: {
    email: process.env.CENTRAL_EMAIL || 'central@itu.edu.tr',
    password: process.env.CENTRAL_PASSWORD || '123456',
  },
};

const SCENARIOS = [
  {
    name: 'student_my_agreements',
    source: 'fabric',
    role: 'student',
    method: 'GET',
    path: '/api/agreements/my',
  },
  {
    name: 'student_pending_agreements',
    source: 'fabric',
    role: 'student',
    method: 'GET',
    path: '/api/agreements/pending',
  },
  {
    name: 'company_pending_agreements',
    source: 'fabric',
    role: 'company',
    method: 'GET',
    path: '/api/agreements/pending',
  },
  {
    name: 'faculty_pending_agreements',
    source: 'fabric',
    role: 'faculty',
    method: 'GET',
    path: '/api/agreements/pending',
  },
  {
    name: 'central_my_agreements',
    source: 'fabric',
    role: 'central',
    method: 'GET',
    path: '/api/agreements/my',
  },
  {
    name: 'approved_companies',
    source: 'sqlite',
    role: 'student',
    method: 'GET',
    path: '/api/companies',
  },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const percentile = (values, percentileValue) => {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentileValue / 100) * sorted.length) - 1;
  return sorted[Math.min(Math.max(index, 0), sorted.length - 1)];
};

const average = (values) => {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const round = (value, digits = 2) => Number(value.toFixed(digits));

const timestampForPath = () => new Date().toISOString().replace(/[:.]/g, '-');

const csvEscape = (value) => {
  const text = String(value ?? '');
  if (!/[",\n]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
};

const writeCsv = (filePath, rows) => {
  if (!rows.length) {
    fs.writeFileSync(filePath, '');
    return;
  }

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')),
  ];

  fs.writeFileSync(filePath, `${lines.join('\n')}\n`);
};

const login = async ({ email, password }) => {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.token) {
    throw new Error(`Login failed for ${email}: HTTP ${response.status} ${data.message || ''}`.trim());
  }

  return data.token;
};

const callScenario = async (scenario, token) => {
  const startedAt = performance.now();
  let status = 0;
  let ok = false;
  let error = null;

  try {
    const response = await fetch(`${BASE_URL}${scenario.path}`, {
      method: scenario.method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    status = response.status;
    ok = response.ok;
    await response.arrayBuffer();
  } catch (caughtError) {
    error = caughtError.message;
  }

  return {
    scenario: scenario.name,
    source: scenario.source,
    role: scenario.role,
    method: scenario.method,
    path: scenario.path,
    ok,
    status,
    error,
    latencyMs: performance.now() - startedAt,
    timestamp: new Date().toISOString(),
  };
};

const runScenario = async ({ scenario, token, durationMs, concurrency }) => {
  const results = [];
  const endsAt = performance.now() + durationMs;

  const worker = async () => {
    while (performance.now() < endsAt) {
      results.push(await callScenario(scenario, token));
    }
  };

  const startedAt = performance.now();
  await Promise.all(Array.from({ length: concurrency }, worker));
  const elapsedSeconds = (performance.now() - startedAt) / 1000;

  return { results, elapsedSeconds };
};

const summarizeScenario = ({ scenario, results, elapsedSeconds }) => {
  const successCount = results.filter((result) => result.ok).length;
  const errorCount = results.length - successCount;
  const latencies = results.map((result) => result.latencyMs);

  return {
    scenario: scenario.name,
    source: scenario.source,
    method: scenario.method,
    path: scenario.path,
    role: scenario.role,
    requests: results.length,
    successCount,
    errorCount,
    successRatePercent: round(results.length ? (successCount / results.length) * 100 : 0),
    errorRatePercent: round(results.length ? (errorCount / results.length) * 100 : 0),
    tps: round(results.length / elapsedSeconds),
    avgLatencyMs: round(average(latencies)),
    minLatencyMs: round(Math.min(...latencies)),
    p50LatencyMs: round(percentile(latencies, 50)),
    p90LatencyMs: round(percentile(latencies, 90)),
    p95LatencyMs: round(percentile(latencies, 95)),
    p99LatencyMs: round(percentile(latencies, 99)),
    maxLatencyMs: round(Math.max(...latencies)),
    elapsedSeconds: round(elapsedSeconds),
  };
};

const svgBarChart = ({ title, labels, values, unit, color }) => {
  const W = 1100;
  const H = 620;
  const M = { top: 80, right: 40, bottom: 130, left: 90 };
  const cw = W - M.left - M.right;
  const ch = H - M.top - M.bottom;
  const maxVal = Math.max(...values, 1);

  const TICKS = 5;
  const rawStep = maxVal / TICKS;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(rawStep, 1))));
  const step = Math.ceil(rawStep / mag) * mag || 1;
  const axisMax = step * TICKS;

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  const grid = Array.from({ length: TICKS + 1 }, (_, i) => {
    const v = i * step;
    const y = M.top + ch - (v / axisMax) * ch;
    const isBase = i === 0;
    return `<line x1="${M.left}" y1="${y}" x2="${W - M.right}" y2="${y}" stroke="${isBase ? '#9ca3af' : '#e5e7eb'}" stroke-width="${isBase ? 1.5 : 1}"/><text x="${M.left - 10}" y="${y + 4}" text-anchor="end" font-family="Arial, sans-serif" font-size="12" fill="#6b7280">${round(v)}</text>`;
  }).join('');

  const slotW = cw / values.length;
  const bars = values.map((v, i) => {
    const pad = Math.max(slotW * 0.18, 6);
    const bx = M.left + i * slotW + pad;
    const bw = Math.max(slotW - pad * 2, 8);
    const bh = (v / axisMax) * ch;
    const by = M.top + ch - bh;
    const cx = M.left + i * slotW + slotW / 2;
    const valY = Math.max(by - 8, M.top + 12);

    const raw = labels[i].replace(/_/g, ' ');
    const pi = raw.indexOf('(');
    let lines;
    if (pi > 0) {
      lines = [raw.slice(0, pi).trim(), raw.slice(pi).trim()];
    } else {
      const words = raw.split(' ');
      const mid = Math.ceil(words.length / 2);
      lines = raw.length > 18 && words.length > 1
        ? [words.slice(0, mid).join(' '), words.slice(mid).join(' ')]
        : [raw];
    }

    const labelBaseY = H - M.bottom + 24;
    const labelSvg = lines.map((ln, li) =>
      `<text x="${cx}" y="${labelBaseY + li * 15}" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="#374151">${esc(ln)}</text>`
    ).join('');

    return `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="${color}" rx="5"/><text x="${cx}" y="${valY}" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="600" fill="#111827">${round(v)}</text>${labelSvg}`;
  }).join('');

  const badgeW = Math.max(unit.length * 6.5 + 16, 70);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <rect x="0" y="0" width="${W}" height="4" fill="${color}"/>
  <text x="${W / 2}" y="42" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#111827">${esc(title)}</text>
  <rect x="${M.left}" y="54" width="${badgeW}" height="18" rx="9" fill="#f3f4f6"/>
  <text x="${M.left + 8}" y="67" font-family="Arial, sans-serif" font-size="11" fill="#6b7280">${esc(unit)}</text>
  <line x1="${M.left}" y1="${M.top}" x2="${M.left}" y2="${M.top + ch}" stroke="#d1d5db" stroke-width="1"/>
  ${grid}
  ${bars}
</svg>`;
};

const main = async () => {
  if (!Number.isFinite(DURATION_SECONDS) || DURATION_SECONDS <= 0) {
    throw new Error('DURATION_SECONDS must be a positive number.');
  }

  if (!Number.isFinite(CONCURRENCY) || CONCURRENCY <= 0) {
    throw new Error('CONCURRENCY must be a positive number.');
  }

  const outputDir = path.join(OUTPUT_ROOT, timestampForPath());
  fs.mkdirSync(outputDir, { recursive: true });

  console.info(`Perf benchmark target: ${BASE_URL}`);
  console.info(`Duration per scenario: ${DURATION_SECONDS}s, concurrency: ${CONCURRENCY}`);
  console.info('Mode: read-only API calls; no agreement create/approve/reject/activate/complete transactions.');

  const tokens = {};
  for (const [role, credentials] of Object.entries(USERS)) {
    tokens[role] = await login(credentials);
  }

  if (WARMUP_SECONDS > 0) {
    console.info(`Warmup: ${WARMUP_SECONDS}s`);
    for (const scenario of SCENARIOS) {
      await runScenario({
        scenario,
        token: tokens[scenario.role],
        durationMs: WARMUP_SECONDS * 1000,
        concurrency: Math.min(CONCURRENCY, 2),
      });
    }
  }

  const allResults = [];
  const summaries = [];

  for (const scenario of SCENARIOS) {
    console.info(`Running scenario: ${scenario.name}`);
    const { results, elapsedSeconds } = await runScenario({
      scenario,
      token: tokens[scenario.role],
      durationMs: DURATION_SECONDS * 1000,
      concurrency: CONCURRENCY,
    });

    allResults.push(...results);
    summaries.push(summarizeScenario({ scenario, results, elapsedSeconds }));
  }

  const summary = {
    baseUrl: BASE_URL,
    durationSeconds: DURATION_SECONDS,
    warmupSeconds: WARMUP_SECONDS,
    concurrency: CONCURRENCY,
    generatedAt: new Date().toISOString(),
    measurementScope:
      'Fabric rows are evaluateTransaction chaincode reads; SQLite rows are backend DB/API reads.',
    scenarios: summaries,
  };

  fs.writeFileSync(path.join(outputDir, 'results.json'), JSON.stringify({ summary, samples: allResults }, null, 2));
  fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2));
  writeCsv(path.join(outputDir, 'summary.csv'), summaries);
  writeCsv(path.join(outputDir, 'samples.csv'), allResults.map((result) => ({
    scenario: result.scenario,
    source: result.source,
    role: result.role,
    method: result.method,
    path: result.path,
    ok: result.ok,
    status: result.status,
    latencyMs: round(result.latencyMs),
    error: result.error || '',
    timestamp: result.timestamp,
  })));
  const fabricSummaries = summaries.filter((item) => item.source === 'fabric');
  const sqliteSummaries = summaries.filter((item) => item.source === 'sqlite');

  if (fabricSummaries.length) {
    fs.writeFileSync(path.join(outputDir, 'fabric-read-tps.svg'), svgBarChart({
      title: 'Fabric Read Throughput',
      labels: fabricSummaries.map((item) => item.scenario),
      values: fabricSummaries.map((item) => item.tps),
      unit: 'requests / second',
      color: '#2563eb',
    }));
    fs.writeFileSync(path.join(outputDir, 'fabric-read-latency-p95.svg'), svgBarChart({
      title: 'Fabric Read P95 Latency',
      labels: fabricSummaries.map((item) => item.scenario),
      values: fabricSummaries.map((item) => item.p95LatencyMs),
      unit: 'milliseconds',
      color: '#2563eb',
    }));
  }

  if (sqliteSummaries.length) {
    fs.writeFileSync(path.join(outputDir, 'sqlite-read-tps.svg'), svgBarChart({
      title: 'SQLite/API Read Throughput',
      labels: sqliteSummaries.map((item) => item.scenario),
      values: sqliteSummaries.map((item) => item.tps),
      unit: 'requests / second',
      color: '#059669',
    }));
    fs.writeFileSync(path.join(outputDir, 'sqlite-read-latency-p95.svg'), svgBarChart({
      title: 'SQLite/API Read P95 Latency',
      labels: sqliteSummaries.map((item) => item.scenario),
      values: sqliteSummaries.map((item) => item.p95LatencyMs),
      unit: 'milliseconds',
      color: '#059669',
    }));
  }

  console.table(summaries.map((item) => ({
    scenario: item.scenario,
    requests: item.requests,
    tps: item.tps,
    avgMs: item.avgLatencyMs,
    p50Ms: item.p50LatencyMs,
    p95Ms: item.p95LatencyMs,
    p99Ms: item.p99LatencyMs,
    errors: item.errorCount,
  })));
  console.info(`Perf artifacts written to: ${outputDir}`);
};

main().catch((error) => {
  console.error(`PERF: failed - ${error.message}`);
  process.exit(1);
});
