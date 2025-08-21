// src/services/database-init.js
/**
 * Script de atualização do banco para adicionar colunas necessárias aos links de pagamento
 * Este script trabalha em conjunto com o database.js existente
 * Execute com: node src/services/database-init.js
 */

const { db, isReady, getTableStructure } = require('./database');
const path = require('path');

/**
 * Adiciona colunas faltantes à tabela payment_links
 */
function updatePaymentLinksTable() {
  console.log('\n🔧 Atualizando tabela payment_links...\n');
  
  if (!isReady || !db) {
    console.error('❌ Banco de dados não está pronto');
    return false;
  }
  
  try {
    // Verificar se a tabela existe
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='payment_links'"
    ).get();
    
    if (!tableExists) {
      console.log('⚠️  Tabela payment_links não existe. Criando...');
      createPaymentLinksTableComplete();
      return true;
    }
    
    // Obter colunas existentes
    const existingColumns = db.prepare('PRAGMA table_info(payment_links)').all();
    const columnNames = existingColumns.map(col => col.name);
    
    console.log('📊 Colunas existentes:', columnNames.join(', '));
    
    // Definir colunas necessárias para o sistema de links PIX
    const requiredColumns = [
      { name: 'external_reference', type: 'TEXT', description: 'Referência externa do MP' },
      { name: 'mp_preference_id', type: 'TEXT', description: 'ID da preference no MP' },
      { name: 'init_point', type: 'TEXT', description: 'URL de pagamento produção' },
      { name: 'sandbox_init_point', type: 'TEXT', description: 'URL de pagamento sandbox' },
      { name: 'customer_email', type: 'TEXT', description: 'Email do cliente' },
      { name: 'customer_name', type: 'TEXT', description: 'Nome do cliente' },
      { name: 'customer_cpf', type: 'TEXT', description: 'CPF do cliente' },
      { name: 'expires_at', type: 'DATETIME', description: 'Data de expiração do link' }
    ];
    
    let columnsAdded = 0;
    
    // Adicionar colunas faltantes
    for (const column of requiredColumns) {
      if (!columnNames.includes(column.name)) {
        try {
          console.log(`\n➕ Adicionando coluna '${column.name}'...`);
          console.log(`   📝 ${column.description}`);
          
          db.exec(`ALTER TABLE payment_links ADD COLUMN ${column.name} ${column.type}`);
          
          console.log(`   ✅ Coluna '${column.name}' adicionada com sucesso!`);
          columnsAdded++;
          
        } catch (error) {
          // Se der erro de coluna já existe, não é problema
          if (error.message.includes('duplicate column')) {
            console.log(`   ℹ️  Coluna '${column.name}' já existe (OK)`);
          } else {
            console.error(`   ⚠️  Não foi possível adicionar '${column.name}': ${error.message}`);
          }
        }
      } else {
        console.log(`✅ Coluna '${column.name}' já existe`);
      }
    }
    
    // Criar índices se não existirem
    console.log('\n🔍 Criando/verificando índices...\n');
    
    const indices = [
      { name: 'idx_link_external_ref', column: 'external_reference' },
      { name: 'idx_link_payment_id', column: 'payment_id' },
      { name: 'idx_link_mp_preference', column: 'mp_preference_id' }
    ];
    
    for (const index of indices) {
      try {
        db.exec(`CREATE INDEX IF NOT EXISTS ${index.name} ON payment_links(${index.column})`);
        console.log(`✅ Índice '${index.name}' verificado`);
      } catch (error) {
        console.log(`⚠️  Índice '${index.name}': ${error.message}`);
      }
    }
    
    if (columnsAdded > 0) {
      console.log(`\n✨ ${columnsAdded} colunas adicionadas com sucesso!`);
    } else {
      console.log('\n✅ Todas as colunas já existem, nenhuma alteração necessária.');
    }
    
    // Criar tabela de sessões se não existir (para compatibilidade com auth)
    createSessionsTable();
    
    // Criar tabela de notificações se não existir
    createNotificationsTable();
    
    return true;
    
  } catch (error) {
    console.error('❌ Erro ao atualizar tabela:', error);
    return false;
  }
}

/**
 * Cria a tabela payment_links completa (caso não exista)
 */
function createPaymentLinksTableComplete() {
  const createTableSQL = `
    CREATE TABLE payment_links (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'expired', 'cancelled')),
      mp_preference_id TEXT,
      init_point TEXT,
      sandbox_init_point TEXT,
      customer_email TEXT,
      customer_name TEXT,
      customer_cpf TEXT,
      payment_id TEXT,
      payer_email TEXT,
      payment_method TEXT,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      paid_at DATETIME,
      external_reference TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `;
  
  db.exec(createTableSQL);
  console.log('✅ Tabela payment_links criada com todas as colunas necessárias!');
  
  // Criar índices
  db.exec('CREATE INDEX IF NOT EXISTS idx_user_links ON payment_links(user_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_link_status ON payment_links(status)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_link_created ON payment_links(created_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_link_external_ref ON payment_links(external_reference)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_link_payment_id ON payment_links(payment_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_link_mp_preference ON payment_links(mp_preference_id)');
}

/**
 * Cria tabela de sessões para autenticação JWT
 */
function createSessionsTable() {
  console.log('\n🔑 Verificando tabela de sessões...\n');
  
  try {
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'"
    ).get();
    
    if (!tableExists) {
      db.exec(`
        CREATE TABLE sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          token TEXT UNIQUE NOT NULL,
          expires_at DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      
      db.exec('CREATE INDEX IF NOT EXISTS idx_session_token ON sessions(token)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_session_expires ON sessions(expires_at)');
      
      console.log('✅ Tabela sessions criada com sucesso!');
    } else {
      console.log('✅ Tabela sessions já existe');
    }
  } catch (error) {
    console.log('⚠️  Erro ao criar tabela sessions:', error.message);
  }
}

/**
 * Cria tabela de notificações do Mercado Pago
 */
function createNotificationsTable() {
  console.log('\n🔔 Verificando tabela de notificações...\n');
  
  try {
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='payment_notifications'"
    ).get();
    
    if (!tableExists) {
      db.exec(`
        CREATE TABLE payment_notifications (
          id TEXT PRIMARY KEY,
          link_id TEXT,
          mp_notification_id TEXT,
          notification_type TEXT,
          status TEXT,
          data TEXT,
          processed BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          processed_at DATETIME,
          FOREIGN KEY (link_id) REFERENCES payment_links(id) ON DELETE CASCADE
        )
      `);
      
      db.exec('CREATE INDEX IF NOT EXISTS idx_notification_link ON payment_notifications(link_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_notification_processed ON payment_notifications(processed)');
      
      console.log('✅ Tabela payment_notifications criada com sucesso!');
    } else {
      console.log('✅ Tabela payment_notifications já existe');
    }
  } catch (error) {
    console.log('⚠️  Erro ao criar tabela payment_notifications:', error.message);
  }
}

/**
 * Mostra estatísticas do banco
 */
function showStats() {
  console.log('\n📊 Estatísticas do banco:\n');
  
  try {
    const stats = {
      users: db.prepare('SELECT COUNT(*) as count FROM users').get().count,
      payment_links: db.prepare('SELECT COUNT(*) as count FROM payment_links').get().count,
      paid_links: db.prepare("SELECT COUNT(*) as count FROM payment_links WHERE status = 'paid'").get().count,
      sessions: 0,
      notifications: 0
    };
    
    // Tentar contar sessões e notificações (podem não existir ainda)
    try {
      stats.sessions = db.prepare('SELECT COUNT(*) as count FROM sessions').get().count;
    } catch (e) {}
    
    try {
      stats.notifications = db.prepare('SELECT COUNT(*) as count FROM payment_notifications').get().count;
    } catch (e) {}
    
    console.log(`👤 Usuários: ${stats.users}`);
    console.log(`🔗 Links de pagamento: ${stats.payment_links}`);
    console.log(`💰 Links pagos: ${stats.paid_links}`);
    console.log(`🔑 Sessões ativas: ${stats.sessions}`);
    console.log(`🔔 Notificações: ${stats.notifications}`);
    
  } catch (error) {
    console.error('⚠️  Erro ao obter estatísticas:', error.message);
  }
}

/**
 * Função principal
 */
function main() {
  console.log(`
╔══════════════════════════════════════════════════╗
║   Atualização do Banco - MP Payment Links 🚀    ║
╚══════════════════════════════════════════════════╝
  `);
  
  if (!isReady) {
    console.error('❌ Banco de dados não está pronto. Verifique o arquivo database.js');
    process.exit(1);
  }
  
  // Mostrar estrutura atual da tabela users
  console.log('📋 Estrutura atual da tabela users:');
  const userStructure = getTableStructure('users');
  if (userStructure) {
    userStructure.forEach(col => {
      console.log(`   - ${col.name} (${col.type})${col.notNull ? ' NOT NULL' : ''}${col.primaryKey ? ' [PK]' : ''}`);
    });
  }
  
  // Atualizar payment_links
  const success = updatePaymentLinksTable();
  
  if (success) {
    // Mostrar estatísticas
    showStats();
    
    console.log(`
╔══════════════════════════════════════════════════╗
║   ✅ Banco atualizado com sucesso!              ║
║                                                  ║
║   Próximos passos:                              ║
║   1. Configure as variáveis no .env             ║
║   2. Reinicie o servidor: npm run dev           ║
║   3. Teste a API de links de pagamento          ║
╚══════════════════════════════════════════════════╝
    `);
    process.exit(0);
  } else {
    console.error('\n❌ Falha na atualização do banco');
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  main();
}

module.exports = {
  updatePaymentLinksTable,
  createSessionsTable,
  createNotificationsTable
};
