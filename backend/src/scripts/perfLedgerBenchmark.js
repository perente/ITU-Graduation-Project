const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ITERATIONS = Number(process.env.ITERATIONS || 5);
const OUTPUT_ROOT =
  process.env.OUTPUT_ROOT || path.resolve(process.cwd(), 'reports', 'perf-ledger');
const WORKFLOW_MODE = (process.env.WORKFLOW_MODE || 'reject').toLowerCase();
const COMPANY_ID = process.env.COMPANY_ID || 'companyB';
const FACULTY_ID = process.env.FACULTY_ID || 'BBF';
const INTERNSHIP_TYPE = process.env.INTERNSHIP_TYPE || 'MANDATORY';
const INTERNSHIP_FIELD = process.env.INTERNSHIP_FIELD || 'YAZILIM';
const REJECTION_REASON = process.env.REJECTION_REASON || 'MISSING_DOCUMENT';
const MIN_REQUIRED_WORKING_DAYS = Number(process.env.MIN_REQUIRED_WORKING_DAYS || 20);
const START_OFFSET_DAYS = Number(process.env.START_OFFSET_DAYS || 30);

const USERS = {
  student: {
    email: process.env.STUDENT_EMAIL || 'studentworkflow@itu.edu.tr',
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

const WORKING_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
const WRITE_OPERATIONS = new Set([
  'create_agreement',
  'student_approve',
  'company_approve',
  'faculty_approve',
  'central_activate',
  'central_complete',
  'company_reject',
]);

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

const addDays = (isoDay, days) => {
  const [year, month, day] = isoDay.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const maxIsoDay = (left, right) => {
  if (!left) return right;
  if (!right) return left;
  return left > right ? left : right;
};

const calculateEndDateForWorkdays = (startDate, minRequiredDays) => {
  const selectedDays = new Set([1, 2, 3, 4, 5]);
  const date = new Date(`${startDate}T00:00:00.000Z`);
  let count = 0;

  while (count < minRequiredDays) {
    const weekday = date.getUTCDay() || 7;
    if (selectedDays.has(weekday)) {
      count += 1;
    }

    if (count >= minRequiredDays) {
      return date.toISOString().slice(0, 10);
    }

    date.setUTCDate(date.getUTCDate() + 1);
  }

  return date.toISOString().slice(0, 10);
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
        Authorization: `Bearer ${token}`,
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
    type: WRITE_OPERATIONS.has(operation) ? 'write' : 'read',
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

const getLatestNonRejectedEndDate = async (studentToken) => {
  const sample = await apiCall({
    operation: 'schedule_probe_my_agreements',
    role: 'student',
    method: 'GET',
    urlPath: '/api/agreements/my',
    token: studentToken,
  });
  requireOk(sample);

  const agreements = sample.data?.data || [];
  return agreements.reduce((latestEndDate, agreement) => {
    if (String(agreement.status || '').toUpperCase() === 'REJECTED') {
      return latestEndDate;
    }

    const endDate = String(agreement.endDate || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(endDate)
      ? maxIsoDay(latestEndDate, endDate)
      : latestEndDate;
  }, null);
};

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

const createPayload = ({ agreementId, startDate, endDate }) => ({
  agreementId,
  companyId: COMPANY_ID,
  facultyId: FACULTY_ID,
  startDate,
  endDate,
  internshipType: INTERNSHIP_TYPE,
  internshipField: INTERNSHIP_FIELD,
  workingDays: WORKING_DAYS,
});

const runRejectWorkflowIteration = async ({ iteration, tokens, agreementId, startDate, endDate }) => {
  const samples = [];

  const createSample = await apiCall({
    operation: 'create_agreement',
    role: 'student',
    method: 'POST',
    urlPath: '/api/agreements',
    token: tokens.student,
    body: createPayload({ agreementId, startDate, endDate }),
  });
  samples.push(createSample);
  requireOk(createSample);

  const createdAgreementId = createSample.data?.data?.agreementId || agreementId;

  const readCreatedSample = await apiCall({
    operation: 'read_created_agreement',
    role: 'student',
    method: 'GET',
    urlPath: `/api/agreements/${createdAgreementId}`,
    token: tokens.student,
  });
  samples.push(readCreatedSample);
  requireOk(readCreatedSample);

  const studentApproveSample = await apiCall({
    operation: 'student_approve',
    role: 'student',
    method: 'POST',
    urlPath: `/api/agreements/${createdAgreementId}/approve`,
    token: tokens.student,
  });
  samples.push(studentApproveSample);
  requireOk(studentApproveSample);

  const readPendingSample = await apiCall({
    operation: 'read_company_pending',
    role: 'company',
    method: 'GET',
    urlPath: '/api/agreements/pending',
    token: tokens.company,
  });
  samples.push(readPendingSample);
  requireOk(readPendingSample);

  const companyRejectSample = await apiCall({
    operation: 'company_reject',
    role: 'company',
    method: 'POST',
    urlPath: `/api/agreements/${createdAgreementId}/reject`,
    token: tokens.company,
    body: { reason: REJECTION_REASON },
  });
  samples.push(companyRejectSample);
  requireOk(companyRejectSample);

  const historySample = await apiCall({
    operation: 'read_agreement_history',
    role: 'student',
    method: 'GET',
    urlPath: `/api/agreements/${createdAgreementId}/history`,
    token: tokens.student,
  });
  samples.push(historySample);
  requireOk(historySample);

  return samples.map((sample) => ({
    ...sample,
    iteration,
    agreementId: createdAgreementId,
  }));
};

const runFullWorkflowIteration = async ({ iteration, tokens, agreementId, startDate, endDate }) => {
  const samples = [];
  const add = async (callConfig) => {
    const sample = await apiCall(callConfig);
    samples.push(sample);
    requireOk(sample);
    return sample;
  };

  const createSample = await add({
    operation: 'create_agreement',
    role: 'student',
    method: 'POST',
    urlPath: '/api/agreements',
    token: tokens.student,
    body: createPayload({ agreementId, startDate, endDate }),
  });
  const createdAgreementId = createSample.data?.data?.agreementId || agreementId;

  await add({
    operation: 'student_approve',
    role: 'student',
    method: 'POST',
    urlPath: `/api/agreements/${createdAgreementId}/approve`,
    token: tokens.student,
  });
  await add({
    operation: 'company_approve',
    role: 'company',
    method: 'POST',
    urlPath: `/api/agreements/${createdAgreementId}/approve`,
    token: tokens.company,
  });
  await add({
    operation: 'faculty_approve',
    role: 'faculty',
    method: 'POST',
    urlPath: `/api/agreements/${createdAgreementId}/approve`,
    token: tokens.faculty,
  });
  await add({
    operation: 'read_faculty_approved_agreement',
    role: 'central',
    method: 'GET',
    urlPath: `/api/agreements/${createdAgreementId}`,
    token: tokens.central,
  });
  await add({
    operation: 'central_activate',
    role: 'central',
    method: 'POST',
    urlPath: `/api/agreements/${createdAgreementId}/activate`,
    token: tokens.central,
  });
  await add({
    operation: 'central_complete',
    role: 'central',
    method: 'POST',
    urlPath: `/api/agreements/${createdAgreementId}/complete`,
    token: tokens.central,
  });
  await add({
    operation: 'read_agreement_history',
    role: 'central',
    method: 'GET',
    urlPath: `/api/agreements/${createdAgreementId}/history`,
    token: tokens.central,
  });

  return samples.map((sample) => ({
    ...sample,
    iteration,
    agreementId: createdAgreementId,
  }));
};

const main = async () => {
  if (!Number.isFinite(ITERATIONS) || ITERATIONS <= 0) {
    throw new Error('ITERATIONS must be a positive number.');
  }
  if (!['reject', 'full'].includes(WORKFLOW_MODE)) {
    throw new Error('WORKFLOW_MODE must be either "reject" or "full".');
  }

  const outputDir = path.join(OUTPUT_ROOT, timestampForPath());
  fs.mkdirSync(outputDir, { recursive: true });

  console.info(`Ledger benchmark target: ${BASE_URL}`);
  console.info(`Iterations: ${ITERATIONS}, workflow mode: ${WORKFLOW_MODE}`);
  console.info('Write latency is measured around API calls that submit Fabric transactions and wait for commit.');

  const tokens = {};
  for (const [role, credentials] of Object.entries(USERS)) {
    tokens[role] = await login(credentials);
  }

  const latestEndDate = await getLatestNonRejectedEndDate(tokens.student);
  const today = new Date().toISOString().slice(0, 10);
  let nextStartDate = maxIsoDay(
    addDays(today, START_OFFSET_DAYS),
    latestEndDate ? addDays(latestEndDate, 1) : null
  );

  const allSamples = [];
  const startedAt = performance.now();

  for (let iteration = 1; iteration <= ITERATIONS; iteration += 1) {
    const startDate = nextStartDate;
    const endDate = calculateEndDateForWorkdays(startDate, MIN_REQUIRED_WORKING_DAYS);
    const agreementId = `perf-ledger-${Date.now()}-${iteration}`;

    console.info(`Running iteration ${iteration}/${ITERATIONS}: ${agreementId}`);

    const iterationSamples =
      WORKFLOW_MODE === 'full'
        ? await runFullWorkflowIteration({
            iteration,
            tokens,
            agreementId,
            startDate,
            endDate,
          })
        : await runRejectWorkflowIteration({
            iteration,
            tokens,
            agreementId,
            startDate,
            endDate,
          });

    allSamples.push(...iterationSamples);
    nextStartDate = addDays(endDate, 1);
    await sleep(100);
  }

  const totalElapsedSeconds = (performance.now() - startedAt) / 1000;
  const operations = [...new Set(allSamples.map((sample) => sample.operation))];
  const summaries = operations.map((operation) =>
    summarize({ operation, samples: allSamples, totalElapsedSeconds })
  );

  const writeSamples = allSamples.filter((sample) => sample.type === 'write');
  const readSamples = allSamples.filter((sample) => sample.type === 'read');
  const summary = {
    baseUrl: BASE_URL,
    iterations: ITERATIONS,
    workflowMode: WORKFLOW_MODE,
    generatedAt: new Date().toISOString(),
    totalElapsedSeconds: round(totalElapsedSeconds),
    writeTps: round(writeSamples.length / totalElapsedSeconds),
    readTps: round(readSamples.length / totalElapsedSeconds),
    note:
      'Write latency is client-observed API latency for endpoints backed by Fabric submitTransaction. It includes API validation, gateway connection, transaction commit wait, response parsing, and local metadata writes where applicable.',
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
      agreementId: sample.agreementId,
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

  const writeSummaries = summaries.filter((item) => item.type === 'write');
  const readSummaries = summaries.filter((item) => item.type === 'read');

  if (writeSummaries.length) {
    fs.writeFileSync(path.join(outputDir, 'ledger-write-tps.svg'), svgBarChart({
      title: 'Fabric SubmitTransaction Throughput',
      labels: writeSummaries.map((item) => item.operation),
      values: writeSummaries.map((item) => item.tps),
      unit: 'requests / second',
      color: '#7c3aed',
    }));
    fs.writeFileSync(path.join(outputDir, 'ledger-write-latency-p95.svg'), svgBarChart({
      title: 'Fabric SubmitTransaction P95 Latency',
      labels: writeSummaries.map((item) => item.operation),
      values: writeSummaries.map((item) => item.p95LatencyMs),
      unit: 'milliseconds',
      color: '#7c3aed',
    }));
  }

  if (readSummaries.length) {
    fs.writeFileSync(path.join(outputDir, 'ledger-read-tps.svg'), svgBarChart({
      title: 'Workflow Read Checks Throughput',
      labels: readSummaries.map((item) => item.operation),
      values: readSummaries.map((item) => item.tps),
      unit: 'requests / second',
      color: '#6b7280',
    }));
    fs.writeFileSync(path.join(outputDir, 'ledger-read-latency-p95.svg'), svgBarChart({
      title: 'Workflow Read Checks P95 Latency',
      labels: readSummaries.map((item) => item.operation),
      values: readSummaries.map((item) => item.p95LatencyMs),
      unit: 'milliseconds',
      color: '#6b7280',
    }));
  }

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
  console.info(`Ledger perf artifacts written to: ${outputDir}`);
};

main().catch((error) => {
  console.error(`PERF LEDGER: failed - ${error.message}`);
  process.exit(1);
});
