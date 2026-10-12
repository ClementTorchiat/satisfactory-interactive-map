const fs = require('fs');

const content = fs.readFileSync('scripts/map.js', 'utf8');

function findSnippets(pattern) {
  let idx = 0;
  while ((idx = content.indexOf(pattern, idx)) !== -1) {
    const start = Math.max(0, idx - 100);
    const end = Math.min(content.length, idx + 150);
    console.log('--- MATCH (' + pattern + ') ---');
    console.log(content.slice(start, end));
    idx += pattern.length;
  }
}

findSnippets('/api/v1/maps/');
findSnippets('/api/v1/locations');
findSnippets('/locations');
