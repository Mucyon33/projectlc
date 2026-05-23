const http = require('http');

// Função auxiliar para fazer requisições
function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function run() {
  console.log('1. Fazendo login...');
  const loginRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: 'admin@lanchonete.com',
    senha: 'admin123'
  });

  if (loginRes.status !== 200) {
    console.error('Falha no login:', loginRes);
    return;
  }

  const token = loginRes.data.token;
  console.log('Login OK. Token obtido.');

  console.log('2. Buscando dados financeiros (sem filtro de data)...');
  const finRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/financeiro',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('Resposta Financeiro (Sem filtro):', finRes.data);

  console.log('3. Buscando dados financeiros (com filtro de data)...');
  // Simular as datas que o frontend envia
  const hoje = new Date();
  const mesPassado = new Date();
  mesPassado.setDate(mesPassado.getDate() - 30);
  
  const dataInicio = mesPassado.toISOString().split('T')[0];
  const dataFim = hoje.toISOString().split('T')[0];
  
  console.log(`Filtro: ${dataInicio} a ${dataFim}`);
  
  const finResFiltro = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/admin/financeiro?dataInicio=${dataInicio}&dataFim=${dataFim}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('Resposta Financeiro (Com filtro):', finResFiltro.data);
}

run();
