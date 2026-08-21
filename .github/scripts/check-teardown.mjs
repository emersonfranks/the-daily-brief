// @ts-check

/**
 * Refuses a push that deletes another model's build without the day having rolled over.
 * The date heading on the landing page is the only evidence of a new day, so if this push
 * left it alone, nothing published under it may disappear.
 *
 * Usage: node .github/scripts/check-teardown.mjs <beforeSha>
 */

import { execFileSync } from 'node:child_process';

const EMPTY_SHA = '0000000000000000000000000000000000000000';
const before = process.argv[2];

/**
 * @param {string[]} args
 * @returns {string | null}
 */
function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' });
  } catch {
    return null;
  }
}

/**
 * @param {string} ref
 * @returns {string | null}
 */
function headingAt(ref) {
  const html = git(['show', `${ref}:index.html`]);
  if (html === null) return null;
  const match = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  return match ? match[1].replace(/\s+/g, ' ').trim() : null;
}

if (!before || before === EMPTY_SHA || git(['cat-file', '-e', `${before}^{commit}`]) === null) {
  console.log('no comparable previous commit, skipping the teardown check');
  process.exit(0);
}

const wasHeading = headingAt(before);
const nowHeading = headingAt('HEAD');
const diff = git(['diff', '--name-status', before, 'HEAD']) ?? '';

const deletedBuilds = new Set(
  diff.split('\n')
    .filter(line => line.startsWith('D'))
    .map(line => line.split('\t')[1])
    .filter(Boolean)
    .filter(path => /^[a-z0-9]+\/.+/.test(path) && !path.startsWith('journal/'))
    .map(path => path.split('/')[0])
);

if (deletedBuilds.size === 0) {
  console.log('no build directories removed by this push');
  process.exit(0);
}

const removed = [...deletedBuilds].join(', ');

// A retraction is the operator deliberately pulling a published build. It has to name the slug in
// the commit message, so it can never happen as a side effect of a rebase replaying old deletions.
const message = git(['log', '-1', '--format=%B', 'HEAD']) ?? '';
const retracted = new Set(
  [...message.matchAll(/^Retract:\s*([a-z0-9]+)/gim)].map(match => match[1].toLowerCase())
);
const unretracted = [...deletedBuilds].filter(slug => !retracted.has(slug));

if (retracted.size > 0) {
  console.log(`retraction requested for: ${[...retracted].join(', ')}`);
}

if (unretracted.length > 0 && wasHeading !== null && wasHeading === nowHeading) {
  console.error(
    `::error::this push deletes ${unretracted.join(', ')} while the landing page still reads "${nowHeading}". ` +
    'A build is only ever torn down because its day is over, so the date heading must change in the ' +
    'same push. If another model published today while you were working, your teardown is out of ' +
    "date: restore their files with `git checkout origin/main -- <dir>`, put their card back, and push only your own work. " +
    'To pull a published build on purpose, add a line reading "Retract: <slug> - reason" to the commit message.'
  );
  process.exit(1);
}

console.log(`teardown OK: ${removed} removed as the day rolled from "${wasHeading}" to "${nowHeading}"`);
