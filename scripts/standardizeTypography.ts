#!/usr/bin/env tsx

/**
 * Script to standardize typography across the application
 * Following Virtual Stylist design system:
 * - Page titles (h1): text-2xl font-bold
 * - Section headers (h2): text-xl font-bold
 * - Card titles (h3): text-base font-semibold
 * - Labels: text-sm font-medium
 * - Body text: text-sm
 * - Captions: text-xs
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const replacements: Array<[RegExp, string, string]> = [
  // Page titles - h1
  [/className="text-3xl\s+font-bold/g, 'className="text-2xl font-bold', 'h1 titles'],
  [/className="text-4xl\s+font-bold/g, 'className="text-2xl font-bold', 'h1 titles'],
  [/className="text-5xl\s+font-bold/g, 'className="text-2xl font-bold', 'h1 titles (large)'],

  // Section headers - keep most text-xl or convert text-lg
  [/className="text-lg\s+font-bold/g, 'className="text-xl font-bold', 'h2 section headers'],

  // Large hero titles with responsive classes (special case for HomePage hero)
  [/text-4xl\s+sm:text-5xl\s+lg:text-6xl/g, 'text-3xl sm:text-4xl lg:text-5xl', 'hero responsive'],
  [/text-5xl\s+sm:text-6xl\s+lg:text-7xl/g, 'text-3xl sm:text-4xl lg:text-5xl', 'hero responsive large'],

  // Card/Feature titles - h3
  [/className="text-xl\s+font-bold(?!\s*text-white)/g, 'className="text-base font-semibold', 'card titles'],
  [/className="text-lg\s+font-semibold/g, 'className="text-base font-semibold', 'subsection titles'],

  // Modal titles (exception - keep text-lg for modal headers)
  // We'll handle modals separately to avoid breaking them

  // Large descriptive text
  [/className="text-xl\s+text-/g, 'className="text-base text-', 'large descriptions'],

  // Stats values - standardize to text-2xl
  [/text-3xl\s+font-semibold/g, 'text-2xl font-semibold', 'stat values'],
  [/text-4xl\s+font-bold(?!\s*text-slate-800)/g, 'text-2xl font-semibold', 'stat values bold'],
];

// Files to skip (already correct or need manual handling)
const skipFiles = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'standardizeTypography.ts'
];

function shouldProcessFile(filePath: string): boolean {
  return (
    (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) &&
    !filePath.includes('node_modules') &&
    !filePath.includes('.git') &&
    !filePath.includes('dist')
  );
}

function processFile(filePath: string): { changed: boolean; changes: string[] } {
  let content = readFileSync(filePath, 'utf-8');
  const originalContent = content;
  const changes: string[] = [];

  for (const [pattern, replacement, description] of replacements) {
    const matches = content.match(pattern);
    if (matches) {
      content = content.replace(pattern, replacement);
      changes.push(`  - ${description}: ${matches.length} occurrence(s)`);
    }
  }

  const changed = content !== originalContent;

  if (changed) {
    writeFileSync(filePath, content, 'utf-8');
  }

  return { changed, changes };
}

function processDirectory(dirPath: string): void {
  const entries = readdirSync(dirPath);

  for (const entry of entries) {
    if (skipFiles.includes(entry)) continue;

    const fullPath = join(dirPath, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (shouldProcessFile(fullPath)) {
      const { changed, changes } = processFile(fullPath);

      if (changed) {
        console.log(`\n✓ ${fullPath}`);
        changes.forEach(change => console.log(change));
      }
    }
  }
}

// Start processing
console.log('🎨 Standardizing typography across the application...\n');
console.log('Following Virtual Stylist design system:');
console.log('  - Page titles (h1): text-2xl font-bold');
console.log('  - Section headers (h2): text-xl font-bold');
console.log('  - Card titles (h3): text-base font-semibold');
console.log('  - Body text: text-sm');
console.log('  - Captions: text-xs\n');

const srcPath = join(process.cwd(), 'src');
processDirectory(srcPath);

console.log('\n✅ Typography standardization complete!');
