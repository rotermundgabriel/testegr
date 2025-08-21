// test-integration.js
// Script para testar se a integração está funcionando
// Execute com: node test-integration.js

require('dotenv').config();
const { generateToken } = require('./src/services/auth');
const { encryptAccessToken, validateMPAccessToken } = require('./src/utils/crypto');

console.log('🧪 Iniciando testes de integração...\n');

// Teste 1: Verificar variáveis de ambiente
console.log('1️⃣ Verificando variáveis de ambiente...');
const requiredEnvVars = ['JWT_SECRET', 'ENCRYPTION_KEY'];
let envOk = true;

for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    console.log(`   ❌ ${varName} não está configurada`);
    envOk = false;
  } else {
    console.log(`   ✅ ${varName} configurada`);
  }
}

if (!envOk) {
  console.log('\n⚠️  Configure as variáveis faltantes no arquivo .env');
  process.exit(1);
}

// Teste 2: Verificar banco de dados
console.log('\n2️⃣ Verificando banco de dados...');
try {
  // Usar o database.js existente
  const { db, isReady } = require('./src/services/database');
  
  if (!isReady) {
    console.log('   ❌ Banco de dados não está pronto');
  } else {
    console.log('   ✅ Conexão com banco estabelecida');
    
    // Verificar tabelas essenciais
    const tables = ['users', 'payment_links'];
    for (const table of tables) {
      const exists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table);
      if (exists) {
        console.log(`   ✅ Tabela '${table}' existe`);
        
        // Verificar colunas críticas para payment_links
        if (table === 'payment_links') {
          const columns = db.prepare(`PRAGMA table_info(payment_links)`).all();
          const columnNames = columns.map(c => c.name);
          
          const requiredColumns = ['external_reference', 'mp_preference_id', 'customer_email'];
          for (const col of requiredColumns) {
            if (columnNames.includes(col)) {
              console.log(`      ✅ Coluna '${col}' existe`);
            } else {
              console.log(`      ❌ Coluna '${col}' NÃO existe - execute npm run init-db`);
            }
          }
        }
      } else {
        console.log(`   ❌ Tabela '${table}' NÃO existe - execute npm run init-db`);
      }
    }
  }
} catch (error) {
  console.log(`   ❌ Erro ao acessar banco: ${error.message}`);
}

// Teste 3: Testar geração de token JWT
console.log('\n3️⃣ Testando autenticação JWT...');
try {
  const testPayload = {
    userId: 'test-user-123',
    email: 'test@example.com',
    name: 'Test Store'
  };
  
  const token = generateToken(testPayload);
  console.log(`   ✅ Token JWT gerado com sucesso`);
  console.log(`   📝 Exemplo de token: ${token.substring(0, 20)}...`);
} catch (error) {
  console.log(`   ❌ Erro ao gerar token: ${error.message}`);
}

// Teste 4: Testar criptografia
console.log('\n4️⃣ Testando criptografia de tokens...');
try {
  const testToken = 'TEST-1234567890';
  const encrypted = encryptAccessToken(testToken);
  console.log(`   ✅ Token criptografado com sucesso`);
  console.log(`   📝 Formato: ${encrypted.includes(':') ? 'IV:DATA (correto)' : 'incorreto'}`);
} catch (error) {
  console.log(`   ❌ Erro na criptografia: ${error.message}`);
}

// Teste 5: Validar formato de token MP
console.log('\n5️⃣ Testando validação de tokens MP...');
const testTokens = [
  { token: 'APP_USR-1234567890', expected: true },
  { token: 'TEST-1234567890', expected: true },
  { token: 'invalid-token', expected: false }
];

for (const test of testTokens) {
  const isValid = validateMPAccessToken(test.token);
  const status = isValid === test.expected ? '✅' : '❌';
  console.log(`   ${status} Token '${test.token}': ${isValid ? 'válido' : 'inválido'}`);
}

// Teste 6: Verificar se mercadopago está instalado
console.log('\n6️⃣ Verificando dependências...');
try {
  require('mercadopago');
  console.log('   ✅ Mercadopago SDK instalado');
} catch (error) {
  console.log('   ❌ Mercadopago SDK não instalado - execute: npm install mercadopago');
}

try {
  require('bcrypt');
  console.log('   ✅ Bcrypt instalado');
} catch (error) {
  console.log('   ❌ Bcrypt não instalado - execute: npm install bcrypt');
}

try {
  require('jsonwebtoken');
  console.log('   ✅ JWT instalado');
} catch (error) {
  console.log('   ❌ JWT não instalado - execute: npm install jsonwebtoken');
}

// Resumo
console.log('\n📊 Resumo dos Testes:');
console.log('====================');
console.log('Se todos os testes passaram (✅), o sistema está pronto!');
console.log('Se houver erros (❌), siga as instruções para corrigir.\n');
console.log('Próximos passos:');
console.log('1. Execute: npm run init-db (se necessário)');
console.log('2. Inicie o servidor: npm run dev');
console.log('3. Teste a criação de links via API\n');

