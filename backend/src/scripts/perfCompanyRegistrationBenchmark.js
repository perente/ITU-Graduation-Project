const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ITERATIONS = Number(process.env.ITERATIONS || 3);
const OUTPUT_ROOT =
  process.env.OUTPUT_ROOT || path.resolve(process.cwd(), 'reports', 'perf-company');

const USERS = {
  student: {
    email: process.env.STUDENT_EMAIL || 'student1@itu.edu.tr',
    password: process.env.STUDENT_PASSWORD || '123456',
  },
  central: {
    email: process.env.CENTRAL_EMAIL || 'central@itu.edu.tr',
    password: process.env.CENTRAL_PASSWORD || '123456',
  },
};

const OPERATION_TYPES = {
  submit_company_request: 'db_write',
  list_pending_company_requests: 'db_read',
  read_company_request_detail: 'db_read',
  approve_company_request: 'ca_and_db_write',
  login_created_company: 'auth_read',
  read_created_company_agreements: 'fabric_read',
};

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

  return {
    token: data.token,
    user: data.user,
  };
};

const apiCall = async ({ operation, role, method, urlPath, token, body }) => {
  const startedAt = performance.now();
  let status = 0;
  let ok = false;
  let data = null;
  let error = '';

  try {
    const response = await fetch(`${BASE_URL}${urlPath}`, {
      method,
      headers: {
        Authorization: token ? `Bearer ${token}` : undefined,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    status = response.status;
    ok = response.ok;
    data = await response.json().catch(() => null);

    if (!ok) {
      error = data?.message || response.statusText || `HTTP ${status}`;
    }
  } catch (caughtError) {
    error = caughtError.message;
  }

  return {
    operation,
    type: OPERATION_TYPES[operation] || 'unknown',
    role,
    method,
    path: urlPath,
    ok,
    status,
    latencyMs: performance.now() - startedAt,
    error,
    data,
    timestamp: new Date().toISOString(),
  };
};

const requireOk = (sample) => {
  if (!sample.ok) {
    throw new Error(
      `${sample.operation} failed: HTTP ${sample.status} ${sample.error || ''}`.trim()
    );
  }
};

const loginWithTiming = async ({ operation, role, email, password }) => {
  const startedAt = performance.now();
  let status = 0;
  let ok = false;
  let data = null;
  let error = '';

  try {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    status = response.status;
    ok = response.ok;
    data = await response.json().catch(() => null);

    if (!ok) {
      error = data?.message || response.statusText || `HTTP ${status}`;
    }
  } catch (caughtError) {
    error = caughtError.message;
  }

  return {
    operation,
    type: OPERATION_TYPES[operation] || 'auth_read',
    role,
    method: 'POST',
    path: '/api/auth/login',
    ok,
    status,
    latencyMs: performance.now() - startedAt,
    error,
    data,
    timestamp: new Date().toISOString(),
  };
};

const createCompanyRequestPayload = (uniqueSuffix) => ({
  companyName: `Perf Company ${uniqueSuffix}`,
  companyAddress: `Perf Address ${uniqueSuffix}`,
  companyPhoneNumber: '+90 212 555 10 10',
  companyFaxNumber: '+90 212 555 10 11',
  companyEmail: `perf-company-${uniqueSuffix}@company.com`,
  isPublicInstitution: false,
  companyTitle: `Perf Company ${uniqueSuffix} Ltd.`,
  companyIban: `TR${String(uniqueSuffix).replace(/\D/g, '').padEnd(24, '0').slice(0, 24)}`,
  companyBankName: 'Perf Bank',
  companyBankBranchCode: '999',
  companyBankBranchName: 'Perf Branch',
  companyRegistrationNumber: `REG${uniqueSuffix}`,
  companyTaxIdentificationNumber: null,
});

const summarize = ({ operation, samples, totalElapsedSeconds }) => {
  const matchingSamples = samples.filter((sample) => sample.operation === operation);
  const latencies = matchingSamples.map((sample) => sample.latencyMs);
  const successCount = matchingSamples.filter((sample) => sample.ok).length;
  const errorCount = matchingSamples.length - successCount;

  return {
    operation,
    type: matchingSamples[0]?.type || '',
    requests: matchingSamples.length,
    successCount,
    errorCount,
    successRatePercent: round(
      matchingSamples.length ? (successCount / matchingSamples.length) * 100 : 0
    ),
    tps: round(matchingSamples.length / totalElapsedSeconds),
    avgLatencyMs: round(average(latencies)),
    minLatencyMs: round(Math.min(...latencies)),
    p50LatencyMs: round(percentile(latencies, 50)),
    p90LatencyMs: round(percentile(latencies, 90)),
    p95LatencyMs: round(percentile(latencies, 95)),
    p99LatencyMs: round(percentile(latencies, 99)),
    maxLatencyMs: round(Math.max(...latencies)),
  };
};

const runIteration = async ({ iteration, tokens }) => {
  const uniqueSuffix = `${Date.now()}-${iteration}`;
  const payload = createCompanyRequestPayload(uniqueSuffix);
  const samples = [];

  const submitSample = await apiCall({
    operation: 'submit_company_request',
    role: 'student',
    method: 'POST',
    urlPath: '/api/companies/requests',
    token: tokens.student,
    body: payload,
  });
  samples.push(submitSample);
  requireOk(submitSample);

  const requestId = submitSample.data?.data?.id;
  if (!requestId) {
    throw new Error('submit_company_request did not return a request id.');
  }

  const listSample = await apiCall({
    operation: 'list_pending_company_requests',
    role: 'central',
    method: 'GET',
    urlPath: '/api/companies/requests',
    token: tokens.central,
  });
  samples.push(listSample);
  requireOk(listSample);

  const detailSample = await apiCall({
    operation: 'read_company_request_detail',
    role: 'central',
    method: 'GET',
    urlPath: `/api/companies/requests/${requestId}`,
    token: tokens.central,
  });
  samples.push(detailSample);
  requireOk(detailSample);

  const approveSample = await apiCall({
    operation: 'approve_company_request',
    role: 'central',
    method: 'POST',
    urlPath: `/api/companies/requests/${requestId}/approve`,
    token: tokens.central,
  });
  samples.push(approveSample);
  requireOk(approveSample);

  const credentials = approveSample.data?.data?.credentials;
  const company = approveSample.data?.data?.company;

  if (!credentials?.username || !credentials?.temporaryPassword) {
    throw new Error('approve_company_request did not return company credentials.');
  }

  const loginSample = await loginWithTiming({
    operation: 'login_created_company',
    role: 'company',
    email: credentials.username,
    password: credentials.temporaryPassword,
  });
  samples.push(loginSample);
  requireOk(loginSample);

  const readAgreementsSample = await apiCall({
    operation: 'read_created_company_agreements',
    role: 'company',
    method: 'GET',
    urlPath: '/api/agreements/my',
    token: loginSample.data?.token,
  });
  samples.push(readAgreementsSample);
  requireOk(readAgreementsSample);

  return samples.map((sample) => ({
    ...sample,
    iteration,
    requestId,
    companyId: company?.companyId || '',
    companyEmail: payload.companyEmail,
  }));
};

const main = async () => {
  if (!Number.isFinite(ITERATIONS) || ITERATIONS <= 0) {
    throw new Error('ITERATIONS must be a positive number.');
  }

  const outputDir = path.join(OUTPUT_ROOT, timestampForPath());
  fs.mkdirSync(outputDir, { recursive: true });

  console.info(`Company registration benchmark target: ${BASE_URL}`);
  console.info(`Iterations: ${ITERATIONS}`);
  console.info('Mode: submit company request, central approval/provisioning, created-company login, and chain read smoke check.');

  const tokens = {};
  for (const [role, credentials] of Object.entries(USERS)) {
    tokens[role] = (await login(credentials)).token;
  }

  const allSamples = [];
  const startedAt = performance.now();

  for (let iteration = 1; iteration <= ITERATIONS; iteration += 1) {
    console.info(`Running company registration iteration ${iteration}/${ITERATIONS}`);
    allSamples.push(...(await runIteration({ iteration, tokens })));
    await sleep(100);
  }

  const totalElapsedSeconds = (performance.now() - startedAt) / 1000;
  const operations = [...new Set(allSamples.map((sample) => sample.operation))];
  const summaries = operations.map((operation) =>
    summarize({ operation, samples: allSamples, totalElapsedSeconds })
  );

  const summary = {
    baseUrl: BASE_URL,
    iterations: ITERATIONS,
    generatedAt: new Date().toISOString(),
    totalElapsedSeconds: round(totalElapsedSeconds),
    measurementScope:
      'Company approval is not a ledger write; it measures API, SQLite, Fabric CA provisioning, login, and one Fabric read smoke check.',
    note:
      'Company registration approval is not a Fabric ledger write. It measures API validation, SQLite writes, Fabric CA identity provisioning, created-company login, and one Fabric chain read using the new identity.',
    operations: summaries,
  };

  fs.writeFileSync(
    path.join(outputDir, 'results.json'),
    JSON.stringify({ summary, samples: allSamples }, null, 2)
  );
  fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2));
  writeCsv(path.join(outputDir, 'summary.csv'), summaries);
  writeCsv(
    path.join(outputDir, 'samples.csv'),
    allSamples.map((sample) => ({
      iteration: sample.iteration,
      requestId: sample.requestId,
      companyId: sample.companyId,
      companyEmail: sample.companyEmail,
      operation: sample.operation,
      type: sample.type,
      role: sample.role,
      method: sample.method,
      path: sample.path,
      ok: sample.ok,
      status: sample.status,
      latencyMs: round(sample.latencyMs),
      error: sample.error || '',
      timestamp: sample.timestamp,
    }))
  );

  const chartLabels = summaries.map((item) => `${item.operation} (${item.type})`);
  fs.writeFileSync(path.join(outputDir, 'company-registration-tps.svg'), svgBarChart({
    title: 'Company Onboarding Throughput',
    labels: chartLabels,
    values: summaries.map((item) => item.tps),
    unit: 'requests / second',
    color: '#ea580c',
  }));
  fs.writeFileSync(path.join(outputDir, 'company-registration-latency-p95.svg'), svgBarChart({
    title: 'Company Onboarding P95 Latency',
    labels: chartLabels,
    values: summaries.map((item) => item.p95LatencyMs),
    unit: 'milliseconds',
    color: '#ea580c',
  }));

  console.table(
    summaries.map((item) => ({
      operation: item.operation,
      type: item.type,
      requests: item.requests,
      tps: item.tps,
      avgMs: item.avgLatencyMs,
      p95Ms: item.p95LatencyMs,
      errors: item.errorCount,
    }))
  );
  console.info(`Company registration perf artifacts written to: ${outputDir}`);
};

main().catch((error) => {
  console.error(`PERF COMPANY: failed - ${error.message}`);
  process.exit(1);
});
