#!/usr/bin/env node
'use strict';

const tests = [
  require('./test-01-coverage'),
  require('./test-02-metrics'),
  require('./test-03-distinctness'),
  require('./test-04-shadow'),
  require('./test-05-roundtrip'),
  require('./test-06-rebuild'),
  require('./test-07-truetype'),
  require('./test-08-browser'),
  require('./test-09-not-copied'),
  require('./test-10-static-scan'),
];

async function main() {
  let passed = 0;
  for (let i = 0; i < tests.length; i++) {
    const ok = await tests[i].run();
    if (ok) passed++;
  }
  console.log(`\nSummary: ${passed}/${tests.length} tests passed.`);
  process.exit(passed === tests.length ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
