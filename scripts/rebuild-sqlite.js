#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Reconstruindo better-sqlite3...');

try {
    // Remove o build antigo se existir
    const buildPath = path.join(__dirname, '..', 'node_modules', 'better-sqlite3', 'build');
    if (fs.existsSync(buildPath)) {
        console.log('🗑️  Removendo build antigo...');
        execSync(`rm -rf "${buildPath}"`, { stdio: 'inherit' });
    }
    
    // Reconstrói o módulo
    console.log('🔨 Recompilando módulo nativo...');
    execSync('npm rebuild better-sqlite3', { stdio: 'inherit' });
    
    console.log('✅ better-sqlite3 reconstruído com sucesso!');
} catch (error) {
    console.error('❌ Erro ao reconstruir better-sqlite3:', error.message);
    process.exit(1);
}