// src/services/database-init.js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

/**
 * Inicializa o banco de dados e cria as tabelas necessárias
 * Pode ser executado com: node src/services/database-init.js
 * Ou através do npm script: npm run init-db
 */
function initializeDatabase() {
  console.log('🔧 Iniciando configuração do banco de dados...\n');
  
  try {
    // Caminho do banco
    const dbPath = path.join(process.cwd(), 'database.db');
    
    // Criar conexão
    const db = new Database(dbPath);
    console.log(`✅ Conectado ao banco: ${dbPath}`);
    
    // Habilitar foreign keys
    db.pragma('foreign_keys = ON');
    
    // Array com todas as tabelas e suas queries de criação
    const tables = [
      {
        name: 'users',
        checkQuery: `SELECT name FROM sqlite_master WHERE type='table' AND name='users'`,
        createQuery: `
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            store_name TEXT NOT NULL,
            access_token TEXT NOT NULL,
            public_key TEXT NOT NULL,
            email TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `,
        columns: ['id', 'store_name', 'access_token', 'public_key', 'email', 'created_at', 'updated_at']
      },
      {
        name: 'payment_links',
        checkQuery: `SELECT name FROM sqlite_master WHERE type='table' AND name='payment_links'`,
        createQuery: `
          CREATE TABLE IF NOT EXISTS payment_links (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            description TEXT NOT NULL,
            amount REAL NOT NULL,
            status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'expired', 'cancelled')),
            external_reference TEXT UNIQUE NOT NULL,
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
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          )
        `,
        columns: [
          'id', 'user_id', 'description', 'amount', 'status',
          'external_reference', 'mp_preference_id', 'init_point', 'sandbox_init_point',
          'customer_email', 'customer_name', 'customer_cpf',
          'payment_id', 'payer_email', 'payment_method',
          'expires_at', 'created_at', 'paid_at'
        ]
      },
      {
        name: 'payment_notifications',
        checkQuery: `SELECT name FROM sqlite_master WHERE type='table' AND name='payment_notifications'`,
        createQuery: `
          CREATE TABLE IF NOT EXISTS payment_notifications (
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
        `,
        columns: [
          'id', 'link_id', 'mp_notification_id', 'notification_type',
          'status', 'data', 'processed', 'created_at', 'processed_at'
        ]
      },
      {
        name: 'sessions',
        checkQuery: `SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'`,
        createQuery: `
          CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            token TEXT UNIQUE NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          )
        `,
        columns: ['id', 'user_id', 'token', 'expires_at', 'created_at']
      }
    ];
    
    // Criar ou atualizar tabelas
    console.log('\n📊 Verificando tabelas...\n');
    
    for (const table of tables) {
      const exists = db.prepare(table.checkQuery).get();
      
      if (!exists) {
        // Criar tabela
        db.prepare(table.createQuery).run();
        console.log(`✅ Tabela '${table.name}' criada com sucesso`);
      } else {
        console.log(`ℹ️  Tabela '${table.name}' já existe`);
        
        // Verificar se precisa adicionar colunas novas
        const columnsInfo = db.prepare(`PRAGMA table_info(${table.name})`).all();
        const existingColumns = columnsInfo.map(col => col.name);
        const missingColumns = table.columns.filter(col => !existingColumns.includes(col));
        
        if (missingColumns.length > 0) {
          console.log(`   ⚠️  Colunas faltando em '${table.name}': ${missingColumns.join(', ')}`);
          
          // Adicionar colunas específicas que podem estar faltando
          if (table.name === 'payment_links') {
            // Adicionar colunas novas se não existirem
            const newColumns = [
              { name: 'mp_preference_id', type: 'TEXT', check: 'mp_preference_id' },
              { name: 'init_point', type: 'TEXT', check: 'init_point' },
              { name: 'sandbox_init_point', type: 'TEXT', check: 'sandbox_init_point' },
              { name: 'customer_email', type: 'TEXT', check: 'customer_email' },
              { name: 'customer_name', type: 'TEXT', check: 'customer_name' },
              { name: 'customer_cpf', type: 'TEXT', check: 'customer_cpf' },
              { name: 'expires_at', type: 'DATETIME', check: 'expires_at' }
            ];
            
            for (const col of newColumns) {
              if (!existingColumns.includes(col.check)) {
                try {
                  db.prepare(`ALTER TABLE payment_links ADD COLUMN ${col.name} ${col.type}`).run();
                  console.log(`   ✅ Coluna '${col.name}' adicionada`);
                } catch (err) {
                  // Coluna pode já existir ou ter erro
                  console.log(`   ⚠️  Não foi possível adicionar '${col.name}': ${err.message}`);
                }
              }
            }
          }
        }
      }
    }
    
    // Criar índices
    console.log('\n🔍 Criando índices...\n');
    
    const indices = [
      { name: 'idx_user_links', query: 'CREATE INDEX IF NOT EXISTS idx_user_links ON payment_links(user_id)' },
      { name: 'idx_link_status', query: 'CREATE INDEX IF NOT EXISTS idx_link_status ON payment_links(status)' },
      { name: 'idx_link_created', query: 'CREATE INDEX IF NOT EXISTS idx_link_created ON payment_links(created_at)' },
      { name: 'idx_link_external_ref', query: 'CREATE INDEX IF NOT EXISTS idx_link_external_ref ON payment_links(external_reference)' },
      { name: 'idx_link_payment_id', query: 'CREATE INDEX IF NOT EXISTS idx_link_payment_id ON payment_links(payment_id)' },
      { name: 'idx_session_token', query: 'CREATE INDEX IF NOT EXISTS idx_session_token ON sessions(token)' },
      { name: 'idx_session_expires', query: 'CREATE INDEX IF NOT EXISTS idx_session_expires ON sessions(expires_at)' },
      { name: 'idx_notification_link', query: 'CREATE INDEX IF NOT EXISTS idx_notification_link ON payment_notifications(link_id)' },
      { name: 'idx_notification_processed', query: 'CREATE INDEX IF NOT EXISTS idx_notification_processed ON payment_notifications(processed)' }
    ];
    
    for (const index of indices) {
      try {
        db.prepare(index.query).run();
        console.log(`✅ Índice '${index.name}' criado/verificado`);
      } catch (err) {
        console.log(`⚠️  Índice '${index.name}': ${err.message}`);
      }
    }
    
    // Criar views (opcional)
    console.log('\n📈 Criando views...\n');
    
    const views = [
      {
        name: 'payment_links_summary',
        query: `
          CREATE VIEW IF NOT EXISTS payment_links_summary AS
          SELECT 
            pl.id,
            pl.description,
            pl.amount,
            pl.status,
            pl.customer_email,
            pl.payment_method,
            pl.created_at,
            pl.paid_at,
            u.store_name,
            u.email as vendor_email
          FROM payment_links pl
          JOIN users u ON pl.user_id = u.id
        `
      },
      {
        name: 'daily_stats',
        query: `
          CREATE VIEW IF NOT EXISTS daily_stats AS
          SELECT 
            date(created_at) as date,
            user_id,
            COUNT(*) as total_links,
            SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_links,
            SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_revenue
          FROM payment_links
          GROUP BY date(created_at), user_id
        `
      }
    ];
    
    for (const view of views) {
      try {
        db.prepare(view.query).run();
        console.log(`✅ View '${view.name}' criada/verificada`);
      } catch (err) {
        console.log(`⚠️  View '${view.name}': ${err.message}`);
      }
    }
    
    // Estatísticas do banco
    console.log('\n📊 Estatísticas do banco:\n');
    
    const stats = {
      users: db.prepare('SELECT COUNT(*) as count FROM users').get().count,
      payment_links: db.prepare('SELECT COUNT(*) as count FROM payment_links').get().count,
      sessions: db.prepare('SELECT COUNT(*) as count FROM sessions').get().count,
      notifications: db.prepare('SELECT COUNT(*) as count FROM payment_notifications').get().count
    };
    
    console.log(`👤 Usuários: ${stats.users}`);
    console.log(`🔗 Links de pagamento: ${stats.payment_links}`);
    console.log(`🔑 Sessões ativas: ${stats.sessions}`);
    console.log(`🔔 Notificações: ${stats.notifications}`);
    
    // Fechar conexão
    db.close();
    
    console.log('\n✅ Banco de dados inicializado com sucesso!\n');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ Erro ao inicializar banco de dados:', error);
    return false;
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  const success = initializeDatabase();
  process.exit(success ? 0 : 1);
}

module.exports = {
  initializeDatabase
};
