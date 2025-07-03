const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

// Caminho para o diretório do banco de dados
const dbDir = path.join(__dirname, "db");

// Garantir que o diretório existe
if (!fs.existsSync(dbDir)) {
  console.log("Criando diretório do banco de dados");
  fs.mkdirSync(dbDir, { recursive: true });
}

// Caminho para o arquivo do banco de dados
const dbPath = path.join(dbDir, "subscriptions.sqlite");

// Criar o objeto de banco de dados
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Erro ao conectar ao banco de dados SQLite:", err.message);
  } else {
    console.log("Conectado ao banco de dados SQLite");
    // Criar tabela se não existir
    createTables();
  }
});

// Criar as tabelas necessárias
function createTables() {
  db.run(
    `
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
    (err) => {
      if (err) {
        console.error("Erro ao criar tabela de inscrições:", err.message);
      } else {
        console.log("Tabela de inscrições verificada/criada com sucesso");
      }
    }
  );
}

// Adicionar uma nova inscrição
function addSubscription(subscription) {
  return new Promise((resolve, reject) => {
    const { endpoint, keys } = subscription;
    const { p256dh, auth } = keys;

    db.run(
      `INSERT OR REPLACE INTO subscriptions (endpoint, p256dh, auth, updated_at) 
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      [endpoint, p256dh, auth],
      function (err) {
        if (err) {
          console.error("Erro ao salvar inscrição:", err.message);
          reject(err);
        } else {
          console.log(`Inscrição salva com ID ${this.lastID}`);
          resolve({ id: this.lastID });
        }
      }
    );
  });
}

// Obter todas as inscrições
function getAllSubscriptions() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM subscriptions`, [], (err, rows) => {
      if (err) {
        console.error("Erro ao recuperar inscrições:", err.message);
        reject(err);
      } else {
        // Formatar as inscrições no formato esperado pelo web-push
        const subscriptions = rows.map((row) => ({
          endpoint: row.endpoint,
          keys: {
            p256dh: row.p256dh,
            auth: row.auth,
          },
        }));
        resolve(subscriptions);
      }
    });
  });
}

// Remover uma inscrição pelo endpoint
function removeSubscription(endpoint) {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM subscriptions WHERE endpoint = ?`, [endpoint], function (err) {
      if (err) {
        console.error("Erro ao remover inscrição:", err.message);
        reject(err);
      } else {
        console.log(`Inscrição removida: ${endpoint}`);
        resolve({ deleted: this.changes });
      }
    });
  });
}

// Remover várias inscrições por seus endpoints
function removeSubscriptions(endpoints) {
  const placeholders = endpoints.map(() => "?").join(",");

  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM subscriptions WHERE endpoint IN (${placeholders})`, endpoints, function (err) {
      if (err) {
        console.error("Erro ao remover inscrições:", err.message);
        reject(err);
      } else {
        console.log(`${this.changes} inscrições removidas`);
        resolve({ deleted: this.changes });
      }
    });
  });
}

// Contar o número de inscrições
function countSubscriptions() {
  return new Promise((resolve, reject) => {
    db.get(`SELECT COUNT(*) as count FROM subscriptions`, [], (err, row) => {
      if (err) {
        console.error("Erro ao contar inscrições:", err.message);
        reject(err);
      } else {
        resolve(row.count);
      }
    });
  });
}

// Fechar a conexão com o banco de dados quando a aplicação for encerrada
process.on("SIGINT", () => {
  db.close((err) => {
    if (err) {
      console.error("Erro ao fechar o banco de dados:", err.message);
    } else {
      console.log("Conexão com o banco de dados fechada");
    }
    process.exit(0);
  });
});

// Exportar as funções para uso em outros arquivos
module.exports = {
  addSubscription,
  getAllSubscriptions,
  removeSubscription,
  removeSubscriptions,
  countSubscriptions,
};
