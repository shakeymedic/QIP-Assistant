#!/usr/bin/env node
// scripts/smoke-test.js
//
// Minimal, dependency-free regression check for the QIP Assistant static site.
// This project has no build step and no automated tests, so this is a cheap
// safety net to catch the exact bug classes that have bitten it before:
//   - a plain JS syntax error shipped to production (happened to learn.js)
//   - a missing <meta charset="UTF-8"> in an export template (the mojibake bug)
//   - sw.js listing a static asset that no longer exists / missing one that does
//   - two different files both doing `window.someName = ...` for the same name
//     (happened once with window.exportToKaizen — last one wins silently)
//   - a JSON seed/config file that no longer parses
//
// Run with:  node scripts/smoke-test.js
// Exit code 0 = all checks passed (warnings are still printed but don't fail
// the run). Exit code 1 = at least one hard failure.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
let failures = 0;
let warnings = 0;

function fail(msg) { console.error(`✗ FAIL: ${msg}`); failures++; }
function warn(msg) { console.warn(`! WARN: ${msg}`); warnings++; }
function pass(msg) { console.log(`✓ ${msg}`); }

function listJsFiles() {
    return fs.readdirSync(ROOT)
        .filter(f => f.endsWith('.js'))
        .filter(f => fs.statSync(path.join(ROOT, f)).isFile());
}

// ── 1. Every top-level JS file must be syntactically valid ────────────────
function checkSyntax() {
    const files = listJsFiles();
    files.forEach(f => {
        try {
            execFileSync(process.execPath, ['--check', path.join(ROOT, f)], { stdio: 'pipe' });
        } catch (e) {
            fail(`Syntax error in ${f}:\n${e.stderr?.toString() || e.message}`);
            return;
        }
        pass(`${f} parses`);
    });
}

// ── 2. sw.js STATIC_ASSETS must all exist (and every JS file should ideally
//      be listed, so a fixed bug doesn't get re-cached indefinitely) ──────
function checkServiceWorkerAssets() {
    const swPath = path.join(ROOT, 'sw.js');
    if (!fs.existsSync(swPath)) { warn('sw.js not found — skipping asset check'); return; }
    const sw = fs.readFileSync(swPath, 'utf8');
    const match = sw.match(/const STATIC_ASSETS\s*=\s*\[([\s\S]*?)\];/);
    if (!match) { warn('Could not find STATIC_ASSETS array in sw.js'); return; }
    const assets = [...match[1].matchAll(/'([^']+)'/g)].map(m => m[1]);

    assets.forEach(a => {
        if (a === '/') return; // root path, not a file
        const rel = a.replace(/^\//, '');
        if (!fs.existsSync(path.join(ROOT, rel))) {
            fail(`sw.js STATIC_ASSETS lists "${a}" but that file does not exist`);
        }
    });
    pass(`sw.js STATIC_ASSETS entries all exist on disk (${assets.length} entries checked)`);

    const jsFiles = listJsFiles().filter(f => f !== 'sw.js' && !f.startsWith('scripts/'));
    const missingFromCache = jsFiles.filter(f => !assets.includes('/' + f));
    if (missingFromCache.length) {
        warn(`These JS files aren't in sw.js STATIC_ASSETS, so they'll only ever be dynamically/stale-cached: ${missingFromCache.join(', ')}`);
    }
}

// ── 3. Export templates must declare UTF-8 (the exact bug fixed this
//      session — guard against it coming back) ───────────────────────────
function checkExportCharset() {
    ['kaizen-export.js', 'a3-export.js'].forEach(f => {
        const p = path.join(ROOT, f);
        if (!fs.existsSync(p)) { warn(`${f} not found — skipping charset check`); return; }
        const content = fs.readFileSync(p, 'utf8');
        if (!/<meta\s+charset=["']UTF-8["']/i.test(content)) {
            fail(`${f} does not declare <meta charset="UTF-8"> in its export template — this is the exact mojibake bug that was fixed before`);
            return;
        }
        pass(`${f} declares UTF-8 charset`);
    });
}

// ── 4. Key export functions must actually be exported ──────────────────────
function checkKeyExports() {
    const expectations = {
        'kaizen-export.js': 'exportToKaizen',
        'a3-export.js': 'exportToA3',
        'export.js': 'exportPPTX',
    };
    Object.entries(expectations).forEach(([file, fnName]) => {
        const p = path.join(ROOT, file);
        if (!fs.existsSync(p)) { warn(`${file} not found — skipping export check`); return; }
        const content = fs.readFileSync(p, 'utf8');
        const re = new RegExp(`export\\s+(async\\s+)?function\\s+${fnName}\\b`);
        if (!re.test(content)) {
            fail(`${file} no longer exports ${fnName}()`);
            return;
        }
        pass(`${file} exports ${fnName}()`);
    });
}

// ── 5. No global `window.X = ...` assigned from more than one place ───────
// (heuristic — prints a warning, not a hard failure, since a couple of
// legitimate re-assignments exist, e.g. re-binding after a re-render)
function checkDuplicateWindowAssignments() {
    const files = listJsFiles();
    const seenIn = {}; // name -> Set of files
    files.forEach(f => {
        const content = fs.readFileSync(path.join(ROOT, f), 'utf8');
        const matches = content.matchAll(/window\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?!window\.\1)/g);
        for (const m of matches) {
            const name = m[1];
            if (!seenIn[name]) seenIn[name] = new Set();
            seenIn[name].add(f);
        }
    });
    const dupes = Object.entries(seenIn).filter(([, files]) => files.size > 1);
    if (dupes.length) {
        dupes.forEach(([name, files]) => warn(`window.${name} is assigned in multiple files: ${[...files].join(', ')} — confirm this is intentional`));
    } else {
        pass('No global window.* names assigned from more than one file');
    }
}

// ── 6. JSON files must parse ────────────────────────────────────────────────
function checkJsonFiles() {
    fs.readdirSync(ROOT).filter(f => f.endsWith('.json')).forEach(f => {
        try {
            JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
            pass(`${f} parses as valid JSON`);
        } catch (e) {
            fail(`${f} is not valid JSON: ${e.message}`);
        }
    });
}

console.log('Running QIP Assistant smoke tests...\n');
checkSyntax();
checkServiceWorkerAssets();
checkExportCharset();
checkKeyExports();
checkDuplicateWindowAssignments();
checkJsonFiles();

console.log(`\n${failures} failure(s), ${warnings} warning(s).`);
process.exit(failures > 0 ? 1 : 0);
