#!/usr/bin/env node
/**
 * One-off codemod: converts the neon accent palette to the monochrome brand.
 *
 * Run a preview first:   node scripts/monochrome.mjs --dry
 * Then apply:            node scripts/monochrome.mjs
 * Undo at any point:     git checkout -- src
 *
 * Only literal colour tokens are touched. Layout, logic, and Supabase code are
 * never matched by these patterns.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = "src";
const DRY = process.argv.includes("--dry");

/** Order matters: longer patterns first so they are not partially matched. */
const RULES = [
  // Primary accent -> white
  [/#f9a8d4/gi, "#FFFFFF"],
  [/#f472b6/gi, "#C4C4C4"],
  [/#ec4899/gi, "#C4C4C4"],

  // Named accent scales -> neutral
  [/\bfuchsia-(\d{3})\b/g, "white"],
  [/\bpink-(\d{3})\b/g, "white"],
  [/\bviolet-(\d{3})\b/g, "white"],
  [/\bcyan-(\d{3})\b/g, "white"],
  [/\brose-(\d{3})\b/g, "white"],
  [/\bpurple-(\d{3})\b/g, "white"],

  // Tailwind rejects a shade suffix on `white`, so collapse the leftovers.
  [/\bwhite-\d{3}\b/g, "white"],

  // Gradients built from the old palette flatten to a single surface.
  [/bg-gradient-to-[a-z]+ from-white(\/\d+)? (via-white(\/\d+)? )?to-white(\/\d+)?/g, "bg-white/10"],

  // Panel surfaces from the neon theme -> brand greys
  [/#050508/g, "#000000"],
  [/#0a0a0f/g, "#141414"],
];

const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(tsx?|css)$/.test(entry)) files.push(path);
  }
})(ROOT);

let changedFiles = 0;
let changedLines = 0;

for (const file of files) {
  const before = readFileSync(file, "utf8");
  let after = before;
  for (const [pattern, replacement] of RULES) after = after.replace(pattern, replacement);

  if (after === before) continue;

  changedFiles += 1;
  const a = before.split("\n");
  const b = after.split("\n");
  const hits = a.reduce((sum, line, index) => sum + (line === b[index] ? 0 : 1), 0);
  changedLines += hits;

  console.log(`${DRY ? "would change" : "changed"}  ${file}  (${hits} lines)`);
  if (!DRY) writeFileSync(file, after);
}

console.log(
  `\n${DRY ? "Preview" : "Done"}: ${changedFiles} files, ${changedLines} lines.` +
    (DRY ? "\nRun without --dry to apply." : "\nReview with: git diff"),
);
