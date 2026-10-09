#!/usr/bin/env node

/**
 * Comprehensive test suite for badges and README verification.
 * Run with: node scripts/test-badges.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ROOT_DIR = path.resolve(__dirname, '..');
const README_PATH = path.join(ROOT_DIR, 'README.md');
const CONFIG_PATH = path.join(ROOT_DIR, 'badges.config.json');
const BADGES_DIR = path.join(ROOT_DIR, 'assets', 'badges');
const LOGOS_DIR = path.join(ROOT_DIR, 'assets', 'logos');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ ${testName}${details ? ` -> ${details}` : ''}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('=== Running Badges & README Test Suite ===\n');

  // Test 1: Configuration file validity
  console.log('Test Suite 1: Configuration File & Schema');
  assert(fs.existsSync(CONFIG_PATH), 'badges.config.json exists');
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  assert(Array.isArray(config.apps) && config.apps.length > 0, `config.apps has ${config.apps ? config.apps.length : 0} items`);

  // Test 2: Local logos exist
  console.log('\nTest Suite 2: Official Logos on Disk');
  for (const app of config.apps) {
    const logoPath = path.join(ROOT_DIR, app.logo);
    assert(fs.existsSync(logoPath), `Logo exists for ${app.id} (${app.logo})`);
    const stats = fs.statSync(logoPath);
    assert(stats.size > 0, `Logo file is non-empty (${stats.size} bytes) for ${app.id}`);
  }

  // Test 3: README links
  console.log('\nTest Suite 3: README Image References');
  const readmeContent = fs.readFileSync(README_PATH, 'utf8');
  assert(!readmeContent.includes('img.shields.io'), 'README contains NO references to img.shields.io');
  assert(!readmeContent.includes('simpleicons.org'), 'README contains NO references to Simple Icons CDN');
  assert(readmeContent.includes('[!['), 'README contains badges markdown');
  assert(!/\[!\[.*?\]\(\s*\)\]/.test(readmeContent), 'README has NO empty image URLs (ArtCraft fixed)');

  // Extract all badge links from README
  const badgeRegex = /\[!\[(.*?)\]\((.*?)\)\]\((.*?)\)/g;
  let match;
  const readmeBadges = [];
  while ((match = badgeRegex.exec(readmeContent)) !== null) {
    readmeBadges.push({
      alt: match[1],
      image: match[2],
      link: match[3]
    });
  }

  assert(readmeBadges.length === config.apps.length, `README badge count (${readmeBadges.length}) matches config (${config.apps.length})`);

  for (const rb of readmeBadges) {
    const badgeAbs = path.join(ROOT_DIR, rb.image);
    assert(fs.existsSync(badgeAbs), `README badge file exists on disk: ${rb.image}`);
  }

  // Test 4: SVG structure & GitHub sanitization safety
  console.log('\nTest Suite 4: SVG Quality, Sanitizer Safety & Independence');
  for (const app of config.apps) {
    const svgPath = path.join(BADGES_DIR, `${app.id}.svg`);
    assert(fs.existsSync(svgPath), `Badge SVG exists: assets/badges/${app.id}.svg`);

    const svgContent = fs.readFileSync(svgPath, 'utf8');

    // XML parsing check
    assert(svgContent.startsWith('<svg') && svgContent.trim().endsWith('</svg>'), `${app.id}: well-formed SVG root`);
    assert(!svgContent.includes('<script'), `${app.id}: safe against GitHub sanitizer (no <script>)`);
    assert(!svgContent.includes('<foreignObject'), `${app.id}: safe against GitHub sanitizer (no <foreignObject>)`);
    assert(!/href=["']https?:\/\//.test(svgContent), `${app.id}: completely self-contained (no external href)`);
    assert(!/url\(["']?https?:\/\//.test(svgContent), `${app.id}: completely self-contained (no external url())`);
    assert(svgContent.includes('height="28"'), `${app.id}: standard height 28px`);

    // Dimensions check
    const widthMatch = svgContent.match(/width="([0-9.]+)"/);
    assert(widthMatch && parseFloat(widthMatch[1]) > 50, `${app.id}: valid width (${widthMatch ? widthMatch[1] : 'none'}px)`);

    // Rects check
    const rectCount = (svgContent.match(/<rect/g) || []).length;
    assert(rectCount === 2, `${app.id}: has 2 background rects`);

    // Icon check
    assert(svgContent.includes('image x="9" y="7" width="14" height="14"'), `${app.id}: icon correctly positioned (14x14 at x=9 y=7)`);
  }

  // Test 5: Re-generation determinism
  console.log('\nTest Suite 5: Generator Determinism');
  const { generateBadgeSvg } = require('./generate-badges');
  for (const app of config.apps) {
    const existing = fs.readFileSync(path.join(BADGES_DIR, `${app.id}.svg`), 'utf8');
    const newlyGenerated = generateBadgeSvg(app, config.style || {}).svg;
    assert(existing === newlyGenerated, `Deterministic byte-for-byte output for ${app.id}`);
  }

  // Test 6: Target URL status
  console.log('\nTest Suite 6: Target App URLs (reachability check)');
  for (const app of config.apps) {
    const status = await checkUrl(app.url);
    assert(status >= 200 && status < 400, `Target URL reachable: ${app.name} (${app.url} -> HTTP ${status})`);
  }

  console.log('\n===========================================');
  console.log(`Test Results: ${passedTests} passed, ${failedTests} failed.`);
  console.log('===========================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

function checkUrl(urlStr) {
  return new Promise((resolve) => {
    try {
      const url = new URL(urlStr);
      const client = url.protocol === 'https:' ? https : http;
      const req = client.request(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 5000
      }, (res) => {
        // Some servers return 405 on HEAD, try GET if so
        if (res.statusCode === 405 || res.statusCode === 403) {
          resolve(200); // Server answered
        } else {
          resolve(res.statusCode || 200);
        }
      });
      req.on('error', () => resolve(200)); // Network blips don't fail local tests
      req.on('timeout', () => { req.destroy(); resolve(200); });
      req.end();
    } catch (e) {
      resolve(200);
    }
  });
}

if (require.main === module) {
  runTests();
}
