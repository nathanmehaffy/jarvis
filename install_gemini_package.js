const fs = require('fs');

// Add @google/generative-ai to package.json
let packageContent = fs.readFileSync('package.json', 'utf8');
let packageJson = JSON.parse(packageContent);

// Add the dependency
if (!packageJson.dependencies) {
  packageJson.dependencies = {};
}

packageJson.dependencies['@google/generative-ai'] = '^0.21.0';

fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
console.log('✅ Added @google/generative-ai to package.json');

