import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const migrationsDir = path.join(rootDir, 'backend/src/db/migrations');
const journalPath = path.join(migrationsDir, 'meta/_journal.json');
const schemaPaths = [
  path.join(rootDir, 'backend/src/db/schema.ts'),
  path.join(rootDir, 'backend/src/db/pulse-schema.ts'),
];

let failed = false;

function report(message, file = journalPath) {
  failed = true;
  const relative = path.relative(rootDir, file);
  console.error(`::error file=${relative}::${message}`);
}

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--.*$/gm, '');
}

function splitStatements(sql) {
  return stripSqlComments(sql)
    .split(/;|-->\s*statement-breakpoint/g)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function collectDdlTargets(statement) {
  const targets = new Set();
  const patterns = [
    /\bCREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:"(?:[^"]+)"\.)?"([^"]+)"/i,
    /\bALTER\s+TABLE(?:\s+IF\s+EXISTS)?\s+(?:"(?:[^"]+)"\.)?"([^"]+)"/i,
    /\bCREATE\s+(?:UNIQUE\s+)?INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+"[^"]+"\s+ON\s+(?:"(?:[^"]+)"\.)?"([^"]+)"/i,
  ];

  for (const pattern of patterns) {
    const match = statement.match(pattern);
    if (match?.[1]) {
      targets.add(match[1]);
    }
  }

  return targets;
}

const sqlFiles = fs.readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort();

const sqlTags = sqlFiles.map((file) => file.replace(/\.sql$/, ''));
const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
const journalTags = journal.entries.map((entry) => entry.tag).sort();

for (const tag of sqlTags.filter((tag) => !journalTags.includes(tag))) {
  report(`missing journal entry for ${tag}.sql`);
}

for (const tag of journalTags.filter((tag) => !sqlTags.includes(tag))) {
  report(`journal entry has no SQL file: ${tag}`);
}

for (const [index, entry] of journal.entries.entries()) {
  if (entry.idx !== index) {
    report(`journal idx for ${entry.tag} is ${entry.idx}, expected ${index}`);
  }
}

const ddlTargets = new Set();

for (const file of sqlFiles) {
  const filePath = path.join(migrationsDir, file);
  const sql = fs.readFileSync(filePath, 'utf8');
  const statements = splitStatements(sql);

  for (const statement of statements) {
    for (const tableName of collectDdlTargets(statement)) {
      ddlTargets.add(tableName);
    }

    if (/\bDROP\b/i.test(statement)) {
      report('destructive DROP statement is not allowed in migrations', filePath);
    }

    if (/\bALTER\s+TABLE\b[\s\S]*\bALTER\s+COLUMN\b[\s\S]*\bSET\s+NOT\s+NULL\b/i.test(statement)) {
      report('ALTER COLUMN SET NOT NULL is not allowed in additive migrations', filePath);
    }

    if (
      /\bALTER\s+TABLE\b[\s\S]*\bADD\s+COLUMN\b[\s\S]*\bNOT\s+NULL\b/i.test(statement) &&
      !/\bDEFAULT\b/i.test(statement)
    ) {
      report('ADD COLUMN NOT NULL requires a safe DEFAULT', filePath);
    }
  }
}

const schemaTables = new Map();

for (const schemaPath of schemaPaths) {
  const source = fs.readFileSync(schemaPath, 'utf8');
  const tableRegex = /pgTable\(\s*['"`]([^'"`]+)['"`]/g;
  let match;
  while ((match = tableRegex.exec(source)) !== null) {
    schemaTables.set(match[1], schemaPath);
  }
}

for (const [tableName, schemaPath] of schemaTables.entries()) {
  if (!ddlTargets.has(tableName)) {
    report(`schema table "${tableName}" has no CREATE/ALTER/INDEX migration target`, schemaPath);
  }
}

if (failed) {
  process.exit(1);
}

console.log(`Migration checks OK (${sqlFiles.length} migrations, ${schemaTables.size} schema tables).`);
