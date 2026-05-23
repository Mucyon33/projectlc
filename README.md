# 🍔 Sistema de Gestão para Lanchonete

Sistema completo de gestão para lanchonete com PDV (Ponto de Venda) para administradores e interface de pedidos online para clientes, com integração ao WhatsApp.

## ✨ Funcionalidades

### Para Clientes
- 📱 Interface moderna e responsiva para fazer pedidos
- 🛒 Carrinho de compras intuitivo
- 👤 Cadastro de clientes (nome, telefone, endereço, email)
- 📲 Integração com WhatsApp para envio de pedidos
- 🔍 Busca de produtos
- 📂 Navegação por categorias

### Para Administradores (PDV)
- 🔐 Sistema de autenticação seguro
- 📋 Gestão de pedidos (visualizar, atualizar status)
- 🍔 Gestão de produtos (criar, editar, deletar)
- 📂 Gestão de categorias
- 👥 Visualização de clientes cadastrados
- 📊 Filtros de pedidos por status e tipo
- 🏷️ Sistema de IDs externos para produtos

## 🚀 Como Usar

### Instalação

1. Instale as dependências:
```bash
npm install
```

2. Configure as variáveis de ambiente (opcional):
```bash
cp .env.example .env
```

3. Inicie o servidor:
```bash
npm start
```

Para desenvolvimento com auto-reload:
```bash
npm run dev
```

### Acessar o Sistema

- **Interface de Clientes**: http://localhost:3000/index.html
- **PDV Administrador**: http://localhost:3000/admin.html

### Credenciais Padrão do Admin

- **Email**: admin@lanchonete.com
- **Senha**: admin123

⚠️ **IMPORTANTE**: Altere a senha padrão em produção!

## 📝 Configuração do WhatsApp

Para configurar o número do WhatsApp da sua lanchonete, edite o arquivo `public/app.js` na linha onde está:

```javascript
const numeroWhatsApp = '5511999999999'; // TROQUE PELO NÚMERO DA SUA LANCHONETE
```

Substitua pelo número da sua lanchonete no formato internacional (ex: 5511999999999).

## 🗄️ Banco de Dados

O sistema usa SQLite e cria automaticamente as seguintes tabelas:

- `administradores` - Usuários administradores
- `clientes` - Dados dos clientes
- `categorias` - Categorias de produtos
- `produtos` - Produtos do cardápio
- `adicionais` - Adicionais/opções para produtos
- `pedidos` - Pedidos realizados
- `itens_pedido` - Itens de cada pedido

O banco de dados é criado automaticamente na primeira execução.

## 🛠️ Tecnologias Utilizadas

- **Backend**: Node.js + Express
- **Banco de Dados**: SQLite3
- **Autenticação**: JWT (JSON Web Tokens)
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Segurança**: bcryptjs para hash de senhas

## 📱 Estrutura do Projeto

```
lanchonete/
├── server.js              # Servidor Express e API
├── package.json           # Dependências do projeto
├── public/                # Arquivos estáticos
│   ├── index.html        # Interface de clientes
│   ├── admin.html        # Interface PDV
│   ├── app.js            # JavaScript do cliente
│   ├── admin.js          # JavaScript do admin
│   ├── styles.css        # Estilos gerais
│   └── admin.css         # Estilos do admin
├── lanchonete.db         # Banco de dados SQLite (criado automaticamente)
└── README.md             # Este arquivo
```

## 🔒 Segurança

- Senhas são criptografadas com bcrypt
- Autenticação via JWT tokens
- Validação de dados no servidor
- Proteção de rotas administrativas

## 📈 Próximas Melhorias

- [ ] Sistema de adicionais/opções para produtos
- [ ] Upload de imagens de produtos
- [ ] Relatórios e estatísticas
- [ ] Notificações em tempo real
- [ ] Integração com sistemas de pagamento
- [ ] App mobile (React Native)

## 📄 Licença

Este projeto é de código aberto e está disponível para uso livre.

## 🤝 Suporte

Para dúvidas ou problemas, verifique a documentação ou entre em contato.

---

Desenvolvido com ❤️ para facilitar a gestão da sua lanchonete!
