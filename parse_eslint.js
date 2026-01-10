
const fs = require('fs');
const report = JSON.parse(fs.readFileSync('eslint_report.json', 'utf8'));

report.forEach(file => {
    const depsWarnings = file.messages.filter(m => m.ruleId === 'react-hooks/exhaustive-deps');
    if (depsWarnings.length > 0) {
        console.log(`File: ${file.filePath}`);
        depsWarnings.forEach(w => {
            console.log(`  Line ${w.line}: ${w.message}`);
        });
    }
});
