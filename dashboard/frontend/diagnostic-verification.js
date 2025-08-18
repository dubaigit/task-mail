#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Modern Email Interface Diagnostic Check\n');

// Check if ModernEmailInterface exists
const modernInterfacePath = path.join(__dirname, 'src', 'components', 'Email', 'ModernEmailInterface.tsx');
const modernInterfaceExists = fs.existsSync(modernInterfacePath);
console.log(`✅ ModernEmailInterface.tsx exists: ${modernInterfaceExists}`);

// Check if App.tsx imports it correctly
const appPath = path.join(__dirname, 'src', 'App.tsx');
if (fs.existsSync(appPath)) {
  const appContent = fs.readFileSync(appPath, 'utf8');
  const hasModernImport = appContent.includes('ModernEmailInterface');
  const hasCorrectRoute = appContent.includes('path="/" element={<ModernEmailInterface');
  
  console.log(`✅ App.tsx imports ModernEmailInterface: ${hasModernImport}`);
  console.log(`✅ App.tsx routes to ModernEmailInterface at "/": ${hasCorrectRoute}`);
}

// Check if globals.css has required CSS variables
const globalsPath = path.join(__dirname, 'src', 'styles', 'globals.css');
if (fs.existsSync(globalsPath)) {
  const cssContent = fs.readFileSync(globalsPath, 'utf8');
  const hasRadius = cssContent.includes('--radius:');
  const hasEmailInterface = cssContent.includes('.email-interface');
  
  console.log(`✅ globals.css has --radius variable: ${hasRadius}`);
  console.log(`✅ globals.css has email-interface styles: ${hasEmailInterface}`);
}

// Check if heroicons is installed
const packagePath = path.join(__dirname, 'package.json');
if (fs.existsSync(packagePath)) {
  const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const hasHeroicons = packageContent.dependencies && packageContent.dependencies['@heroicons/react'];
  
  console.log(`✅ @heroicons/react is installed: ${hasHeroicons}`);
}

console.log('\n🚀 Recommendations:');
console.log('1. Stop the development server (Ctrl+C)');
console.log('2. Clear browser cache or hard refresh (Ctrl+Shift+R / Cmd+Shift+R)');
console.log('3. Restart with: npm start');
console.log('4. Navigate to http://localhost:3000');
console.log('\nIf the modern interface still doesn\'t show, check the browser console for errors.');