const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'sua-chave-secreta-super-segura-aqui';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public', {
  etag: false,
  lastModified: false,
  setHeaders: (res, filePath) => {
    if (/\.(html|css|js)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-store');
    }
  }
}));

function slugifyBase(input) {
  const raw = String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const cleaned = raw
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');

  return cleaned;
}

function gerarSlugUnico(nome, cb) {
  const base = slugifyBase(nome) || 'loja';

  const tentar = (sufixo) => {
    const slug = sufixo ? `${base}-${sufixo}` : base;
    db.get('SELECT id FROM administradores WHERE slug = ?', [slug], (err, row) => {
      if (err) return cb(err);
      if (row) return tentar((sufixo || 1) + 1);
      return cb(null, slug);
    });
  };

  tentar(null);
}

// Inicializar banco de dados
const db = new sqlite3.Database('./lanchonete.db', (err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err.message);
  } else {
    console.log('✅ Conectado ao banco de dados SQLite');
    inicializarBanco();
  }
});

// Criar tabelas
function inicializarBanco() {
  // Tabela de administradores
  db.run(`CREATE TABLE IF NOT EXISTS administradores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    slug TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  const backfillSlugs = () => {
    db.all('SELECT id, nome FROM administradores WHERE slug IS NULL OR slug = ""', [], (err, rows) => {
      if (err || !rows) return;
      rows.forEach((row) => {
        const nome = row.nome || `loja-${row.id}`;
        gerarSlugUnico(nome, (e, slug) => {
          if (e) return;
          db.run('UPDATE administradores SET slug = ? WHERE id = ?', [slug, row.id]);
        });
      });
    });
  };

  // Migração: adicionar slug se não existir
  db.run(`ALTER TABLE administradores ADD COLUMN slug TEXT`, (err) => {
    if (!err) {
      backfillSlugs();
    }
  });
  backfillSlugs();

  // Tabela de clientes
  db.run(`CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    telefone TEXT NOT NULL,
    endereco TEXT,
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    admin_id INTEGER DEFAULT 1,
    UNIQUE(telefone, admin_id)
  )`);

  // Tabela de categorias
  db.run(`CREATE TABLE IF NOT EXISTS categorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    descricao TEXT,
    ordem INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Tabela de produtos
  db.run(`CREATE TABLE IF NOT EXISTS produtos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    categoria_id INTEGER,
    nome TEXT NOT NULL,
    descricao TEXT,
    preco REAL NOT NULL,
    imagem TEXT,
    disponivel INTEGER DEFAULT 1,
    id_externo TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id)
  )`);

  // Tabela de adicionais/opções
  db.run(`CREATE TABLE IF NOT EXISTS adicionais (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    produto_id INTEGER,
    categoria_id INTEGER,
    nome TEXT NOT NULL,
    preco REAL DEFAULT 0,
    id_externo TEXT,
    disponivel INTEGER DEFAULT 1,
    FOREIGN KEY (produto_id) REFERENCES produtos(id),
    FOREIGN KEY (categoria_id) REFERENCES categorias(id)
  )`);

  // Migrações para adicionais (caso tabela já exista)
  db.run(`ALTER TABLE adicionais ADD COLUMN categoria_id INTEGER`, () => {});
  db.run(`ALTER TABLE adicionais ADD COLUMN disponivel INTEGER DEFAULT 1`, () => {});

  // Tabela de bairros
  db.run(`CREATE TABLE IF NOT EXISTS bairros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER DEFAULT 1,
    nome TEXT NOT NULL,
    taxa REAL DEFAULT 0,
    disponivel INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES administradores(id)
  )`);

  // Tabela de configurações da loja
  db.run(`CREATE TABLE IF NOT EXISTS configuracoes_loja (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER UNIQUE,
    cor_primaria TEXT DEFAULT '#25D366',
    cor_secundaria TEXT DEFAULT '#128C7E',
    logo_url TEXT,
    banner_url TEXT,
    aceita_dinheiro INTEGER DEFAULT 1,
    aceita_cartao INTEGER DEFAULT 1,
    aceita_pix INTEGER DEFAULT 0,
    pix_chave TEXT,
    pix_nome TEXT,
    tempo_entrega TEXT DEFAULT '60-90min',
    horario_funcionamento TEXT DEFAULT 'Segunda a Sexta 18:00 às 23:00',
    telefone_contato TEXT,
    endereco_loja TEXT,
    comunicado TEXT,
    loja_aberta INTEGER DEFAULT 1,
    FOREIGN KEY (admin_id) REFERENCES administradores(id)
  )`);

  // Migração: adicionar coluna comunicado se não existir
  db.run(`ALTER TABLE configuracoes_loja ADD COLUMN comunicado TEXT`, (err) => {
    // Ignora erro se coluna já existir
  });

  // Migração: adicionar coluna loja_aberta se não existir
  db.run(`ALTER TABLE configuracoes_loja ADD COLUMN loja_aberta INTEGER DEFAULT 1`, (err) => {
    // Ignora erro se coluna já existir
  });

  db.run(`ALTER TABLE configuracoes_loja ADD COLUMN aceita_dinheiro INTEGER DEFAULT 1`, () => {});
  db.run(`ALTER TABLE configuracoes_loja ADD COLUMN aceita_cartao INTEGER DEFAULT 1`, () => {});
  db.run(`ALTER TABLE configuracoes_loja ADD COLUMN aceita_pix INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE configuracoes_loja ADD COLUMN pix_chave TEXT`, () => {});
  db.run(`ALTER TABLE configuracoes_loja ADD COLUMN pix_nome TEXT`, () => {});

  // Migrações Multi-Tenant (Adicionar admin_id em todas as tabelas)
  const addAdminId = (table) => {
    db.run(`ALTER TABLE ${table} ADD COLUMN admin_id INTEGER DEFAULT 1`, (err) => {
      // Ignora erro se coluna já existir
    });
  };

  ['categorias', 'produtos', 'adicionais', 'clientes', 'pedidos', 'despesas'].forEach(addAdminId);

  // Tabela de pedidos
  db.run(`CREATE TABLE IF NOT EXISTS pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER,
    tipo TEXT NOT NULL,
    status TEXT DEFAULT 'pendente',
    total REAL NOT NULL,
    observacoes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
  )`);

  // Migração leve: adicionar coluna closed_at se o banco já existir
  db.run(`ALTER TABLE pedidos ADD COLUMN closed_at DATETIME`, () => {
    // Ignora erro se a coluna já existir
  });

  db.run(`ALTER TABLE pedidos ADD COLUMN pagamento_metodo TEXT`, () => {});
  db.run(`ALTER TABLE pedidos ADD COLUMN pagamento_troco REAL`, () => {});

  // Tabela de itens do pedido
  db.run(`CREATE TABLE IF NOT EXISTS itens_pedido (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id INTEGER,
    produto_id INTEGER,
    quantidade INTEGER DEFAULT 1,
    preco_unitario REAL NOT NULL,
    adicionais TEXT,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
    FOREIGN KEY (produto_id) REFERENCES produtos(id)
  )`);

  // Tabela de despesas
  db.run(`CREATE TABLE IF NOT EXISTS despesas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    descricao TEXT NOT NULL,
    valor REAL NOT NULL,
    categoria TEXT NOT NULL,
    data DATE NOT NULL,
    observacoes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Tabela de avaliações (NPS/Estrelas)
  db.run(`CREATE TABLE IF NOT EXISTS avaliacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL,
    pedido_id INTEGER NOT NULL UNIQUE,
    telefone TEXT NOT NULL,
    nota_pedido INTEGER NOT NULL,
    nota_servico INTEGER NOT NULL,
    nota_entrega INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES administradores(id),
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id)
  )`);

  // Criar admin padrão se não existir
  db.get('SELECT COUNT(*) as count FROM administradores', (err, row) => {
    if (row.count === 0) {
      const senhaHash = bcrypt.hashSync('admin123', 10);
      gerarSlugUnico('Administrador', (e, slug) => {
        const slugFinal = e ? `loja-${Date.now()}` : slug;
        db.run(
          `INSERT INTO administradores (nome, email, senha, slug) VALUES (?, ?, ?, ?)`,
          ['Administrador', 'admin@lanchonete.com', senhaHash, slugFinal],
          (err2) => {
            if (err2) {
              console.error('Erro ao criar admin padrão:', err2);
            } else {
              console.log('✅ Admin padrão criado: admin@lanchonete.com / admin123');
            }
          }
        );
      });
    }
  });

  // Criar categorias e produtos de exemplo
  criarDadosExemplo();
}

function criarDadosExemplo() {
  db.get('SELECT COUNT(*) as count FROM categorias', (err, row) => {
    if (row && row.count === 0) {
      // Criar categorias
      db.run(`INSERT INTO categorias (nome, ordem) VALUES ('LANCHES', 1)`, function() {
        const categoriaLanches = this.lastID;
        db.run(`INSERT INTO categorias (nome, ordem) VALUES ('BEBIDAS', 2)`, function() {
          const categoriaBebidas = this.lastID;
          db.run(`INSERT INTO categorias (nome, ordem) VALUES ('COMBOS', 3)`);
          
          // Criar produtos de exemplo
          db.run(`INSERT INTO produtos (categoria_id, nome, descricao, preco, id_externo) 
                  VALUES (?, 'X-Burger', 'Hambúrguer com queijo', 15.00, 'P1')`, [categoriaLanches]);
          db.run(`INSERT INTO produtos (categoria_id, nome, descricao, preco, id_externo) 
                  VALUES (?, 'X-Bacon', 'Hambúrguer com bacon', 18.00, 'P2')`, [categoriaLanches]);
          db.run(`INSERT INTO produtos (categoria_id, nome, descricao, preco, id_externo) 
                  VALUES (?, 'X-Salada', 'Hambúrguer com salada', 20.00, 'P3')`, [categoriaLanches]);
          db.run(`INSERT INTO produtos (categoria_id, nome, descricao, preco, id_externo) 
                  VALUES (?, 'Coca-Cola 350ml', 'Refrigerante', 6.00, 'P4')`, [categoriaBebidas]);
          db.run(`INSERT INTO produtos (categoria_id, nome, descricao, preco, id_externo) 
                  VALUES (?, 'Água Mineral', 'Água 500ml', 3.00, 'P5')`, [categoriaBebidas]);
        });
      });
    }
  });
}

function criarDadosPadrao(adminId) {
  // Criar configurações padrão (cores neutras)
  db.run(`INSERT INTO configuracoes_loja (admin_id, telefone_contato, cor_primaria, cor_secundaria) 
          VALUES (?, '', '#333333', '#666666')`, [adminId]);

  // Criar categorias padrão para o novo admin
  db.run(`INSERT INTO categorias (admin_id, nome, ordem) VALUES (?, 'LANCHES', 1)`, [adminId], function() {
    const catLanche = this.lastID;
    db.run(`INSERT INTO categorias (admin_id, nome, ordem) VALUES (?, 'BEBIDAS', 2)`, [adminId], function() {
      const catBebida = this.lastID;
      db.run(`INSERT INTO categorias (admin_id, nome, ordem) VALUES (?, 'COMBOS', 3)`, [adminId]);
    });
  });
}

// Middleware de autenticação
function autenticarAdmin(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ erro: 'Token não fornecido' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.adminId = decoded.id;
    next();
  } catch (err) {
    return res.status(401).json({ erro: 'Token inválido' });
  }
}

// ========== ROTAS DE AUTENTICAÇÃO ==========

// Registrar novo admin
app.post('/api/auth/register', (req, res) => {
  const { nome, email, senha } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: 'Todos os campos são obrigatórios' });
  }

  db.get('SELECT id FROM administradores WHERE email = ?', [email], (err, row) => {
    if (err) return res.status(500).json({ erro: err.message });
    if (row) return res.status(400).json({ erro: 'Email já cadastrado' });

    const senhaHash = bcrypt.hashSync(senha, 10);
    gerarSlugUnico(nome, (errSlug, slug) => {
      if (errSlug) return res.status(500).json({ erro: errSlug.message });

      db.run(
        `INSERT INTO administradores (nome, email, senha, slug) VALUES (?, ?, ?, ?)`,
        [nome, email, senhaHash, slug],
        function(err2) {
          if (err2) return res.status(500).json({ erro: err2.message });
          criarDadosPadrao(this.lastID);
          res.json({ mensagem: 'Administrador cadastrado com sucesso', slug });
        }
      );
    });
  });
});

// Login admin
app.post('/api/auth/login', (req, res) => {
  const { email, senha } = req.body;

  db.get('SELECT * FROM administradores WHERE email = ?', [email], async (err, admin) => {
    if (err) {
      return res.status(500).json({ erro: 'Erro no servidor' });
    }

    if (!admin) {
      return res.status(401).json({ erro: 'Email ou senha inválidos' });
    }

    const senhaValida = await bcrypt.compare(senha, admin.senha);
    if (!senhaValida) {
      return res.status(401).json({ erro: 'Email ou senha inválidos' });
    }

    const token = jwt.sign({ id: admin.id, email: admin.email }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, admin: { id: admin.id, nome: admin.nome, email: admin.email, slug: admin.slug } });
  });
});

// Buscar info da loja (Publico)
app.get('/api/loja/:identificador', (req, res) => {
  const { identificador } = req.params;
  
  // Tenta buscar por ID (se for numérico) ou Slug
  const query = isNaN(identificador) 
    ? 'SELECT id, nome, email, slug FROM administradores WHERE slug = ?'
    : 'SELECT id, nome, email, slug FROM administradores WHERE id = ?';
    
  db.get(query, [identificador], (err, loja) => {
    if (err) return res.status(500).json({ erro: err.message });
    if (!loja) return res.status(404).json({ erro: 'Loja não encontrada' });
    
    // Buscar configurações da loja
    db.get('SELECT * FROM configuracoes_loja WHERE admin_id = ?', [loja.id], (err, config) => {
      if (err) return res.status(500).json({ erro: err.message });
      
      // Mesclar info básica com configs personalizadas
      // IMPORTANTE: Garantir que o ID seja o da loja (admin), não da tabela de configurações
      const lojaCompleta = { 
        ...loja, 
        ...(config || {}),
        id: loja.id 
      };
      res.json(lojaCompleta);
    });
  });
});

// Alterar slug da loja (Admin)
app.put('/api/admin/loja/slug', autenticarAdmin, (req, res) => {
  const desejado = String(req.body?.slug || '').trim();
  const base = desejado ? slugifyBase(desejado) : '';
  const nomeFallback = String(req.body?.nome || '').trim();

  const gerar = (cb) => {
    if (desejado) {
      if (!base) return cb(new Error('Slug inválido'));
      return db.get('SELECT id FROM administradores WHERE slug = ?', [base], (err, row) => {
        if (err) return cb(err);
        if (row && row.id !== req.adminId) return cb(new Error('Slug já está em uso'));
        return cb(null, base);
      });
    }
    db.get('SELECT nome FROM administradores WHERE id = ?', [req.adminId], (err, row) => {
      if (err) return cb(err);
      const nome = nomeFallback || row?.nome || `loja-${req.adminId}`;
      gerarSlugUnico(nome, cb);
    });
  };

  gerar((err, slugFinal) => {
    if (err) {
      const msg = err.message || 'Erro';
      const isBadRequest = msg.includes('Slug inválido') || msg.includes('Slug já está em uso');
      return res.status(isBadRequest ? 400 : 500).json({ erro: msg });
    }

    db.run('UPDATE administradores SET slug = ? WHERE id = ?', [slugFinal, req.adminId], function(err2) {
      if (err2) return res.status(500).json({ erro: err2.message });
      res.json({ mensagem: 'Slug atualizado', slug: slugFinal, url: `/${slugFinal}` });
    });
  });
});

// ========== ROTAS DE CONFIGURAÇÕES ==========

// ========== ROTAS DE NPS/AVALIAÇÕES ==========

// Avaliação pendente (público) - cliente precisa avaliar antes de novo pedido
app.get('/api/avaliacoes/pendente', (req, res) => {
  const lojaId = req.query.loja_id || 1;
  const telefone = String(req.query.telefone || '').trim();
  if (!telefone) return res.status(400).json({ erro: 'Telefone é obrigatório' });

  const query = `
    SELECT p.id as pedido_id, p.created_at, p.total
    FROM pedidos p
    LEFT JOIN clientes c ON p.cliente_id = c.id
    WHERE p.admin_id = ?
      AND c.telefone = ?
      AND p.status = 'entregue'
      AND NOT EXISTS (SELECT 1 FROM avaliacoes a WHERE a.pedido_id = p.id)
    ORDER BY p.created_at DESC
    LIMIT 1
  `;

  db.get(query, [lojaId, telefone], (err, row) => {
    if (err) return res.status(500).json({ erro: err.message });
    res.json(row || null);
  });
});

// Enviar avaliação (público)
app.post('/api/avaliacoes', (req, res) => {
  const { loja_id, telefone, pedido_id, nota_pedido, nota_servico, nota_entrega } = req.body;
  const adminId = loja_id || 1;
  const tel = String(telefone || '').trim();
  const pid = Number(pedido_id);
  const n1 = Number(nota_pedido);
  const n2 = Number(nota_servico);
  const n3 = Number(nota_entrega);

  const okNota = (n) => Number.isInteger(n) && n >= 1 && n <= 5;
  if (!tel || !pid || !okNota(n1) || !okNota(n2) || !okNota(n3)) {
    return res.status(400).json({ erro: 'Dados inválidos' });
  }

  db.get('SELECT id, admin_id, status FROM pedidos WHERE id = ? AND admin_id = ?', [pid, adminId], (err, pedido) => {
    if (err) return res.status(500).json({ erro: err.message });
    if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado' });
    if (pedido.status !== 'entregue') return res.status(400).json({ erro: 'Pedido ainda não entregue' });

    db.run(
      `INSERT INTO avaliacoes (admin_id, pedido_id, telefone, nota_pedido, nota_servico, nota_entrega)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [adminId, pid, tel, n1, n2, n3],
      function(err2) {
        if (err2) {
          if (String(err2.message || '').includes('UNIQUE constraint failed: avaliacoes.pedido_id')) {
            return res.status(400).json({ erro: 'Este pedido já foi avaliado' });
          }
          return res.status(500).json({ erro: err2.message });
        }
        res.json({ mensagem: 'Avaliação registrada' });
      }
    );
  });
});

// Estatísticas NPS (admin)
app.get('/api/admin/nps', autenticarAdmin, (req, res) => {
  const { dataInicio, dataFim } = req.query;
  let where = 'WHERE admin_id = ?';
  const params = [req.adminId];

  if (dataInicio && dataFim) {
    where += ' AND DATE(created_at) BETWEEN ? AND ?';
    params.push(dataInicio, dataFim);
  }

  const query = `
    SELECT
      COUNT(*) as total,
      AVG(nota_pedido) as media_pedido,
      AVG(nota_servico) as media_servico,
      AVG(nota_entrega) as media_entrega
    FROM avaliacoes
    ${where}
  `;

  db.get(query, params, (err, row) => {
    if (err) return res.status(500).json({ erro: err.message });
    const total = Number(row?.total || 0);
    res.json({
      total,
      media_pedido: total ? Number(row.media_pedido) : 0,
      media_servico: total ? Number(row.media_servico) : 0,
      media_entrega: total ? Number(row.media_entrega) : 0
    });
  });
});

// Obter configurações (Admin)
app.get('/api/admin/configuracoes', autenticarAdmin, (req, res) => {
  db.get('SELECT * FROM configuracoes_loja WHERE admin_id = ?', [req.adminId], (err, config) => {
    if (err) return res.status(500).json({ erro: err.message });
    res.json(config || {});
  });
});

// Salvar/Atualizar configurações (Admin)
app.put('/api/admin/configuracoes', autenticarAdmin, (req, res) => {
  const { cor_primaria, cor_secundaria, logo_url, banner_url, aceita_dinheiro, aceita_cartao, aceita_pix, pix_chave, pix_nome, tempo_entrega, horario_funcionamento, telefone_contato, endereco_loja, comunicado } = req.body;
  
  db.get('SELECT id FROM configuracoes_loja WHERE admin_id = ?', [req.adminId], (err, row) => {
    if (err) return res.status(500).json({ erro: err.message });
    
    if (row) {
      // Update
      db.run(`UPDATE configuracoes_loja SET 
        cor_primaria = ?, cor_secundaria = ?, logo_url = ?, banner_url = ?, 
        aceita_dinheiro = ?, aceita_cartao = ?, aceita_pix = ?, pix_chave = ?, pix_nome = ?,
        tempo_entrega = ?, horario_funcionamento = ?, telefone_contato = ?, endereco_loja = ?, comunicado = ?
        WHERE admin_id = ?`,
        [
          cor_primaria, cor_secundaria, logo_url, banner_url,
          aceita_dinheiro ?? 1, aceita_cartao ?? 1, aceita_pix ?? 0, pix_chave || null, pix_nome || null,
          tempo_entrega, horario_funcionamento, telefone_contato, endereco_loja, comunicado, req.adminId
        ],
        function(err) {
          if (err) return res.status(500).json({ erro: err.message });
          res.json({ mensagem: 'Configurações atualizadas' });
        }
      );
    } else {
      // Insert
      db.run(`INSERT INTO configuracoes_loja (admin_id, cor_primaria, cor_secundaria, logo_url, banner_url, aceita_dinheiro, aceita_cartao, aceita_pix, pix_chave, pix_nome, tempo_entrega, horario_funcionamento, telefone_contato, endereco_loja, comunicado)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.adminId, cor_primaria, cor_secundaria, logo_url, banner_url,
          aceita_dinheiro ?? 1, aceita_cartao ?? 1, aceita_pix ?? 0, pix_chave || null, pix_nome || null,
          tempo_entrega, horario_funcionamento, telefone_contato, endereco_loja, comunicado
        ],
        function(err) {
          if (err) return res.status(500).json({ erro: err.message });
          res.json({ mensagem: 'Configurações salvas' });
        }
      );
    }
  });
});

// Alterar status da loja (Abrir/Fechar)
app.put('/api/admin/loja/status', autenticarAdmin, (req, res) => {
  const { aberta } = req.body; // true ou false / 1 ou 0
  
  const status = aberta ? 1 : 0;
  
  db.get('SELECT id FROM configuracoes_loja WHERE admin_id = ?', [req.adminId], (err, row) => {
    if (err) return res.status(500).json({ erro: err.message });
    
    if (row) {
      db.run('UPDATE configuracoes_loja SET loja_aberta = ? WHERE admin_id = ?', [status, req.adminId], function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ mensagem: `Loja ${status ? 'aberta' : 'fechada'} com sucesso`, aberta: !!status });
      });
    } else {
      // Se não existe config, cria uma básica
      db.run(`INSERT INTO configuracoes_loja (admin_id, loja_aberta) VALUES (?, ?)`, [req.adminId, status], function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ mensagem: `Loja ${status ? 'aberta' : 'fechada'} com sucesso`, aberta: !!status });
      });
    }
  });
});

// ========== ROTAS DE BAIRROS ==========

// Listar bairros (Público - com filtro de loja)
app.get('/api/bairros', (req, res) => {
  const lojaId = req.query.loja_id || 1;
  db.all('SELECT * FROM bairros WHERE admin_id = ? AND disponivel = 1 ORDER BY nome', [lojaId], (err, bairros) => {
    if (err) return res.status(500).json({ erro: err.message });
    res.json(bairros);
  });
});

// Listar bairros (Admin)
app.get('/api/admin/bairros', autenticarAdmin, (req, res) => {
  db.all('SELECT * FROM bairros WHERE admin_id = ? ORDER BY nome', [req.adminId], (err, bairros) => {
    if (err) return res.status(500).json({ erro: err.message });
    res.json(bairros);
  });
});

// Criar bairro (Admin)
app.post('/api/admin/bairros', autenticarAdmin, (req, res) => {
  const { nome, taxa } = req.body;
  
  if (!nome) return res.status(400).json({ erro: 'Nome do bairro é obrigatório' });

  db.run(`INSERT INTO bairros (admin_id, nome, taxa) VALUES (?, ?, ?)`,
    [req.adminId, nome, taxa || 0],
    function(err) {
      if (err) return res.status(500).json({ erro: err.message });
      res.json({ id: this.lastID, mensagem: 'Bairro adicionado com sucesso' });
    }
  );
});

// Atualizar bairro (Admin)
app.put('/api/admin/bairros/:id', autenticarAdmin, (req, res) => {
  const { nome, taxa, disponivel } = req.body;
  
  db.run(`UPDATE bairros SET nome = ?, taxa = ?, disponivel = ? WHERE id = ? AND admin_id = ?`,
    [nome, taxa, disponivel, req.params.id, req.adminId],
    function(err) {
      if (err) return res.status(500).json({ erro: err.message });
      if (this.changes === 0) return res.status(404).json({ erro: 'Bairro não encontrado' });
      res.json({ mensagem: 'Bairro atualizado' });
    }
  );
});

// Deletar bairro (Admin)
app.delete('/api/admin/bairros/:id', autenticarAdmin, (req, res) => {
  db.run('DELETE FROM bairros WHERE id = ? AND admin_id = ?', [req.params.id, req.adminId], function(err) {
    if (err) return res.status(500).json({ erro: err.message });
    res.json({ mensagem: 'Bairro removido' });
  });
});

// ========== ROTAS DE PRODUTOS ==========

// Listar produtos (Publico - com filtro de loja)
app.get('/api/produtos', (req, res) => {
  const lojaId = req.query.loja_id || 1; // Default para loja 1
  const query = `
    SELECT p.*, c.nome as categoria_nome 
    FROM produtos p 
    LEFT JOIN categorias c ON p.categoria_id = c.id 
    WHERE p.disponivel = 1 AND p.admin_id = ?
    ORDER BY c.ordem, p.nome
  `;
  
  db.all(query, [lojaId], (err, produtos) => {
    if (err) {
      return res.status(500).json({ erro: err.message });
    }
    res.json(produtos);
  });
});

// Listar produtos com adicionais (para admin)
app.get('/api/admin/produtos', autenticarAdmin, (req, res) => {
  const query = `
    SELECT p.*, c.nome as categoria_nome 
    FROM produtos p 
    LEFT JOIN categorias c ON p.categoria_id = c.id 
    WHERE p.admin_id = ?
    ORDER BY c.ordem, p.nome
  `;
  
  db.all(query, [req.adminId], (err, produtos) => {
    if (err) {
      return res.status(500).json({ erro: err.message });
    }
    
    // Buscar adicionais para cada produto
    const produtosComAdicionais = produtos.map(produto => {
      return new Promise((resolve) => {
        db.all('SELECT * FROM adicionais WHERE produto_id = ?', [produto.id], (err, adicionais) => {
          resolve({ ...produto, adicionais: adicionais || [] });
        });
      });
    });
    
    Promise.all(produtosComAdicionais).then(result => {
      res.json(result);
    });
  });
});

// Criar produto
app.post('/api/admin/produtos', autenticarAdmin, (req, res) => {
  const { categoria_id, nome, descricao, preco, imagem, id_externo } = req.body;
  
  db.run(`INSERT INTO produtos (admin_id, categoria_id, nome, descricao, preco, imagem, id_externo) 
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [req.adminId, categoria_id, nome, descricao, preco, imagem || null, id_externo || null],
    function(err) {
      if (err) {
        return res.status(500).json({ erro: err.message });
      }
      res.json({ id: this.lastID, mensagem: 'Produto criado com sucesso' });
    }
  );
});

// Atualizar produto
app.put('/api/admin/produtos/:id', autenticarAdmin, (req, res) => {
  const { categoria_id, nome, descricao, preco, imagem, disponivel, id_externo } = req.body;
  
  db.run(`UPDATE produtos 
          SET categoria_id = ?, nome = ?, descricao = ?, preco = ?, imagem = ?, disponivel = ?, id_externo = ?
          WHERE id = ? AND admin_id = ?`,
    [categoria_id, nome, descricao, preco, imagem || null, disponivel !== undefined ? disponivel : 1, id_externo || null, req.params.id, req.adminId],
    function(err) {
      if (err) {
        return res.status(500).json({ erro: err.message });
      }
      if (this.changes === 0) return res.status(404).json({ erro: 'Produto não encontrado ou permissão negada' });
      res.json({ mensagem: 'Produto atualizado com sucesso' });
    }
  );
});

// Deletar produto
app.delete('/api/admin/produtos/:id', autenticarAdmin, (req, res) => {
  db.run('DELETE FROM produtos WHERE id = ? AND admin_id = ?', [req.params.id, req.adminId], function(err) {
    if (err) {
      return res.status(500).json({ erro: err.message });
    }
    if (this.changes === 0) return res.status(404).json({ erro: 'Produto não encontrado ou permissão negada' });
    res.json({ mensagem: 'Produto deletado com sucesso' });
  });
});

// ========== ROTAS DE CATEGORIAS ==========

app.get('/api/categorias', (req, res) => {
  const lojaId = req.query.loja_id || 1;
  db.all('SELECT * FROM categorias WHERE admin_id = ? ORDER BY ordem, nome', [lojaId], (err, categorias) => {
    if (err) {
      return res.status(500).json({ erro: err.message });
    }
    res.json(categorias);
  });
});

app.get('/api/admin/categorias', autenticarAdmin, (req, res) => {
  db.all('SELECT * FROM categorias WHERE admin_id = ? ORDER BY ordem, nome', [req.adminId], (err, categorias) => {
    if (err) {
      return res.status(500).json({ erro: err.message });
    }
    res.json(categorias);
  });
});

app.post('/api/admin/categorias', autenticarAdmin, (req, res) => {
  const { nome, descricao, ordem } = req.body;
  
  db.run(`INSERT INTO categorias (admin_id, nome, descricao, ordem) VALUES (?, ?, ?, ?)`,
    [req.adminId, nome, descricao || null, ordem || 0],
    function(err) {
      if (err) {
        return res.status(500).json({ erro: err.message });
      }
      res.json({ id: this.lastID, mensagem: 'Categoria criada com sucesso' });
    }
  );
});

app.delete('/api/admin/categorias/:id', autenticarAdmin, (req, res) => {
  db.run('DELETE FROM categorias WHERE id = ? AND admin_id = ?', [req.params.id, req.adminId], function(err) {
    if (err) {
      return res.status(500).json({ erro: err.message });
    }
    if (this.changes === 0) return res.status(404).json({ erro: 'Categoria não encontrada ou permissão negada' });
    res.json({ mensagem: 'Categoria deletada com sucesso' });
  });
});

// ========== ROTAS DE CLIENTES ==========

// Criar ou atualizar cliente
app.post('/api/clientes', (req, res) => {
  const { nome, telefone, endereco, email, loja_id } = req.body;
  const adminId = loja_id || 1; // Default to store 1
  
  // Verificar se cliente já existe NESTA loja
  db.get('SELECT * FROM clientes WHERE telefone = ? AND admin_id = ?', [telefone, adminId], (err, clienteExistente) => {
    if (err) {
      return res.status(500).json({ erro: err.message });
    }
    
    if (clienteExistente) {
      // Atualizar cliente existente
      db.run(`UPDATE clientes SET nome = ?, endereco = ?, email = ? WHERE telefone = ? AND admin_id = ?`,
        [nome, endereco || null, email || null, telefone, adminId],
        function(err) {
          if (err) {
            return res.status(500).json({ erro: err.message });
          }
          res.json({ id: clienteExistente.id, mensagem: 'Cliente atualizado', cliente: clienteExistente });
        }
      );
    } else {
      // Criar novo cliente
      db.run(`INSERT INTO clientes (admin_id, nome, telefone, endereco, email) VALUES (?, ?, ?, ?, ?)`,
        [adminId, nome, telefone, endereco || null, email || null],
        function(err) {
          if (err) {
            return res.status(500).json({ erro: err.message });
          }
          res.json({ id: this.lastID, mensagem: 'Cliente criado com sucesso' });
        }
      );
    }
  });
});

// Listar clientes (admin)
app.get('/api/admin/clientes', autenticarAdmin, (req, res) => {
  db.all('SELECT * FROM clientes WHERE admin_id = ? ORDER BY nome', [req.adminId], (err, clientes) => {
    if (err) {
      return res.status(500).json({ erro: err.message });
    }
    res.json(clientes);
  });
});

// ========== ROTAS DE PEDIDOS ==========

// Meus pedidos (público) - por telefone
app.get('/api/pedidos/cliente', (req, res) => {
  const lojaId = req.query.loja_id || 1;
  const telefone = String(req.query.telefone || '').trim();
  if (!telefone) return res.status(400).json({ erro: 'Telefone é obrigatório' });

  const query = `
    SELECT p.*, c.nome as cliente_nome, c.telefone as cliente_telefone, c.endereco as cliente_endereco
    FROM pedidos p
    LEFT JOIN clientes c ON p.cliente_id = c.id
    WHERE p.admin_id = ? AND c.telefone = ?
    ORDER BY p.created_at DESC
    LIMIT 50
  `;

  db.all(query, [lojaId, telefone], (err, pedidos) => {
    if (err) return res.status(500).json({ erro: err.message });
    if (!pedidos || pedidos.length === 0) return res.json([]);

    const pedidosComItens = pedidos.map(pedido => {
      return new Promise((resolve) => {
        db.all(
          `SELECT ip.*, pr.nome as produto_nome
           FROM itens_pedido ip
           LEFT JOIN produtos pr ON ip.produto_id = pr.id
           WHERE ip.pedido_id = ?`,
          [pedido.id],
          (err2, itens) => resolve({ ...pedido, itens: itens || [] })
        );
      });
    });

    Promise.all(pedidosComItens).then(result => res.json(result));
  });
});

// Criar pedido
app.post('/api/pedidos', (req, res) => {
  const { cliente_id, tipo, itens, observacoes, cliente_info, loja_id, pagamento_metodo, pagamento_troco } = req.body;
  
  // Determinar adminId: autenticado (req.adminId) > body (loja_id) > default (1)
  const adminId = req.adminId || loja_id || 1;

  if (!itens || itens.length === 0) {
    return res.status(400).json({ erro: 'Carrinho vazio' });
  }

  // Calcular total
  let total = 0;
  itens.forEach(item => {
    total += item.preco_unitario * item.quantidade;
    if (item.adicionais) {
      item.adicionais.forEach(adicional => {
        total += adicional.preco * item.quantidade;
      });
    }
  });
  
  // Criar ou buscar cliente
  let clienteIdFinal = cliente_id;
  
  if (!clienteIdFinal && cliente_info) {
    db.get('SELECT id FROM clientes WHERE telefone = ? AND admin_id = ?', [cliente_info.telefone, adminId], (err, cliente) => {
      if (cliente) {
        clienteIdFinal = cliente.id;
        criarPedido();
      } else {
        db.run(`INSERT INTO clientes (admin_id, nome, telefone, endereco, email) VALUES (?, ?, ?, ?, ?)`,
          [adminId, cliente_info.nome, cliente_info.telefone, cliente_info.endereco || null, cliente_info.email || null],
          function(err) {
            if (err) {
              return res.status(500).json({ erro: err.message });
            }
            clienteIdFinal = this.lastID;
            criarPedido();
          }
        );
      }
    });
  } else {
    criarPedido();
  }
  
  function criarPedido() {
    const metodo = String(pagamento_metodo || 'dinheiro').toLowerCase();
    const troco = pagamento_troco !== undefined && pagamento_troco !== null && pagamento_troco !== '' ? Number(pagamento_troco) : null;

    db.get('SELECT aceita_dinheiro, aceita_cartao, aceita_pix, pix_chave, pix_nome FROM configuracoes_loja WHERE admin_id = ?', [adminId], (errCfg, cfg) => {
      if (errCfg) return res.status(500).json({ erro: errCfg.message });
      const aceitaDinheiro = cfg?.aceita_dinheiro !== 0;
      const aceitaCartao = cfg?.aceita_cartao !== 0;
      const aceitaPix = cfg?.aceita_pix === 1;

      if (metodo === 'dinheiro' && !aceitaDinheiro) return res.status(400).json({ erro: 'Loja não aceita dinheiro' });
      if (metodo === 'cartao' && !aceitaCartao) return res.status(400).json({ erro: 'Loja não aceita cartão' });
      if (metodo === 'pix' && !aceitaPix) return res.status(400).json({ erro: 'Loja não aceita pix' });

      db.run(
        `INSERT INTO pedidos (admin_id, cliente_id, tipo, total, observacoes, pagamento_metodo, pagamento_troco)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [adminId, clienteIdFinal, tipo || 'online', total, observacoes || null, metodo, troco],
        function(err) {
          if (err) {
            return res.status(500).json({ erro: err.message });
          }
          
          const pedidoId = this.lastID;
          
          // Inserir itens do pedido
          const inserirItens = itens.map(item => {
            return new Promise((resolve, reject) => {
              const adicionaisJson = item.adicionais ? JSON.stringify(item.adicionais) : null;
              db.run(`INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco_unitario, adicionais) 
                      VALUES (?, ?, ?, ?, ?)`,
                [pedidoId, item.produto_id, item.quantidade, item.preco_unitario, adicionaisJson],
                (err) => {
                  if (err) reject(err);
                  else resolve();
                }
              );
            });
          });
          
          Promise.all(inserirItens).then(() => {
            // Buscar dados completos do pedido
            db.get(`SELECT p.*, c.nome as cliente_nome, c.telefone as cliente_telefone, c.endereco as cliente_endereco
                    FROM pedidos p
                    LEFT JOIN clientes c ON p.cliente_id = c.id
                    WHERE p.id = ?`, [pedidoId], (err, pedido) => {
              if (err) {
                return res.status(500).json({ erro: err.message });
              }
              
              // Buscar itens do pedido
              db.all(`SELECT ip.*, pr.nome as produto_nome
                      FROM itens_pedido ip
                      LEFT JOIN produtos pr ON ip.produto_id = pr.id
                      WHERE ip.pedido_id = ?`, [pedidoId], (err, itensPedido) => {
                res.json({ ...pedido, itens: itensPedido });
              });
            });
          }).catch(err => {
            res.status(500).json({ erro: err.message });
          });
        }
      );
    });
  }
});

// Listar pedidos (admin)
app.get('/api/admin/pedidos', autenticarAdmin, (req, res) => {
  const { status, tipo, excluirStatus } = req.query;
  let query = `
    SELECT p.*, c.nome as cliente_nome, c.telefone as cliente_telefone, c.endereco as cliente_endereco
    FROM pedidos p
    LEFT JOIN clientes c ON p.cliente_id = c.id
    WHERE p.admin_id = ?
  `;
  const params = [req.adminId];
  
  if (status) {
    query += ' AND p.status = ?';
    params.push(status);
  }
  if (tipo) {
    query += ' AND p.tipo = ?';
    params.push(tipo);
  }

  if (excluirStatus) {
    const lista = String(excluirStatus)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (lista.length > 0) {
      query += ` AND p.status NOT IN (${lista.map(() => '?').join(',')})`;
      params.push(...lista);
    }
  }
  
  query += ' ORDER BY p.created_at DESC';
  
  db.all(query, params, (err, pedidos) => {
    if (err) {
      return res.status(500).json({ erro: err.message });
    }
    
    // Buscar itens para cada pedido
    const pedidosComItens = pedidos.map(pedido => {
      return new Promise((resolve) => {
        db.all(`SELECT ip.*, pr.nome as produto_nome
                FROM itens_pedido ip
                LEFT JOIN produtos pr ON ip.produto_id = pr.id
                WHERE ip.pedido_id = ?`, [pedido.id], (err, itens) => {
          resolve({ ...pedido, itens: itens || [] });
        });
      });
    });
    
    Promise.all(pedidosComItens).then(result => {
      res.json(result);
    });
  });
});

// Atualizar status do pedido
app.put('/api/admin/pedidos/:id/status', autenticarAdmin, (req, res) => {
  const { status } = req.body;
  
  db.run(
    `UPDATE pedidos
     SET status = ?,
         closed_at = CASE
           WHEN ? IN ('entregue', 'cancelado') THEN CURRENT_TIMESTAMP
           ELSE NULL
         END
     WHERE id = ? AND admin_id = ?`,
    [status, status, req.params.id, req.adminId],
    function(err) {
    if (err) {
      return res.status(500).json({ erro: err.message });
    }
    if (this.changes === 0) return res.status(404).json({ erro: 'Pedido não encontrado ou permissão negada' });
    res.json({ mensagem: 'Status atualizado com sucesso' });
    }
  );
});

// ========== ROTAS DE ADICIONAIS ==========

// Listar todos os adicionais (publico/admin)
app.get('/api/adicionais', (req, res) => {
  const { categoria_id, loja_id } = req.query;
  const adminId = loja_id || 1; // Default store 1
  let query = 'SELECT * FROM adicionais WHERE disponivel = 1 AND admin_id = ?';
  const params = [adminId];

  if (categoria_id) {
    query += ' AND (categoria_id = ? OR categoria_id IS NULL)';
    params.push(categoria_id);
  }

  query += ' ORDER BY nome';

  db.all(query, params, (err, adicionais) => {
    if (err) {
      return res.status(500).json({ erro: err.message });
    }
    res.json(adicionais);
  });
});

// Listar adicionais (admin - todos)
app.get('/api/admin/adicionais', autenticarAdmin, (req, res) => {
  const query = `
    SELECT a.*, c.nome as categoria_nome 
    FROM adicionais a 
    LEFT JOIN categorias c ON a.categoria_id = c.id 
    WHERE a.admin_id = ?
    ORDER BY a.nome
  `;
  
  db.all(query, [req.adminId], (err, adicionais) => {
    if (err) {
      return res.status(500).json({ erro: err.message });
    }
    res.json(adicionais);
  });
});

app.post('/api/admin/adicionais', autenticarAdmin, (req, res) => {
  const { produto_id, categoria_id, nome, preco, id_externo, disponivel } = req.body;
  
  db.run(`INSERT INTO adicionais (admin_id, produto_id, categoria_id, nome, preco, id_externo, disponivel) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [req.adminId, produto_id || null, categoria_id || null, nome, preco || 0, id_externo || null, disponivel !== undefined ? disponivel : 1],
    function(err) {
      if (err) {
        return res.status(500).json({ erro: err.message });
      }
      res.json({ id: this.lastID, mensagem: 'Adicional criado com sucesso' });
    }
  );
});

app.put('/api/admin/adicionais/:id', autenticarAdmin, (req, res) => {
  const { produto_id, categoria_id, nome, preco, id_externo, disponivel } = req.body;
  
  db.run(`UPDATE adicionais 
          SET produto_id = ?, categoria_id = ?, nome = ?, preco = ?, id_externo = ?, disponivel = ?
          WHERE id = ? AND admin_id = ?`,
    [produto_id || null, categoria_id || null, nome, preco, id_externo || null, disponivel !== undefined ? disponivel : 1, req.params.id, req.adminId],
    function(err) {
      if (err) {
        return res.status(500).json({ erro: err.message });
      }
      if (this.changes === 0) return res.status(404).json({ erro: 'Adicional não encontrado ou permissão negada' });
      res.json({ mensagem: 'Adicional atualizado com sucesso' });
    }
  );
});

app.delete('/api/admin/adicionais/:id', autenticarAdmin, (req, res) => {
  db.run('DELETE FROM adicionais WHERE id = ? AND admin_id = ?', [req.params.id, req.adminId], function(err) {
    if (err) {
      return res.status(500).json({ erro: err.message });
    }
    if (this.changes === 0) return res.status(404).json({ erro: 'Adicional não encontrado ou permissão negada' });
    res.json({ mensagem: 'Adicional deletado com sucesso' });
  });
});

// ========== ROTAS DE FINANCEIRO ==========

// Obter relatório financeiro
app.get('/api/admin/financeiro', autenticarAdmin, (req, res) => {
  const { dataInicio, dataFim } = req.query;
  const adminId = req.adminId;
  
  let queryVendas = 'SELECT SUM(total) as total FROM pedidos WHERE status != "cancelado" AND admin_id = ?';
  let queryDespesas = 'SELECT SUM(valor) as total FROM despesas WHERE admin_id = ?';
  const paramsVendas = [adminId];
  const paramsDespesas = [adminId];
  
  if (dataInicio && dataFim) {
    queryVendas += ' AND DATE(created_at) BETWEEN ? AND ?';
    paramsVendas.push(dataInicio, dataFim);
    queryDespesas += ' AND DATE(data) BETWEEN ? AND ?';
    paramsDespesas.push(dataInicio, dataFim);
  }
  
  Promise.all([
    new Promise((resolve, reject) => {
      db.get(queryVendas, paramsVendas, (err, row) => {
        if (err) reject(err);
        else resolve(row?.total || 0);
      });
    }),
    new Promise((resolve, reject) => {
      db.get(queryDespesas, paramsDespesas, (err, row) => {
        if (err) reject(err);
        else resolve(row?.total || 0);
      });
    }),
    new Promise((resolve, reject) => {
      let queryCount = 'SELECT COUNT(*) as total FROM pedidos WHERE status != "cancelado" AND admin_id = ?';
      const paramsCount = [adminId];
      if (dataInicio && dataFim) {
        queryCount += ' AND DATE(created_at) BETWEEN ? AND ?';
        paramsCount.push(dataInicio, dataFim);
      }
      db.get(queryCount, paramsCount, (err, row) => {
        if (err) reject(err);
        else resolve(row?.total || 0);
      });
    })
  ]).then(([vendas, despesas, totalPedidos]) => {
    res.json({
      vendas: Number(vendas),
      despesas: Number(despesas),
      lucro: Number(vendas) - Number(despesas),
      totalPedidos: Number(totalPedidos)
    });
  }).catch(err => {
    res.status(500).json({ erro: err.message });
  });
});

// Listar despesas
app.get('/api/admin/despesas', autenticarAdmin, (req, res) => {
  const { dataInicio, dataFim, categoria } = req.query;
  
  let query = 'SELECT * FROM despesas WHERE admin_id = ?';
  const params = [req.adminId];
  
  if (dataInicio && dataFim) {
    query += ' AND DATE(data) BETWEEN ? AND ?';
    params.push(dataInicio, dataFim);
  }
  
  if (categoria) {
    query += ' AND categoria = ?';
    params.push(categoria);
  }
  
  query += ' ORDER BY data DESC, created_at DESC';
  
  db.all(query, params, (err, despesas) => {
    if (err) {
      return res.status(500).json({ erro: err.message });
    }
    res.json(despesas);
  });
});

// Criar despesa
app.post('/api/admin/despesas', autenticarAdmin, (req, res) => {
  const { descricao, valor, categoria, data, observacoes } = req.body;
  
  if (!descricao || !valor || !categoria || !data) {
    return res.status(400).json({ erro: 'Campos obrigatórios: descricao, valor, categoria, data' });
  }
  
  db.run(`INSERT INTO despesas (admin_id, descricao, valor, categoria, data, observacoes) 
          VALUES (?, ?, ?, ?, ?, ?)`,
    [req.adminId, descricao, valor, categoria, data, observacoes || null],
    function(err) {
      if (err) {
        return res.status(500).json({ erro: err.message });
      }
      res.json({ id: this.lastID, mensagem: 'Despesa criada com sucesso' });
    }
  );
});

// Atualizar despesa
app.put('/api/admin/despesas/:id', autenticarAdmin, (req, res) => {
  const { descricao, valor, categoria, data, observacoes } = req.body;
  
  db.run(`UPDATE despesas 
          SET descricao = ?, valor = ?, categoria = ?, data = ?, observacoes = ?
          WHERE id = ? AND admin_id = ?`,
    [descricao, valor, categoria, data, observacoes || null, req.params.id, req.adminId],
    function(err) {
      if (err) {
        return res.status(500).json({ erro: err.message });
      }
      if (this.changes === 0) return res.status(404).json({ erro: 'Despesa não encontrada ou permissão negada' });
      res.json({ mensagem: 'Despesa atualizada com sucesso' });
    }
  );
});

// Deletar despesa
app.delete('/api/admin/despesas/:id', autenticarAdmin, (req, res) => {
  db.run('DELETE FROM despesas WHERE id = ? AND admin_id = ?', [req.params.id, req.adminId], function(err) {
    if (err) {
      return res.status(500).json({ erro: err.message });
    }
    if (this.changes === 0) return res.status(404).json({ erro: 'Despesa não encontrada ou permissão negada' });
    res.json({ mensagem: 'Despesa deletada com sucesso' });
  });
});

// Página de pedidos por slug (multi-tenant)
app.get('/:slug', (req, res, next) => {
  const slug = String(req.params.slug || '').trim();
  const reserved = new Set([
    'api',
    'admin.html',
    'index.html',
    'admin.css',
    'admin.js',
    'styles.css',
    'app.js',
    'favicon.ico'
  ]);

  if (!slug || reserved.has(slug)) return next();
  if (slug.includes('.')) return next();

  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`📱 Acesse http://localhost:${PORT}/admin.html para o PDV`);
  console.log(`🛒 Acesse http://localhost:${PORT}/index.html para pedidos`);
});
