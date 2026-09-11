import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

// Run actual SQL from the route against an isolated database with synthetic data.
const root = new URL('../', import.meta.url);
const source = readFileSync(new URL('app/api/admin/praise-contest/payments/route.ts', root), 'utf8');
const reserveSql = source.match(/db.prepare\(`(INSERT INTO praise_contest_payments[\s\S]*?)`\)/)[1];
const resultSql = source.match(/db.prepare\("(UPDATE praise_contest_payments[^"]*)"\)/)[1];
const auditSql = source.match(/db.prepare\("(INSERT INTO praise_contest_audit[^"]*)"\)/)[1];
const reconciliationSql = source.match(/db.prepare\(`(SELECT COUNT\(\*\) AS mismatches[\s\S]*?)`\)/)[1];

function setup() {
  const db = new DatabaseSync(':memory:');
  for (const file of readdirSync(new URL('drizzle/', root)).filter(f => /^002[89]_.*\.sql$/.test(f)).sort()) {
    db.exec(readFileSync(new URL(`drizzle/${file}`, root), 'utf8'));
  }
  db.exec(`CREATE TABLE praise_contest_entries(id INTEGER,contest_id TEXT,status TEXT,payout_ciphertext TEXT);
    CREATE TABLE praise_contest_audit(entry_id INTEGER,action TEXT,detail TEXT,created_at TEXT);
    INSERT INTO praise_contest_entries VALUES(1,'c','published','dummy'),(2,'c','published','dummy'),(3,'c','held','dummy'),(4,'c','published',NULL);`);
  return {
    db,
    reserve: (id, attempt) => db.prepare(reserveSql).run('c', id, id, 500000, 'checked', attempt, id, 'c').changes,
    result: (id, attempt, status, ref = null) => db.prepare(resultSql).run(status, ref, 'bank checked', 'c', id, attempt).changes,
  };
}

test('duplicate reservations and completed payment changes are blocked', () => {
  const { db, reserve, result } = setup();
  assert.equal(reserve(1, 'a'), 1);
  assert.equal(reserve(1, 'b'), 0);
  assert.equal(result(1, 'a', 'paid', 'REF-1'), 1);
  assert.equal(reserve(1, 'c'), 0);
  assert.equal(result(1, 'a', 'failed'), 0);
  db.close();
});

test('failure can be retried and stale results cannot alter a new attempt', () => {
  const { db, reserve, result } = setup();
  assert.equal(reserve(1, 'a'), 1);
  assert.equal(result(1, 'a', 'failed'), 1);
  assert.equal(reserve(1, 'b'), 1);
  assert.equal(result(1, 'a', 'failed'), 0);
  assert.equal(result(1, 'a', 'paid', 'OLD'), 0);
  assert.equal(result(1, 'b', 'paid', 'NEW'), 1);
  db.close();
});

test('duplicate bank references reject the transaction without changing processing status', () => {
  const { db, reserve, result } = setup();
  reserve(1, 'a'); result(1, 'a', 'paid', 'REF'); reserve(2, 'b');
  assert.throws(() => result(2, 'b', 'paid', 'REF'), /UNIQUE constraint/);
  assert.equal(db.prepare('SELECT status FROM praise_contest_payments WHERE entry_id=2').get().status, 'processing');
  db.close();
});

test('held or missing-account entries cannot reserve, existing held payments can record bank results', () => {
  const { db, reserve, result } = setup();
  assert.equal(reserve(3, 'a'), 0);
  assert.equal(reserve(4, 'a'), 0);
  reserve(1, 'a');
  db.exec("UPDATE praise_contest_entries SET status='held' WHERE id=1");
  assert.equal(result(1, 'a', 'paid', 'REF'), 1);
  db.close();
});

test('audit records are created only for a successful transition', () => {
  const { db, reserve } = setup();
  reserve(1, 'a');
  db.prepare(auditSql).run(1, 'reserve', '{}');
  reserve(1, 'b');
  db.prepare(auditSql).run(1, 'reserve', '{}');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM praise_contest_audit').get().n, 1);
  db.close();
});

function reconciliationFixture() {
  const { db } = setup();
  db.exec(`CREATE TABLE praise_contest_votes(contest_id TEXT,entry_id INTEGER);
    CREATE TABLE praise_contest_vote_events(contest_id TEXT,entry_id INTEGER,delta INTEGER);`);
  return { db, mismatches: () => db.prepare(reconciliationSql).get('c').mismatches };
}

test('reconciliation accepts empty entries and matching cumulative changes including undo', () => {
  const { db, mismatches } = reconciliationFixture();
  assert.equal(mismatches(), 0);
  db.exec(`INSERT INTO praise_contest_votes VALUES('c',1);
    INSERT INTO praise_contest_vote_events VALUES('c',1,1),('c',1,-1),('c',1,1),('c',2,1),('c',2,-1);`);
  assert.equal(mismatches(), 0);
  db.close();
});

test('reconciliation finds missing, excessive, and negative event balances across entries', () => {
  const { db, mismatches } = reconciliationFixture();
  db.exec(`INSERT INTO praise_contest_votes VALUES('c',1);
    INSERT INTO praise_contest_vote_events VALUES('c',2,1),('c',3,-1);`);
  assert.equal(mismatches(), 3);
  db.close();
});

test('reconciliation isolates the selected contest', () => {
  const { db, mismatches } = reconciliationFixture();
  db.exec(`INSERT INTO praise_contest_entries VALUES(5,'other','published','dummy');
    INSERT INTO praise_contest_votes VALUES('other',5),('other',1);
    INSERT INTO praise_contest_vote_events VALUES('other',2,-1);`);
  assert.equal(mismatches(), 0);
  db.close();
});
