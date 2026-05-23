# 📦 Guia de Instalação Rápida

## Passo a Passo

### 1. Instalar Dependências
```bash
npm install
```

### 2. Iniciar o Servidor
```bash
npm start
```

O servidor iniciará na porta 3000.

### 3. Acessar o Sistema

Abra seu navegador e acesse:

- **Para Clientes**: http://localhost:3000/index.html
- **Para Administradores**: http://localhost:3000/admin.html

### 4. Primeiro Acesso

**Login Administrador:**
- Email: `admin@lanchonete.com`
- Senha: `admin123`

⚠️ **IMPORTANTE**: Altere essas credenciais após o primeiro acesso!

### 5. Configurar WhatsApp

Edite o arquivo `public/app.js` e altere o número do WhatsApp na linha:

```javascript
const numeroWhatsApp = '5511999999999'; // TROQUE PELO NÚMERO DA SUA LANCHONETE
```

Use o formato internacional sem caracteres especiais (ex: 5511999999999).

## ✅ Pronto!

Agora você pode:
- Cadastrar produtos e categorias no PDV
- Fazer pedidos pela interface do cliente
- Gerenciar pedidos e clientes

## 🐛 Problemas Comuns

**Erro ao iniciar o servidor:**
- Verifique se a porta 3000 está livre
- Tente alterar a porta no arquivo `.env`

**Erro ao conectar ao banco de dados:**
- O banco será criado automaticamente na primeira execução
- Verifique permissões de escrita na pasta do projeto

**WhatsApp não abre:**
- Verifique se o número está no formato correto (sem espaços ou caracteres especiais)
- Certifique-se de que o número está completo com código do país
