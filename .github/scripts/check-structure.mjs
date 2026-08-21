// @ts-check

/**
 * Structural gate for the landing page and the day's builds. Everything checked here is something
 * AGENTS.md promises a model will produce, so a model that follows the brief without ever looking
 * at an existing build still passes.
 *
 * Usage: node .github/scripts/check-structure.mjs [rootDir]
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] ?? '.';

/** Names of the tools a model runs inside. Every model shares these, so none may claim one. */
const HARNESS_SLUGS = new Set([
  'githubcopilot', 'copilot', 'copilotchat', 'github', 'vscode', 'visualstudiocode',
  'cursor', 'windsurf', 'cline', 'continue', 'aider', 'chat', 'chatbot',
  'agent', 'assistant', 'ai', 'bot', 'model', 'llm',
]);

/** @type {string[]} */
const problems = [];

/** @param {string} message */
function fail(message) {
  problems.push(message);
}

/**
 * @param {string} html
 * @param {string} className
 * @returns {string | null}
 */
function childText(html, className) {
  const match = html.match(new RegExp(`<div class="${className}"[^>]*>([\\s\\S]*?)</div>`, 'i'));
  if (!match) return null;
  const text = match[1].replace(/<[^>]+>/g, '').replace(/&[a-z]+;|&#\d+;/gi, ' ').trim();
  return text.length > 0 ? text : null;
}

/**
 * Relative targets a browser would actually fetch, ignoring anchors and absolute URLs.
 * @param {string} html
 * @returns {string[]}
 */
function localReferences(html) {
  return [...html.matchAll(/(?:src|href)="([^"]+)"/gi)]
    .map(match => match[1])
    .filter(reference => !/^(?:[a-z]+:|\/\/|#|\/)/i.test(reference));
}

if (!existsSync(join(root, 'index.html'))) {
  fail('the root index.html is missing');
} else if (!existsSync(join(root, '.nojekyll'))) {
  fail('.nojekyll is missing, so GitHub Pages will run Jekyll over the site');
}

if (problems.length === 0) {
  const landing = readFileSync(join(root, 'index.html'), 'utf8');

  if (!/<h2[^>]*>[^<]*today's pairings<\/h2>/i.test(landing)) {
    fail("the landing page has no \"<date> &middot; today's pairings\" heading");
  }

  const cards = [...landing.matchAll(/<a class="build"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
  if (cards.length === 0) {
    fail('the landing page lists no builds');
  }

  /** @type {Set<string>} */
  const listed = new Set();
  for (const [, href, inner] of cards) {
    if (!/^[a-z0-9]+\/index\.html$/.test(href)) {
      fail(`card href "${href}" must be exactly {model}/index.html, lowercase and unpunctuated`);
      continue;
    }
    const slug = href.split('/')[0];
    if (HARNESS_SLUGS.has(slug)) {
      fail(`"${slug}" names the tool you are running inside, not a model. Use the model picker's name, such as claudeopus5 or gpt56sol, or every model that ever builds here collides on one directory`);
    }
    if (listed.has(slug)) fail(`"${slug}" is listed on the landing page more than once`);
    listed.add(slug);

    for (const field of ['model', 'buildtitle', 'pairing', 'buildsub']) {
      if (childText(inner, field) === null) fail(`the card for "${slug}" is missing a non-empty <div class="${field}">`);
    }

    const pairing = childText(inner, 'pairing');
    if (pairing !== null && !/\u2194|&harr;/i.test(inner)) {
      fail(`the card for "${slug}" must state its pairing as "system A &harr; system B"`);
    }

    const hook = childText(inner, 'buildsub');
    if (hook !== null) {
      const words = hook.split(/\s+/).filter(Boolean).length;
      if (words > 55) fail(`the hook for "${slug}" runs to ${words} words; keep it under about 45`);
    }
  }

  for (const reference of localReferences(landing)) {
    const target = join(root, reference);
    if (!existsSync(target)) fail(`the landing page links to "${reference}", which is not committed`);
    else if (statSync(target).isDirectory() && !existsSync(join(target, 'index.html'))) {
      fail(`the landing page links to the directory "${reference}", which has no index.html`);
    }
  }

  const buildDirs = readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'journal')
    .map(entry => entry.name)
    .filter(name => existsSync(join(root, name, 'index.html')));

  for (const slug of buildDirs) {
    if (!listed.has(slug)) {
      fail(`"${slug}/index.html" exists but no card on the landing page points to it`);
    }
    const page = readFileSync(join(root, slug, 'index.html'), 'utf8');
    for (const reference of localReferences(page)) {
      if (!existsSync(join(root, slug, reference))) {
        fail(`"${slug}" loads "${reference}", which is not committed`);
      }
    }

    for (const file of readdirSync(join(root, slug)).filter(name => name.endsWith('.js'))) {
      const source = readFileSync(join(root, slug, file), 'utf8');
      if (!/^\s*(?:\/\/|\/\*)\s*@ts-check/m.test(source)) {
        fail(`"${slug}/${file}" has no "// @ts-check"; every module in a build is type-checked, tests included`);
      }
    }
  }

  if (problems.length === 0) {
    console.log(`landing page OK: ${cards.length} build(s), every referenced file committed`);
  }
}

for (const problem of problems) {
  console.error(`::error::${problem}`);
}
process.exit(problems.length === 0 ? 0 : 1);
