const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('./src');
let changedFiles = 0;

files.forEach((file) => {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  // Pattern 1: exactly matching same names, e.g. bg-grey6 dark:bg-grey6-dark -> bg-grey6
  content = content.replace(/\bdark:(bg|text|border|fill)-([a-zA-Z0-9_]+)-dark\b/g, '');

  // Pattern 2: bg-white dark:bg-white-dark -> bg-screen
  content = content.replace(/\bbg-white\s+dark:bg-white-dark\b/g, 'bg-screen');
  content = content.replace(/\bdark:bg-white-dark\s+bg-white\b/g, 'bg-screen');

  // Pattern 3: bg-white dark:bg-screen-dark -> bg-screen
  content = content.replace(/\bbg-white\s+dark:bg-screen-dark\b/g, 'bg-screen');

  // Pattern 4: any remaining dark:bg-*-dark that weren't caught (maybe standalone)
  // we already stripped them in Pattern 1, which just removes the dark class.
  // Example: `bg-background dark:bg-background-dark` becomes `bg-background `

  // Pattern 5: bg-white dark:bg-screen_background -> bg-screen
  content = content.replace(/\bbg-white\s+dark:bg-screen_background\b/g, 'bg-screen');
  content = content.replace(
    /\bdark:bg-screen_background\s+flex-1\s+bg-background\b/g,
    'flex-1 bg-screen'
  );

  // Let's also fix dark:bg-black where it's redundant if the default is dark
  // Actually, wait, if background is bg-white and we want it to be black in dark mode, we don't need dark:bg-black if we use bg-screen or bg-card!

  // Let's just do a clean up of multiple spaces inside classNames
  content = content.replace(/className=(['"`])([^'"`]+)\1/g, (match, quote, classes) => {
    return `className=${quote}${classes.replace(/\s+/g, ' ').trim()}${quote}`;
  });

  if (content !== original) {
    fs.writeFileSync(file, content);
    changedFiles++;
  }
});

console.log(`Updated ${changedFiles} files.`);
