// @ts-check

/**
 * Every commit a journal entry points at must actually exist in this repository's history,
 * otherwise the link 404s for readers. Entries may carry the literal placeholder `pending`
 * while the build commit is being made, since an entry cannot know its own commit hash.
 *
 * Usage: node .github/scripts/check-journal-links.mjs [rootDir]
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] ?? '.';
const journalPath = join(root, 'JOURNAL.md');

if (!existsSync(journalPath)) {
  console.log('no JOURNAL.md, nothing to check');
  process.exit(0);
}

/** @param {string[]} args */
function git(args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

/**
 * @param {string} hash
 * @returns {boolean}
 */
function reachable(hash) {
  if (git(['cat-file', '-t', hash]) !== 'commit') return false;
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', hash, 'HEAD'], { cwd: root, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const journal = readFileSync(journalPath, 'utf8');
/** @type {string[]} */
const problems = [];
let checked = 0;

for (const entry of journal.split(/\n(?=## )/)) {
  const heading = entry.match(/^##\s*(\d{4}-\d{2}-\d{2})\s*—\s*(.+)/);
  if (!heading) continue;
  const link = entry.match(/\*\*Commit:\*\*\s*\[`([^`]+)`\]/);
  if (!link) {
    problems.push(`"${heading[2].trim()}" (${heading[1]}) has no commit link`);
    continue;
  }
  const hash = link[1];
  if (hash === 'pending') continue;
  checked++;
  if (!reachable(hash)) {
    problems.push(
      `"${heading[2].trim()}" (${heading[1]}) links to commit ${hash}, which is not in this history. ` +
      'A hash from an amended or rebased commit 404s for readers; use the hash that is actually published.'
    );
  }
}

for (const problem of problems) console.error(`::error::${problem}`);

if (problems.length === 0) {
  console.log(`journal OK: ${checked} entr${checked === 1 ? 'y' : 'ies'} link to commits in this history`);
}
process.exit(problems.length === 0 ? 0 : 1);
