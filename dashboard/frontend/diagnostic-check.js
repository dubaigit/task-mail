const fs = require('fs');
const path = require('path');

console.log('=== EMAIL INTELLIGENCE DASHBOARD - DIAGNOSTIC CHECK ===\n');

// 1. Check if build directory exists and contains current CSS
const buildDir = path.join(__dirname, 'build');
const staticCssDir = path.join(buildDir, 'static', 'css');

console.log('1. BUILD OUTPUT CHECK:');
if (fs.existsSync(buildDir)) {
    console.log('✓ Build directory exists');
    
    if (fs.existsSync(staticCssDir)) {
        const cssFiles = fs.readdirSync(staticCssDir).filter(file => file.endsWith('.css'));
        console.log(`✓ Found ${cssFiles.length} CSS files:`);
        cssFiles.forEach(file => {
            const filePath = path.join(staticCssDir, file);
            const stats = fs.statSync(filePath);
            const sizeKB = Math.round(stats.size / 1024);
            console.log(`  - ${file} (${sizeKB}KB, modified: ${stats.mtime.toLocaleString()})`);
        });
        
        // Check if Material Design variables are in the built CSS
        const mainCssFile = cssFiles.find(file => file.startsWith('main.'));
        if (mainCssFile) {
            const cssContent = fs.readFileSync(path.join(staticCssDir, mainCssFile), 'utf8');
            const hasMD3Variables = cssContent.includes('--primary:220 88% 60%');
            const hasCustomAnimations = cssContent.includes('slideInUp');
            const hasDatePickerStyles = cssContent.includes('dateRangePicker');
            
            console.log(`  Analysis of ${mainCssFile}:`);
            console.log(`    - Material Design 3 variables: ${hasMD3Variables ? '✓' : '✗'}`);
            console.log(`    - Custom animations: ${hasCustomAnimations ? '✓' : '✗'}`);
            console.log(`    - DateRangePicker styles: ${hasDatePickerStyles ? '✓' : '✗'}`);
        }
    } else {
        console.log('✗ No static CSS directory found');
    }
} else {
    console.log('✗ Build directory does not exist');
}

console.log('\n2. SOURCE FILES CHECK:');

// 2. Check source files
const srcDir = path.join(__dirname, 'src');
const globalsPath = path.join(srcDir, 'styles', 'globals.css');
const indexPath = path.join(srcDir, 'index.tsx');
const layoutPath = path.join(srcDir, 'components', 'Layout.tsx');

if (fs.existsSync(globalsPath)) {
    const stats = fs.statSync(globalsPath);
    const sizeKB = Math.round(stats.size / 1024);
    console.log(`✓ globals.css exists (${sizeKB}KB, modified: ${stats.mtime.toLocaleString()})`);
    
    const content = fs.readFileSync(globalsPath, 'utf8');
    const hasMD3Variables = content.includes('--primary:220 88% 60%');
    console.log(`  - Contains Material Design 3 variables: ${hasMD3Variables ? '✓' : '✗'}`);
} else {
    console.log('✗ globals.css not found');
}

if (fs.existsSync(indexPath)) {
    const content = fs.readFileSync(indexPath, 'utf8');
    const importsCss = content.includes("import './styles/globals.css'");
    console.log(`✓ index.tsx exists`);
    console.log(`  - Imports globals.css: ${importsCss ? '✓' : '✗'}`);
} else {
    console.log('✗ index.tsx not found');
}

if (fs.existsSync(layoutPath)) {
    const stats = fs.statSync(layoutPath);
    console.log(`✓ Layout.tsx exists (modified: ${stats.mtime.toLocaleString()})`);
    
    const content = fs.readFileSync(layoutPath, 'utf8');
    const hasModernImports = content.includes('useTheme');
    const hasHeroIcons = content.includes('@heroicons/react');
    console.log(`  - Has modern React hooks: ${hasModernImports ? '✓' : '✗'}`);
    console.log(`  - Has Hero Icons: ${hasHeroIcons ? '✓' : '✗'}`);
} else {
    console.log('✗ Layout.tsx not found');
}

console.log('\n3. PACKAGE.JSON & DEPENDENCIES:');
const packagePath = path.join(__dirname, 'package.json');
if (fs.existsSync(packagePath)) {
    const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    console.log('✓ package.json exists');
    console.log(`  - React version: ${packageContent.dependencies?.react || 'Not found'}`);
    console.log(`  - TailwindCSS: ${packageContent.dependencies?.tailwindcss || 'Not found'}`);
    console.log(`  - Hero Icons: ${packageContent.dependencies?.['@heroicons/react'] || 'Not found'}`);
    
    console.log('\n  Build scripts:');
    Object.entries(packageContent.scripts || {}).forEach(([name, script]) => {
        console.log(`    ${name}: ${script}`);
    });
} else {
    console.log('✗ package.json not found');
}

console.log('\n4. BROWSER CACHE DIAGNOSTIC:');
console.log('Common reasons for old interface showing:');
console.log('  1. Browser cache - Try hard refresh (Cmd+Shift+R or Ctrl+Shift+R)');
console.log('  2. Service worker cache - Check DevTools > Application > Service Workers');
console.log('  3. Development server needs restart - Kill and restart "npm start"');
console.log('  4. Build artifacts are stale - Run "npm run build" to rebuild');
console.log('  5. Wrong URL - Ensure you\'re visiting http://localhost:3000');

console.log('\n5. RECOMMENDATIONS:');
console.log('To fix the issue:');
console.log('  1. Open browser DevTools (F12)');
console.log('  2. Check Console for JavaScript errors');
console.log('  3. Check Network tab to see which CSS file is being loaded');
console.log('  4. Check Elements tab to verify CSS variables are applied');
console.log('  5. Try incognito/private mode to bypass cache');

console.log('\n=== DIAGNOSTIC CHECK COMPLETE ===');