#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';

const REQUIRED_COMPLETE_LOGS = 3;
const DEFAULT_WINDOW_DAYS = 120;
const ENDURANCE_TYPES = new Set(['bike', 'run', 'hike']);
const EVIDENCE_CHECKLIST = 'docs/ai/checklists/fueling-evidence-capture.md';
const STRUCTURED_GI_COMFORT_OPTIONS = [
  { value: 'ok', label: 'Magen ok' },
  { value: 'mild_issue', label: 'Magen leicht unruhig' },
  { value: 'issue', label: 'Magenprobleme' },
];

function structuredGiComfortValuesText() {
  return STRUCTURED_GI_COMFORT_OPTIONS.map(option => option.value).join(', ');
}

function structuredGiComfortOptionsText() {
  return STRUCTURED_GI_COMFORT_OPTIONS
    .map(option => `${option.value}=${option.label}`)
    .join(', ');
}

function structuredGiComfortOptions() {
  return STRUCTURED_GI_COMFORT_OPTIONS.map(option => ({ ...option }));
}

function usage() {
  return [
    'Usage: node scripts/fueling-gate-audit.mjs [options]',
    '',
    'Audits whether Pulse has enough comparable complete during Fueling logs for trend summaries.',
    '',
    'Options:',
    '  --today YYYY-MM-DD        Anchor date for the default 120-day lookback.',
    '  --since YYYY-MM-DD        Override the lookback start date.',
    '  --user <uuid>             Restrict the audit to one user_id.',
    '  --database-url <url>      Read-only Postgres connection string.',
    '  --env-file <path>         Env file to load before .env/.env.test fallbacks.',
    '  --packet                  Print a manual evidence-capture packet instead of the audit table.',
    '  --json                    Print machine-readable JSON.',
    '  -h, --help                Show this help.',
  ].join('\n');
}

function assertIsoDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) {
    throw new Error(`${label} must be YYYY-MM-DD`);
  }
  return value;
}

function isoDate(date) {
  return date.toISOString().split('T')[0];
}

export function shiftIsoDate(date, days) {
  assertIsoDate(date, 'date');
  const current = new Date(`${date}T00:00:00Z`);
  current.setUTCDate(current.getUTCDate() + days);
  return isoDate(current);
}

function clean(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function formatNumber(value, suffix = '') {
  if (value == null || Number.isNaN(Number(value))) return 'missing';
  const roundedValue = Math.round(Number(value));
  return suffix ? `${roundedValue} ${suffix}` : String(roundedValue);
}

function numberOrNull(value) {
  if (value == null || Number.isNaN(Number(value))) return null;
  return Number(value);
}

function durationMin(log) {
  if (log.durationMin != null) return Math.round(Number(log.durationMin));
  if (log.durationSec != null) return Math.round(Number(log.durationSec) / 60);
  return null;
}

function carbsPerHour(log) {
  const duration = durationMin(log);
  if (log.carbsG == null || duration == null || duration <= 0) return null;
  return Math.round(Number(log.carbsG) / (duration / 60));
}

function normalizeLog(row) {
  return {
    id: row.id,
    userId: row.userId ?? row.user_id,
    date: row.date,
    context: row.context ?? null,
    activityId: row.activityId ?? row.activity_id ?? null,
    workoutId: row.workoutId ?? row.workout_id ?? null,
    activityName: clean(row.activityName ?? row.activity_name) ?? 'unnamed activity',
    activityType: clean(row.activityType ?? row.activity_type),
    durationSec: row.durationSec ?? row.duration_sec ?? null,
    durationMin: row.durationMin ?? row.duration_min ?? null,
    carbsG: row.carbsG ?? row.carbs_g ?? null,
    giComfort: clean(row.giComfort ?? row.gi_comfort),
    sodiumMg: row.sodiumMg ?? row.sodium_mg ?? null,
    ambientTempC: row.ambientTempC ?? row.ambient_temp_c ?? null,
    sweatRateLPerHour: row.sweatRateLPerHour ?? row.sweat_rate_l_per_hour ?? null,
  };
}

function isDuringContext(log) {
  return log.context === 'during' || log.context == null;
}

function isEnduranceLog(log) {
  return ENDURANCE_TYPES.has(log.activityType);
}

function isComparableLongLog(log) {
  return isDuringContext(log) && isEnduranceLog(log) && (durationMin(log) ?? 0) >= 75;
}

function isCompleteComparableLog(log) {
  return isComparableLongLog(log) && log.carbsG != null && log.giComfort != null;
}

function missingFields(log) {
  const fields = [];
  if (log.carbsG == null) fields.push('carbs');
  if (log.giComfort == null) fields.push('GI comfort');
  return fields;
}

function completionStatus(log) {
  if (!isComparableLongLog(log)) {
    if (!isEnduranceLog(log)) return 'not comparable: non-endurance activity';
    return 'not comparable: under 75 min or missing duration';
  }
  if (isCompleteComparableLog(log)) return 'complete';
  return `can count after ${missingFields(log).join(' and ')}`;
}

function activityFuelingPath(activityId) {
  return activityId ? `/plan/activity/${activityId}#activity-fueling-log` : null;
}

function carbContext(log) {
  if (log.carbsG == null) return null;
  const perHour = carbsPerHour(log);
  const carbs = formatNumber(log.carbsG, 'g');
  return perHour == null ? `${carbs} carbs` : `${carbs} carbs (${perHour} g/h)`;
}

function candidateSummary(log) {
  return [
    log.date,
    log.activityName,
    log.activityType,
    durationMin(log) == null ? null : `${durationMin(log)} min`,
    carbContext(log),
  ].filter(Boolean).join(' - ');
}

function candidateContext(log) {
  return {
    date: log.date ?? null,
    activityName: log.activityName ?? null,
    activityType: log.activityType ?? null,
    durationMin: durationMin(log),
    carbsG: numberOrNull(log.carbsG),
    carbsPerHour: carbsPerHour(log),
    targetPath: activityFuelingPath(log.activityId),
    summary: candidateSummary(log),
  };
}

function nextActionFor(comparableLogs) {
  const giGap = comparableLogs.find(log => log.carbsG != null && log.giComfort == null);
  if (giGap) {
    return {
      kind: 'complete_gi_comfort',
      label: 'GI-Komfort ergaenzen',
      detail: `Add structured GI comfort (${structuredGiComfortValuesText()}) to an existing long carb log.`,
      activityId: giGap.activityId,
      targetPath: activityFuelingPath(giGap.activityId),
      date: giGap.date,
      evidenceChecklist: EVIDENCE_CHECKLIST,
      options: structuredGiComfortOptions(),
      targetLog: candidateContext(giGap),
    };
  }

  const carbGap = comparableLogs.find(log => log.carbsG == null && log.giComfort != null);
  if (carbGap) {
    return {
      kind: 'complete_carbs',
      label: 'Carbs ergaenzen',
      detail: 'Add structured carbs to an existing long GI-comfort log.',
      activityId: carbGap.activityId,
      targetPath: activityFuelingPath(carbGap.activityId),
      date: carbGap.date,
      evidenceChecklist: EVIDENCE_CHECKLIST,
      targetLog: candidateContext(carbGap),
    };
  }

  return {
    kind: 'log_next_long_session',
    label: 'Naechsten Lernlog vollstaendig erfassen',
    detail: 'Capture duration, carbs and GI comfort together on the next long endurance session.',
    activityId: null,
    targetPath: null,
    date: null,
    evidenceChecklist: EVIDENCE_CHECKLIST,
  };
}

function summarizeUser(userId, logs, requiredCompleteLogs) {
  const duringLogs = logs.filter(isDuringContext);
  const comparableLogs = duringLogs.filter(isComparableLongLog);
  const completeLogs = comparableLogs.filter(isCompleteComparableLog);
  const completionCandidates = comparableLogs
    .filter(log => !isCompleteComparableLog(log) && (log.carbsG != null || log.giComfort != null))
    .map(log => ({
      ...log,
      missing: missingFields(log),
      status: completionStatus(log),
      targetPath: activityFuelingPath(log.activityId),
      durationMin: durationMin(log),
      carbsPerHour: carbsPerHour(log),
      summary: candidateSummary(log),
    }));
  const requiredRemaining = Math.max(0, requiredCompleteLogs - completeLogs.length);
  const completableNow = Math.min(requiredRemaining, completionCandidates.length);
  const newLogsStillNeeded = Math.max(0, requiredRemaining - completableNow);

  return {
    userId,
    gate: completeLogs.length >= requiredCompleteLogs ? 'ready' : 'gated',
    duringLogs: duringLogs.length,
    comparableLongLogs: comparableLogs.length,
    comparableCompleteLogs: completeLogs.length,
    requiredComparableCompleteLogs: requiredCompleteLogs,
    requiredRemaining,
    completableNow,
    newLogsStillNeeded,
    nextAction: completeLogs.length >= requiredCompleteLogs ? null : nextActionFor(comparableLogs),
    completionCandidates,
    comparableLogs: comparableLogs.map(log => ({
      ...log,
      status: completionStatus(log),
      durationMin: durationMin(log),
      carbsPerHour: carbsPerHour(log),
    })),
  };
}

export function buildFuelingGateAudit(rows, options = {}) {
  const today = assertIsoDate(options.today ?? isoDate(new Date()), 'today');
  const since = assertIsoDate(options.since ?? shiftIsoDate(today, -DEFAULT_WINDOW_DAYS), 'since');
  const requiredCompleteLogs = options.requiredCompleteLogs ?? REQUIRED_COMPLETE_LOGS;
  const logs = rows
    .map(normalizeLog)
    .filter(log => log.date >= since && log.date <= today)
    .sort((a, b) => `${b.userId}:${b.date}`.localeCompare(`${a.userId}:${a.date}`));

  const byUser = new Map();
  for (const log of logs) {
    const list = byUser.get(log.userId) ?? [];
    list.push(log);
    byUser.set(log.userId, list);
  }

  const users = Array.from(byUser.entries())
    .map(([userId, userLogs]) => summarizeUser(userId, userLogs, requiredCompleteLogs))
    .sort((a, b) => String(a.userId).localeCompare(String(b.userId)));

  return {
    today,
    since,
    requiredCompleteLogs,
    totalDuringLogs: logs.filter(isDuringContext).length,
    users,
  };
}

function shortId(value) {
  return String(value ?? 'unknown').slice(0, 8);
}

function renderLogRow(log) {
  const activity = `${log.activityName}${log.activityId ? ` (${shortId(log.activityId)})` : ''}`;
  const carbs = log.carbsG == null ? 'missing' : `${formatNumber(log.carbsG, 'g')} (${log.carbsPerHour ?? '?'} g/h)`;
  return `| ${log.date} | ${activity} | ${log.activityType ?? 'missing'} | ${log.durationMin ?? 'missing'} min | ${carbs} | ${log.giComfort ?? 'missing'} | ${log.status} | ${activityFuelingPath(log.activityId) ?? 'missing'} |`;
}

export function renderFuelingGateAudit(audit) {
  const lines = [
    '# Fueling Learning Gate Audit',
    '',
    `Window: ${audit.since}..${audit.today}`,
    `Required comparable complete logs: ${audit.requiredCompleteLogs}`,
    `Users with during logs: ${audit.users.length}`,
    '',
  ];

  if (audit.users.length === 0) {
    lines.push('No during nutrition logs found in the audit window.');
    return lines.join('\n');
  }

  for (const user of audit.users) {
    lines.push(`## User ${shortId(user.userId)}`);
    lines.push(`- Gate: ${user.gate}`);
    lines.push(`- Comparable complete logs: ${user.comparableCompleteLogs}/${user.requiredComparableCompleteLogs}`);
    lines.push(`- During logs in window: ${user.duringLogs}`);
    lines.push(`- Comparable long logs: ${user.comparableLongLogs}`);
    if (user.gate === 'ready') {
      lines.push('- Next action: trend summaries can be enabled from current evidence.');
    } else {
      lines.push(`- Existing logs completable now: ${user.completableNow}`);
      lines.push(`- New complete long-session logs still needed after completion candidates: ${user.newLogsStillNeeded}`);
      lines.push(`- Next action: ${user.nextAction.label} (${user.nextAction.detail})`);
      lines.push(`- Evidence checklist: ${user.nextAction.evidenceChecklist}`);
      if (user.nextAction.targetLog?.summary) lines.push(`- Next action target: ${user.nextAction.targetLog.summary}`);
      if (user.nextAction.targetPath) lines.push(`- Next action path: ${user.nextAction.targetPath}`);
      if (user.completionCandidates.some(log => log.missing.includes('GI comfort'))) {
        lines.push(`- Structured GI comfort values: ${structuredGiComfortOptionsText()}`);
      }
    }

    const tableLogs = user.comparableLogs;
    if (tableLogs.length === 0) {
      lines.push('- Comparable log table: none');
      lines.push('');
      continue;
    }

    lines.push('');
    lines.push('| Date | Activity | Type | Duration | Carbs | GI comfort | Status | Action path |');
    lines.push('|---|---|---:|---:|---:|---|---|---|');
    for (const log of tableLogs) lines.push(renderLogRow(log));
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

function candidateMissingText(candidate) {
  const missing = candidate.missing ?? missingFields(candidate);
  return missing.length > 0 ? missing.join(', ') : 'none';
}

function packetCandidateLines(candidate, index) {
  const lines = [
    `${index + 1}. ${candidate.summary ?? candidateSummary(candidate)}`,
  ];
  if (candidate.targetPath) lines.push(`   Path: ${candidate.targetPath}`);
  lines.push(`   Missing: ${candidateMissingText(candidate)}`);
  if ((candidate.missing ?? []).includes('GI comfort')) {
    lines.push(`   GI comfort options: ${structuredGiComfortOptionsText()}`);
  }
  if ((candidate.missing ?? []).includes('carbs')) {
    lines.push('   Carbs: enter the actual during-activity carbs from that session.');
  }
  return lines;
}

export function renderFuelingEvidencePacket(audit) {
  const lines = [
    '# Fueling Evidence Packet',
    '',
    `Window: ${audit.since}..${audit.today}`,
    `Required comparable complete logs: ${audit.requiredCompleteLogs}`,
    '',
  ];

  if (audit.users.length === 0) {
    lines.push('No during nutrition logs found in the audit window.');
    lines.push(`Rerun: npm run audit:fueling-gate -- --today ${audit.today}`);
    return lines.join('\n');
  }

  for (const user of audit.users) {
    lines.push(`## User ${shortId(user.userId)}`);
    lines.push(`Gate: ${user.gate}`);
    lines.push(`Comparable complete logs: ${user.comparableCompleteLogs}/${user.requiredComparableCompleteLogs}`);

    if (user.gate === 'ready') {
      lines.push('No manual Fueling evidence capture is needed before nutrition trend summaries can use current evidence.');
      lines.push('');
      continue;
    }

    if (user.nextAction?.targetLog?.summary) lines.push(`Next target: ${user.nextAction.targetLog.summary}`);
    if (user.nextAction?.targetPath) lines.push(`Next path: ${user.nextAction.targetPath}`);
    lines.push(`Existing logs completable now: ${user.completableNow}`);
    lines.push(`New complete long-session logs still needed after candidates: ${user.newLogsStillNeeded}`);
    lines.push('');

    if (user.completionCandidates.length > 0) {
      lines.push('Existing candidates to close first:');
      user.completionCandidates.forEach((candidate, index) => {
        lines.push(...packetCandidateLines(candidate, index));
      });
    } else {
      lines.push('Existing candidates to close first: none');
    }

    lines.push('');
    lines.push('Manual capture rules:');
    lines.push('- Use the Activity Fueling UI; do not edit database rows directly for normal evidence capture.');
    lines.push('- Choose GI comfort only from the real stomach response; do not infer it from notes, route, RPE, carbs per hour or workout result.');
    lines.push(`- Accepted GI comfort values: ${structuredGiComfortOptionsText()}`);
    lines.push(`- Evidence checklist: ${user.nextAction?.evidenceChecklist ?? EVIDENCE_CHECKLIST}`);
    lines.push(`- Rerun after each save: npm run audit:fueling-gate -- --today ${audit.today}`);

    lines.push('');
    lines.push('After existing candidates:');
    lines.push(`- New complete long-session logs still needed: ${user.newLogsStillNeeded}`);
    lines.push('- A new complete long-session log needs activity/duration context, during-activity carbs and structured GI comfort together.');
    lines.push('- Sodium, heat and sweat-rate remain measured-only evidence gaps until explicitly recorded.');
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

function parseArgs(argv) {
  const result = {
    today: isoDate(new Date()),
    since: null,
    userId: null,
    databaseUrl: null,
    envFile: null,
    packet: false,
    json: false,
  };
  const args = argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') {
      result.json = true;
      continue;
    }
    if (arg === '--packet') {
      result.packet = true;
      continue;
    }
    if (arg === '--today') {
      result.today = assertIsoDate(args[index + 1], '--today');
      index += 1;
      continue;
    }
    if (arg === '--since') {
      result.since = assertIsoDate(args[index + 1], '--since');
      index += 1;
      continue;
    }
    if (arg === '--user') {
      result.userId = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--database-url') {
      result.databaseUrl = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--env-file') {
      result.envFile = args[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return result;
}

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
  if (!match) return null;
  const [, key, rawValue] = match;
  let value = rawValue.trim();
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

function loadEnvFile(file) {
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    if (process.env[parsed.key] == null) process.env[parsed.key] = parsed.value;
  }
}

function resolveDatabaseUrl(options) {
  if (options.databaseUrl) return { databaseUrl: options.databaseUrl, envFile: null };
  const candidates = [
    options.envFile,
    '.env',
    '.env.test',
    '.env.test.example',
  ].filter(Boolean);
  let loadedEnvFile = null;
  for (const candidate of candidates) {
    const fullPath = path.resolve(candidate);
    if (!existsSync(fullPath)) continue;
    loadEnvFile(fullPath);
    loadedEnvFile = fullPath;
    break;
  }
  return { databaseUrl: process.env.DATABASE_URL, envFile: loadedEnvFile };
}

function safeDatabaseLabel(databaseUrl) {
  const parsed = new URL(databaseUrl);
  return `${parsed.host}${parsed.pathname}`;
}

async function loadRows(databaseUrl, options) {
  const pool = new pg.Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 3000 });
  try {
    const params = [options.since];
    const userClause = options.userId ? 'AND l.user_id = $2' : '';
    if (options.userId) params.push(options.userId);
    const result = await pool.query(`
      SELECT
        l.id,
        l.user_id AS "userId",
        l.date::text AS date,
        l.context,
        l.activity_id AS "activityId",
        l.workout_id AS "workoutId",
        l.carbs_g AS "carbsG",
        l.gi_comfort AS "giComfort",
        l.sodium_mg AS "sodiumMg",
        l.ambient_temp_c AS "ambientTempC",
        l.sweat_rate_l_per_hour AS "sweatRateLPerHour",
        l.created_at AS "createdAt",
        a.name AS "activityName",
        a.activity_type AS "activityType",
        a.duration_sec AS "durationSec"
      FROM pulse_nutrition_logs l
      LEFT JOIN pulse_activities a
        ON a.id = l.activity_id
       AND a.user_id = l.user_id
      WHERE l.date >= $1
        AND (l.context = 'during' OR l.context IS NULL)
        ${userClause}
      ORDER BY l.user_id, l.date DESC, l.created_at DESC
    `, params);
    return result.rows;
  } finally {
    await pool.end();
  }
}

async function main(argv) {
  if (argv.includes('-h') || argv.includes('--help')) {
    console.log(usage());
    return;
  }

  const args = parseArgs(argv);
  const since = args.since ?? shiftIsoDate(args.today, -DEFAULT_WINDOW_DAYS);
  const { databaseUrl, envFile } = resolveDatabaseUrl(args);
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required. Pass --database-url or provide it in .env/.env.test.');
  }

  const rows = await loadRows(databaseUrl, { ...args, since });
  const audit = buildFuelingGateAudit(rows, { today: args.today, since });
  const output = {
    ...audit,
    database: safeDatabaseLabel(databaseUrl),
    envFile,
  };

  if (args.json) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log(args.packet ? renderFuelingEvidencePacket(output) : renderFuelingGateAudit(output));
  console.log('');
  console.log(`Database: ${output.database}`);
  if (envFile) console.log(`Env file: ${envFile}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv).catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
