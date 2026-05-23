const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./lanchonete.db');

db.serialize(() => {
  console.log("=== CATEGORIAS (Todas) ===");
  db.all("SELECT id, admin_id, nome, ordem FROM categorias ORDER BY admin_id, ordem", (err, rows) => {
    if (err) console.error(err);
    else console.table(rows);
  });

  console.log("\n=== PRODUTOS (Todos) ===");
  db.all("SELECT id, admin_id, categoria_id, nome, disponivel FROM produtos ORDER BY admin_id, nome", (err, rows) => {
    if (err) console.error(err);
    else console.table(rows);
  });
});

setTimeout(() => { db.close(); }, 2000);
