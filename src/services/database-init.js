/**
 * Script para inicializar/atualizar o banco de dados
 * Execute com: npm run init-db
 */

const Database = require('better-sqlite3');
const path = require('path');

// Conectar ao banco
const dbPath = path.join(__dirname, '../../database.db');
const db = new Database(dbPath);

console.log('🔄 Atualizando estrutura do banco de dados...');

// Verificar e atualizar tabela payment_notifications
try {
  // Verificar se a tabela existe e sua estrutura
  const tableInfo = db.prepare("PRAGMA table_info(payment_notifications)").all();
  
  if (tableInfo.length > 0) {
    // Verificar se link_id permite NULL
    const linkIdColumn = tableInfo.find(col => col.name === 'link_id');
    
    if (linkIdColumn && linkIdColumn.notnull === 1) {
      console.log('📝 Atualizando tabela payment_notifications para permitir link_id NULL...');
      
      // Backup dos dados existentes
      const existingData = db.prepare('SELECT * FROM payment_notifications').all();
      console.log(`💾 Backup de ${existingData.length} notificações existentes`);
      
      // Recriar tabela com nova estrutura
      db.exec('DROP TABLE IF EXISTS payment_notifications');
      
      db.exec(`
        CREATE TABLE payment_notifications (
          id TEXT PRIMARY KEY,
          link_id TEXT, -- Agora permite NULL
          mp_notification_id TEXT,
          status TEXT,
          data TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (link_id) REFERENCES payment_links(id)
        )
      `);
      
      // Restaurar dados
      if (existingData.length > 0) {
        const insertStmt = db.prepare(`
          INSERT INTO payment_notifications (id, link_id, mp_notification_id, status, data, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        for (const row of existingData) {
          // Converter 'error' para NULL se necessário
          const linkId = row.link_id === 'error' ? null : row.link_id;
          insertStmt.run(row.id, linkId, row.mp_notification_id, row.status, row.data, row.created_at);
        }
        
        console.log(`✅ ${existingData.length} notificações restauradas`);
      }
      
      console.log('✅ Tabela payment_notifications atualizada com sucesso');
    } else {
      console.log('✅ Tabela payment_notifications já está com a estrutura correta');
    }
  } else {
    console.log('📝 Criando tabela payment_notifications...');
    
    db.exec(`
      CREATE TABLE payment_notifications (
        id TEXT PRIMARY KEY,
        link_id TEXT,
        mp_notification_id TEXT,
        status TEXT,
        data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (link_id) REFERENCES payment_links(id)
      )
    `);
    
    console.log('✅ Tabela payment_notifications criada');
  }
} catch (error) {
  console.error('❌ Erro ao atualizar banco:', error);
  process.exit(1);
}

db.close();
console.log('✅ Banco de dados atualizado com sucesso!');
process.exit(0);
