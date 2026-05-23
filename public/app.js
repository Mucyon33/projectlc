const API_URL = `https://appjaanotei.online/api`;

let loja = {};
let lojaIdAtual = 1;
let categorias = [];
let produtos = [];
let bairros = [];
let adicionais = [];
let carrinho = [];
let produtoSelecionado = null;
let quantidadeSelecionada = 1;
let adicionaisSelecionados = [];
let numeroWhatsApp = '5511999999999';
let pagamentoMetodoAtual = 'dinheiro';
let perfil = { nome: '', telefone: '', endereco: '' };
let avaliacaoPendente = null;

document.addEventListener('DOMContentLoaded', () => {
    carregarDados();
    inicializarEventos();
    setTela('cardapio');
});

function getLojaIdentificadorFromPath() {
    const path = window.location.pathname || '/';
    const clean = path.replace(/\/+$/, '');
    if (!clean || clean === '/' || clean === '/index.html') return null;
    const seg = clean.split('/').filter(Boolean)[0];
    if (!seg || seg === 'admin.html' || seg === 'index.html' || seg === 'api') return null;
    return seg;
}

async function carregarDados() {
    try {
        const identificador = getLojaIdentificadorFromPath() || '1';
        const lojaRes = await fetch(`${API_URL}/loja/${encodeURIComponent(identificador)}`);
        if (!lojaRes.ok) {
            lojaIdAtual = 0;
            loja = {};
            categorias = [];
            produtos = [];
            bairros = [];
            adicionais = [];
            mostrarLojaNaoEncontrada();
            return;
        }
        loja = await lojaRes.json();

        lojaIdAtual = loja?.id || 1;

        const [categoriasRes, produtosRes, bairrosRes, adicionaisRes] = await Promise.all([
            fetch(`${API_URL}/categorias?loja_id=${lojaIdAtual}`),
            fetch(`${API_URL}/produtos?loja_id=${lojaIdAtual}`),
            fetch(`${API_URL}/bairros?loja_id=${lojaIdAtual}`),
            fetch(`${API_URL}/adicionais?loja_id=${lojaIdAtual}`)
        ]);

        categorias = await categoriasRes.json();
        produtos = await produtosRes.json();
        bairros = await bairrosRes.json();
        adicionais = await adicionaisRes.json();

        if (loja.telefone_contato) {
            numeroWhatsApp = loja.telefone_contato.replace(/\D/g, '');
            if (!numeroWhatsApp.startsWith('55')) {
                numeroWhatsApp = '55' + numeroWhatsApp;
            }
        }

        atualizarInterface();
        carregarPerfilSalvo();
    } catch (erro) {
        console.error('Erro ao carregar dados:', erro);
    }
}

function getPerfilKey() {
    return `perfil_${lojaIdAtual}`;
}

function carregarPerfilSalvo() {
    try {
        const raw = localStorage.getItem(getPerfilKey());
        if (!raw) {
            aplicarPerfilNaUI();
            return;
        }
        const obj = JSON.parse(raw);
        if (!obj || typeof obj !== 'object') {
            aplicarPerfilNaUI();
            return;
        }
        perfil = {
            nome: String(obj.nome || ''),
            telefone: String(obj.telefone || ''),
            endereco: String(obj.endereco || '')
        };
        aplicarPerfilNaUI();
    } catch {
        aplicarPerfilNaUI();
    }
}

function salvarPerfilSalvo(novoPerfil) {
    perfil = {
        nome: String(novoPerfil?.nome || '').trim(),
        telefone: String(novoPerfil?.telefone || '').trim(),
        endereco: String(novoPerfil?.endereco || '').trim()
    };
    localStorage.setItem(getPerfilKey(), JSON.stringify(perfil));
    aplicarPerfilNaUI();
}

function aplicarPerfilNaUI() {
    const pNome = document.getElementById('perfilNome');
    const pTel = document.getElementById('perfilTelefone');
    const pEnd = document.getElementById('perfilEndereco');
    if (pNome) pNome.value = perfil.nome || '';
    if (pTel) pTel.value = perfil.telefone || '';
    if (pEnd) pEnd.value = perfil.endereco || '';

    const cNome = document.getElementById('clienteNome');
    const cTel = document.getElementById('clienteTelefone');
    const cEnd = document.getElementById('clienteEndereco');
    if (cNome && !cNome.value) cNome.value = perfil.nome || '';
    if (cTel && !cTel.value) cTel.value = perfil.telefone || '';
    if (cEnd && !cEnd.value) cEnd.value = perfil.endereco || '';
}

function setTela(tela) {
    const categoriasNav = document.getElementById('categoriasNav');
    const produtosSection = document.getElementById('produtosSection');
    const comunicadoSection = document.getElementById('comunicadoSection');
    const meusPedidosSection = document.getElementById('meusPedidosSection');
    const perfilSection = document.getElementById('perfilSection');

    if (categoriasNav) categoriasNav.classList.toggle('hidden', tela !== 'cardapio');
    if (produtosSection) produtosSection.classList.toggle('hidden', tela !== 'cardapio');
    if (comunicadoSection) comunicadoSection.classList.toggle('hidden', true);
    if (meusPedidosSection) meusPedidosSection.classList.toggle('hidden', tela !== 'pedidos');
    if (perfilSection) perfilSection.classList.toggle('hidden', tela !== 'perfil');

    if (tela === 'pedidos') carregarMeusPedidos();
    if (tela === 'perfil') aplicarPerfilNaUI();
}

function formatStatusPedido(status) {
    const s = String(status || 'pendente').toLowerCase();
    const label = s === 'preparando' ? 'Preparando' : (s === 'pronto' ? 'Pronto' : (s === 'entregue' ? 'Entregue' : (s === 'cancelado' ? 'Cancelado' : 'Pendente')));
    return { classe: s, label };
}

function formatDataBR(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatPagamentoLabel(metodo, troco) {
    const m = String(metodo || '').toLowerCase();
    if (m === 'pix') return 'Pix';
    if (m === 'cartao') return 'Cartão';
    if (m === 'dinheiro') {
        if (troco !== null && troco !== undefined && troco !== '') return `Dinheiro (troco p/ R$ ${Number(troco).toFixed(2).replace('.', ',')})`;
        return 'Dinheiro';
    }
    return m || '-';
}

async function carregarMeusPedidos() {
    const aviso = document.getElementById('meusPedidosAviso');
    const lista = document.getElementById('meusPedidosLista');
    if (!lista || !aviso) return;

    const telefone = String(perfil.telefone || '').trim();
    if (!telefone) {
        aviso.classList.remove('hidden');
        aviso.innerHTML = '<p>Cadastre seu telefone na aba Perfil para ver seus pedidos.</p>';
        lista.innerHTML = '';
        return;
    }

    aviso.classList.add('hidden');
    lista.innerHTML = '<div class="comunicado-card"><p>Carregando...</p></div>';

    try {
        const url = `${API_URL}/pedidos/cliente?loja_id=${encodeURIComponent(lojaIdAtual)}&telefone=${encodeURIComponent(telefone)}`;
        const pedidos = await fetch(url).then((r) => r.json());
        if (!Array.isArray(pedidos) || pedidos.length === 0) {
            lista.innerHTML = '<div class="comunicado-card"><p>Nenhum pedido encontrado para este telefone.</p></div>';
            return;
        }

        lista.innerHTML = pedidos.map((p) => {
            const st = formatStatusPedido(p.status);
            const pg = formatPagamentoLabel(p.pagamento_metodo, p.pagamento_troco);
            return `
                <div class="pedido-card">
                    <div class="pedido-top">
                        <div>
                            <div class="pedido-id">Pedido #${p.id}</div>
                            <div class="pedido-meta">${formatDataBR(p.created_at)} • ${pg}</div>
                        </div>
                        <div class="pedido-status ${st.classe}">${st.label}</div>
                    </div>
                    <div class="pedido-meta">Total: R$ ${Number(p.total || 0).toFixed(2).replace('.', ',')}</div>
                </div>
            `;
        }).join('');
    } catch (e) {
        lista.innerHTML = '<div class="comunicado-card"><p>Erro ao carregar pedidos. Tente novamente.</p></div>';
    }
}

function mostrarLojaNaoEncontrada() {
    const statusIndicator = document.querySelector('.status-indicator');
    const statusTexto = document.getElementById('statusTexto');
    if (statusIndicator) {
        statusIndicator.classList.remove('aberto');
        statusIndicator.classList.add('fechado');
    }
    if (statusTexto) statusTexto.textContent = 'Indisponível';
    const nomeLoja = document.getElementById('nomeLoja');
    if (nomeLoja) nomeLoja.textContent = 'Loja não encontrada';
    const horarioLoja = document.getElementById('horarioLoja');
    if (horarioLoja) horarioLoja.textContent = 'Verifique o link e tente novamente.';

    const fechado = document.getElementById('lojaFechada');
    const conteudo = document.getElementById('conteudoPrincipal');
    if (fechado) fechado.classList.remove('hidden');
    if (conteudo) conteudo.classList.add('hidden');

    const carrinhoFlutuante = document.getElementById('carrinhoFlutuante');
    if (carrinhoFlutuante) carrinhoFlutuante.style.display = 'none';
}

function atualizarInterface() {
    document.documentElement.style.setProperty('--primary', loja.cor_primaria || '#25D366');
    document.documentElement.style.setProperty('--secondary', loja.cor_secundaria || '#128C7E');

    if (loja.nome) {
        document.getElementById('nomeLoja').textContent = loja.nome;
    }

    if (loja.horario_funcionamento) {
        document.getElementById('horarioLoja').textContent = loja.horario_funcionamento;
    }

    const statusIndicator = document.querySelector('.status-indicator');
    const statusTexto = document.getElementById('statusTexto');
    if (loja.loja_aberta === 0) {
        statusIndicator.classList.remove('aberto');
        statusIndicator.classList.add('fechado');
        statusTexto.textContent = 'Fechado';
    } else {
        statusIndicator.classList.remove('fechado');
        statusIndicator.classList.add('aberto');
        statusTexto.textContent = 'Aberto';
    }

    const logoCircle = document.getElementById('logoCircle');
    if (loja.logo_url) {
        logoCircle.innerHTML = `<img src="${loja.logo_url}" alt="Logo">`;
    }

    const bannerTopo = document.getElementById('bannerTopo');
    if (loja.banner_url) {
        bannerTopo.style.backgroundImage = `url(${loja.banner_url})`;
    }

    if (loja.comunicado) {
        const comunicadoDiv = document.getElementById('comunicado');
        const comunicadoTexto = document.getElementById('comunicadoTexto');
        const comunicadoFull = document.getElementById('comunicadoFull');
        comunicadoTexto.textContent = loja.comunicado;
        comunicadoFull.textContent = loja.comunicado;
        comunicadoDiv.classList.remove('hidden');
        document.getElementById('comunicadoSection').classList.remove('hidden');
    }

    if (loja.loja_aberta === 0) {
        document.getElementById('lojaFechada').classList.remove('hidden');
        document.getElementById('conteudoPrincipal').classList.add('hidden');
    } else {
        document.getElementById('lojaFechada').classList.add('hidden');
        document.getElementById('conteudoPrincipal').classList.remove('hidden');
    }

    renderizarCategorias();
    renderizarProdutos(categorias[0]?.id);
    renderizarBairros();
    configurarPagamento();
}

function configurarPagamento() {
    const aceitaDinheiro = loja.aceita_dinheiro !== 0;
    const aceitaCartao = loja.aceita_cartao !== 0;
    const aceitaPix = loja.aceita_pix === 1;

    const optDinheiro = document.querySelector('input[name="pagamentoMetodo"][value="dinheiro"]')?.closest('.pagamento-option');
    const optCartao = document.querySelector('input[name="pagamentoMetodo"][value="cartao"]')?.closest('.pagamento-option');
    const optPix = document.querySelector('input[name="pagamentoMetodo"][value="pix"]')?.closest('.pagamento-option');

    if (optDinheiro) optDinheiro.style.display = aceitaDinheiro ? '' : 'none';
    if (optCartao) optCartao.style.display = aceitaCartao ? '' : 'none';
    if (optPix) optPix.style.display = aceitaPix ? '' : 'none';

    const pixChave = String(loja.pix_chave || '').trim();
    const pixNome = String(loja.pix_nome || '').trim();
    const pixChaveTexto = document.getElementById('pixChaveTexto');
    const pixNomeTexto = document.getElementById('pixNomeTexto');
    if (pixChaveTexto) pixChaveTexto.textContent = pixChave || 'Pix não configurado';
    if (pixNomeTexto) pixNomeTexto.textContent = pixNome ? `Favorecido: ${pixNome}` : '';

    const preferido = aceitaDinheiro ? 'dinheiro' : (aceitaCartao ? 'cartao' : (aceitaPix ? 'pix' : 'dinheiro'));
    const selecionado = document.querySelector('input[name="pagamentoMetodo"]:checked')?.value;
    const metodo = selecionado && ((selecionado === 'dinheiro' && aceitaDinheiro) || (selecionado === 'cartao' && aceitaCartao) || (selecionado === 'pix' && aceitaPix))
        ? selecionado
        : preferido;

    const radio = document.querySelector(`input[name="pagamentoMetodo"][value="${metodo}"]`);
    if (radio) radio.checked = true;
    pagamentoMetodoAtual = metodo;
    atualizarPagamentoUI();
}

function atualizarPagamentoUI() {
    const metodo = document.querySelector('input[name="pagamentoMetodo"]:checked')?.value || 'dinheiro';
    pagamentoMetodoAtual = metodo;

    const trocoGroup = document.getElementById('trocoGroup');
    const pixInfo = document.getElementById('pixInfo');

    const aceitaPix = loja.aceita_pix === 1;
    const pixChave = String(loja.pix_chave || '').trim();

    if (trocoGroup) trocoGroup.classList.toggle('hidden', metodo !== 'dinheiro');
    if (pixInfo) pixInfo.classList.toggle('hidden', !(metodo === 'pix' && aceitaPix && pixChave));
}

function renderizarCategorias() {
    const scroll = document.getElementById('categoriasScroll');
    
    let botoes = '';
    if (loja.comunicado) {
        botoes += `<button class="categoria-btn" data-categoria="comunicado">COMUNICADO</button>`;
    }
    
    botoes += categorias.map(cat => `
        <button class="categoria-btn ${cat.id === categorias[0]?.id && !loja.comunicado ? 'active' : ''}" 
                data-categoria="${cat.id}">
            ${cat.nome}
        </button>
    `).join('');

    scroll.innerHTML = botoes;

    scroll.querySelectorAll('.categoria-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            scroll.querySelectorAll('.categoria-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const categoria = btn.dataset.categoria;
            if (categoria === 'comunicado') {
                document.getElementById('comunicadoSection').classList.remove('hidden');
                document.getElementById('produtosSection').classList.add('hidden');
            } else {
                document.getElementById('comunicadoSection').classList.add('hidden');
                document.getElementById('produtosSection').classList.remove('hidden');
                renderizarProdutos(parseInt(categoria));
            }
        });
    });
}

function renderizarProdutos(categoriaId) {
    const section = document.getElementById('produtosSection');
    const produtosFiltrados = produtos.filter(p => p.categoria_id === categoriaId && p.disponivel === 1);

    section.innerHTML = `
        <h2>${categorias.find(c => c.id === categoriaId)?.nome || 'Produtos'}</h2>
        <div class="produtos-grid">
            ${produtosFiltrados.map(prod => `
                <div class="produto-card" data-id="${prod.id}">
                    <div class="produto-imagem">
                        ${prod.imagem ? `<img src="${prod.imagem}" alt="${prod.nome}">` : '🍽️'}
                    </div>
                    <div class="produto-info">
                        <h3>${prod.nome}</h3>
                        <p>${prod.descricao || ''}</p>
                        <p class="produto-preco">R$ ${prod.preco.toFixed(2).replace('.', ',')}</p>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    section.querySelectorAll('.produto-card').forEach(card => {
        card.addEventListener('click', () => {
            abrirProdutoModal(parseInt(card.dataset.id));
        });
    });
}

function renderizarBairros() {
    const select = document.getElementById('clienteBairro');
    select.innerHTML = '<option value="">Selecione um bairro</option>' + 
        bairros.map(b => `<option value="${b.id}" data-taxa="${b.taxa}">${b.nome} - R$ ${b.taxa.toFixed(2).replace('.', ',')}</option>`).join('');
}

function abrirProdutoModal(produtoId) {
    produtoSelecionado = produtos.find(p => p.id === produtoId);
    quantidadeSelecionada = 1;
    adicionaisSelecionados = [];

    document.getElementById('produtoNome').textContent = produtoSelecionado.nome;
    document.getElementById('produtoDescricao').textContent = produtoSelecionado.descricao || '';
    document.getElementById('produtoPreco').textContent = `R$ ${produtoSelecionado.preco.toFixed(2).replace('.', ',')}`;
    
    const imagemEl = document.getElementById('produtoImagem');
    if (produtoSelecionado.imagem) {
        imagemEl.innerHTML = `<img src="${produtoSelecionado.imagem}" alt="${produtoSelecionado.nome}">`;
    } else {
        imagemEl.innerHTML = '🍽️';
    }

    document.getElementById('quantidade').textContent = quantidadeSelecionada;

    const adicionaisProduto = adicionais.filter(a => 
        a.produto_id === produtoSelecionado.id || 
        a.categoria_id === produtoSelecionado.categoria_id ||
        (!a.produto_id && !a.categoria_id)
    );

    const adicionaisSection = document.getElementById('adicionaisSection');
    if (adicionaisProduto.length > 0) {
        adicionaisSection.innerHTML = `
            <h3>Adicionais</h3>
            ${adicionaisProduto.map(ad => `
                <div class="adicional-item">
                    <label>
                        <input type="checkbox" class="adicional-check" data-id="${ad.id}" data-preco="${ad.preco}">
                        ${ad.nome}
                    </label>
                    <span class="adicional-preco">+ R$ ${ad.preco.toFixed(2).replace('.', ',')}</span>
                </div>
            `).join('')}
        `;

        adicionaisSection.querySelectorAll('.adicional-check').forEach(check => {
            check.addEventListener('change', () => {
                if (check.checked) {
                    adicionaisSelecionados.push({
                        id: parseInt(check.dataset.id),
                        nome: check.parentElement.textContent.trim().split('+')[0].trim(),
                        preco: parseFloat(check.dataset.preco)
                    });
                } else {
                    adicionaisSelecionados = adicionaisSelecionados.filter(a => a.id !== parseInt(check.dataset.id));
                }
            });
        });
    } else {
        adicionaisSection.innerHTML = '';
    }

    document.getElementById('produtoModal').classList.remove('hidden');
}

function adicionarAoCarrinho() {
    const item = {
        produto_id: produtoSelecionado.id,
        nome: produtoSelecionado.nome,
        preco_unitario: produtoSelecionado.preco,
        quantidade: quantidadeSelecionada,
        adicionais: [...adicionaisSelecionados]
    };

    carrinho.push(item);
    atualizarCarrinho();
    document.getElementById('produtoModal').classList.add('hidden');
}

function atualizarCarrinho() {
    const countEl = document.getElementById('carrinhoCount');
    const totalEl = document.getElementById('carrinhoTotal');
    const flutuante = document.getElementById('carrinhoFlutuante');

    countEl.textContent = carrinho.length;
    const total = calcularTotal();
    totalEl.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;

    if (carrinho.length > 0) {
        flutuante.style.display = 'block';
    } else {
        flutuante.style.display = 'none';
    }

    const itensEl = document.getElementById('itensCarrinho');
    if (carrinho.length === 0) {
        itensEl.innerHTML = '<p style="text-align:center;color:#888;padding:30px;">Carrinho vazio</p>';
        document.getElementById('totalCarrinho').textContent = 'R$ 0,00';
        return;
    }

    itensEl.innerHTML = carrinho.map((item, index) => {
        let subtotal = item.preco_unitario * item.quantidade;
        item.adicionais.forEach(ad => subtotal += ad.preco * item.quantidade);

        return `
            <div class="carrinho-item">
                <div class="carrinho-item-info">
                    <h4>${item.nome} x${item.quantidade}</h4>
                    ${item.adicionais.length > 0 ? `<p>+ ${item.adicionais.map(a => a.nome).join(', ')}</p>` : ''}
                    <p class="carrinho-item-preco">R$ ${subtotal.toFixed(2).replace('.', ',')}</p>
                </div>
                <button class="carrinho-item-remover" data-index="${index}">Remover</button>
            </div>
        `;
    }).join('');

    itensEl.querySelectorAll('.carrinho-item-remover').forEach(btn => {
        btn.addEventListener('click', () => {
            carrinho.splice(parseInt(btn.dataset.index), 1);
            atualizarCarrinho();
        });
    });

    document.getElementById('totalCarrinho').textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
}

function calcularTotal() {
    let total = 0;
    carrinho.forEach(item => {
        total += item.preco_unitario * item.quantidade;
        item.adicionais.forEach(ad => total += ad.preco * item.quantidade);
    });

    const bairroSelect = document.getElementById('clienteBairro');
    if (bairroSelect && bairroSelect.value) {
        const taxa = parseFloat(bairroSelect.options[bairroSelect.selectedIndex].dataset.taxa);
        total += taxa;
    }

    return total;
}

function inicializarEventos() {
    document.getElementById('carrinhoBtn').addEventListener('click', () => {
        atualizarCarrinho();
        document.getElementById('carrinhoModal').classList.remove('hidden');
    });

    document.getElementById('fecharCarrinho').addEventListener('click', () => {
        document.getElementById('carrinhoModal').classList.add('hidden');
    });

    document.getElementById('fecharProduto').addEventListener('click', () => {
        document.getElementById('produtoModal').classList.add('hidden');
    });

    document.getElementById('fecharCheckout').addEventListener('click', () => {
        document.getElementById('checkoutModal').classList.add('hidden');
    });

    document.getElementById('diminuirQtd').addEventListener('click', () => {
        if (quantidadeSelecionada > 1) {
            quantidadeSelecionada--;
            document.getElementById('quantidade').textContent = quantidadeSelecionada;
        }
    });

    document.getElementById('aumentarQtd').addEventListener('click', () => {
        quantidadeSelecionada++;
        document.getElementById('quantidade').textContent = quantidadeSelecionada;
    });

    document.getElementById('adicionarCarrinhoBtn').addEventListener('click', adicionarAoCarrinho);

    document.getElementById('finalizarPedidoBtn').addEventListener('click', async () => {
        if (carrinho.length === 0) {
            alert('Carrinho vazio!');
            return;
        }
        aplicarPerfilNaUI();
        const precisa = await checarAvaliacaoPendente();
        if (precisa) {
            document.getElementById('carrinhoModal').classList.add('hidden');
            abrirAvaliacaoModal();
            return;
        }
        document.getElementById('carrinhoModal').classList.add('hidden');
        document.getElementById('checkoutModal').classList.remove('hidden');
        document.getElementById('checkoutTotal').textContent = `R$ ${calcularTotal().toFixed(2).replace('.', ',')}`;
    });

    document.querySelectorAll('input[name="tipoPedido"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const enderecoGroup = document.getElementById('enderecoGroup');
            const bairroGroup = document.getElementById('bairroGroup');
            if (e.target.value === 'retirada') {
                enderecoGroup.classList.add('hidden');
                bairroGroup.classList.add('hidden');
            } else {
                enderecoGroup.classList.remove('hidden');
                bairroGroup.classList.remove('hidden');
            }
            document.getElementById('checkoutTotal').textContent = `R$ ${calcularTotal().toFixed(2).replace('.', ',')}`;
        });
    });

    document.getElementById('clienteBairro').addEventListener('change', () => {
        document.getElementById('checkoutTotal').textContent = `R$ ${calcularTotal().toFixed(2).replace('.', ',')}`;
    });

    document.querySelectorAll('input[name="pagamentoMetodo"]').forEach(radio => {
        radio.addEventListener('change', () => {
            atualizarPagamentoUI();
        });
    });

    document.getElementById('btnCopiarPix')?.addEventListener('click', async () => {
        const chave = String(loja.pix_chave || '').trim();
        if (!chave) return;
        try {
            await navigator.clipboard.writeText(chave);
            alert('Chave Pix copiada!');
        } catch {
            alert('Não foi possível copiar. Selecione e copie manualmente.');
        }
    });

    document.getElementById('confirmarPedidoBtn').addEventListener('click', finalizarPedido);

    document.getElementById('salvarPerfilBtn')?.addEventListener('click', () => {
        const nome = document.getElementById('perfilNome')?.value?.trim() || '';
        const telefone = document.getElementById('perfilTelefone')?.value?.trim() || '';
        const endereco = document.getElementById('perfilEndereco')?.value?.trim() || '';
        if (!nome || !telefone) {
            alert('Preencha nome e telefone.');
            return;
        }
        salvarPerfilSalvo({ nome, telefone, endereco });
        alert('Perfil salvo.');
    });

    document.getElementById('novoPedidoBtn').addEventListener('click', () => {
        carrinho = [];
        atualizarCarrinho();
        document.getElementById('sucessoModal').classList.add('hidden');
    });

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            const section = item.dataset.section;
            if (section) setTela(section);
        });
    });

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal && modal.id !== 'sucessoModal') {
                modal.classList.add('hidden');
            }
        });
    });

    document.getElementById('enviarAvaliacaoBtn')?.addEventListener('click', enviarAvaliacao);
}

async function checarAvaliacaoPendente() {
    const telefone = String(perfil.telefone || '').trim();
    if (!telefone) return false;
    try {
        const url = `${API_URL}/avaliacoes/pendente?loja_id=${encodeURIComponent(lojaIdAtual)}&telefone=${encodeURIComponent(telefone)}`;
        const r = await fetch(url);
        const data = await r.json();
        avaliacaoPendente = data || null;
        return !!avaliacaoPendente;
    } catch {
        avaliacaoPendente = null;
        return false;
    }
}

function montarStars() {
    document.querySelectorAll('.stars').forEach((wrap) => {
        if (wrap.dataset.ready === '1') return;
        wrap.dataset.ready = '1';
        wrap.dataset.value = '';
        wrap.innerHTML = '';
        for (let i = 1; i <= 5; i++) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'star-btn';
            btn.textContent = '★';
            btn.addEventListener('click', () => {
                wrap.dataset.value = String(i);
                wrap.querySelectorAll('.star-btn').forEach((b, idx) => {
                    b.classList.toggle('active', idx < i);
                });
            });
            wrap.appendChild(btn);
        }
    });
}

function abrirAvaliacaoModal() {
    montarStars();
    document.querySelectorAll('.stars').forEach((wrap) => {
        wrap.dataset.value = '';
        wrap.querySelectorAll('.star-btn').forEach((b) => b.classList.remove('active'));
    });
    document.getElementById('avaliacaoModal')?.classList.remove('hidden');
}

async function enviarAvaliacao() {
    if (!avaliacaoPendente?.pedido_id) {
        document.getElementById('avaliacaoModal')?.classList.add('hidden');
        return;
    }

    const getNota = (field) => {
        const el = document.querySelector(`.stars[data-field="${field}"]`);
        return el?.dataset?.value ? Number(el.dataset.value) : 0;
    };

    const nota_pedido = getNota('nota_pedido');
    const nota_servico = getNota('nota_servico');
    const nota_entrega = getNota('nota_entrega');
    if (![nota_pedido, nota_servico, nota_entrega].every((n) => Number.isInteger(n) && n >= 1 && n <= 5)) {
        alert('Selecione as estrelas para Pedido, Serviço e Entrega.');
        return;
    }

    try {
        const payload = {
            loja_id: lojaIdAtual,
            telefone: String(perfil.telefone || '').trim(),
            pedido_id: avaliacaoPendente.pedido_id,
            nota_pedido,
            nota_servico,
            nota_entrega
        };
        const r = await fetch(`${API_URL}/avaliacoes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await r.json();
        if (!r.ok) {
            alert(data?.erro || 'Erro ao enviar avaliação');
            return;
        }
        avaliacaoPendente = null;
        document.getElementById('avaliacaoModal')?.classList.add('hidden');
        document.getElementById('checkoutModal').classList.remove('hidden');
        document.getElementById('checkoutTotal').textContent = `R$ ${calcularTotal().toFixed(2).replace('.', ',')}`;
    } catch {
        alert('Erro ao enviar avaliação');
    }
}

async function finalizarPedido() {
    const nome = document.getElementById('clienteNome').value.trim();
    const telefone = document.getElementById('clienteTelefone').value.trim();
    const tipo = document.querySelector('input[name="tipoPedido"]:checked').value;
    const endereco = document.getElementById('clienteEndereco').value.trim();
    const bairroId = document.getElementById('clienteBairro').value;
    const observacoes = document.getElementById('observacoes').value.trim();
    const pagamento_metodo = document.querySelector('input[name="pagamentoMetodo"]:checked')?.value || 'dinheiro';
    const trocoPara = document.getElementById('trocoPara')?.value;
    const pagamento_troco = pagamento_metodo === 'dinheiro' && trocoPara !== undefined && trocoPara !== null && String(trocoPara).trim() !== ''
        ? Number(String(trocoPara).replace(',', '.'))
        : null;

    if (!nome || !telefone) {
        alert('Preencha nome e telefone!');
        return;
    }

    if (tipo === 'delivery' && (!endereco || !bairroId)) {
        alert('Preencha endereço e bairro para delivery!');
        return;
    }

    if (pagamento_metodo === 'pix') {
        const aceitaPix = loja.aceita_pix === 1;
        const chave = String(loja.pix_chave || '').trim();
        if (!aceitaPix || !chave) {
            alert('Pix não está disponível nesta loja.');
            return;
        }
    }

    try {
        salvarPerfilSalvo({ nome, telefone, endereco });
        const pedido = await fetch(`${API_URL}/pedidos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                loja_id: lojaIdAtual,
                cliente_info: { nome, telefone, endereco },
                tipo,
                itens: carrinho,
                observacoes,
                pagamento_metodo,
                pagamento_troco
            })
        }).then(res => res.json());

        document.getElementById('checkoutModal').classList.add('hidden');
        document.getElementById('pedidoNumero').textContent = `Pedido #${pedido.id}`;

        const mensagem = gerarMensagemWhatsApp(pedido);
        document.getElementById('whatsappBtn').href = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensagem)}`;

        document.getElementById('sucessoModal').classList.remove('hidden');
    } catch (erro) {
        console.error('Erro ao finalizar pedido:', erro);
        alert('Erro ao finalizar pedido. Tente novamente!');
    }
}

function gerarMensagemWhatsApp(pedido) {
    let msg = `🍔 NOVO PEDIDO #${pedido.id}\n\n`;
    msg += `👤 Cliente: ${pedido.cliente_nome}\n`;
    msg += `📱 Telefone: ${pedido.cliente_telefone}\n`;
    if (pedido.cliente_endereco) {
        msg += `📍 Endereço: ${pedido.cliente_endereco}\n`;
    }
    msg += `📦 Tipo: ${pedido.tipo === 'delivery' ? 'Delivery' : 'Retirada'}\n`;
    if (pedido.pagamento_metodo) {
        const metodo = String(pedido.pagamento_metodo).toLowerCase();
        const label = metodo === 'pix' ? 'Pix' : (metodo === 'cartao' ? 'Cartão' : 'Dinheiro');
        msg += `💳 Pagamento: ${label}\n`;
        if (metodo === 'dinheiro' && pedido.pagamento_troco !== null && pedido.pagamento_troco !== undefined && pedido.pagamento_troco !== '') {
            msg += `💵 Troco para: R$ ${Number(pedido.pagamento_troco).toFixed(2)}\n`;
        }
        if (metodo === 'pix') {
            const chave = String(loja.pix_chave || '').trim();
            const nome = String(loja.pix_nome || '').trim();
            if (chave) msg += `🔑 Chave Pix: ${chave}\n`;
            if (nome) msg += `👤 Pix em nome de: ${nome}\n`;
        }
    }
    msg += `\n📋 Itens:\n`;

    pedido.itens.forEach(item => {
        msg += `• ${item.produto_nome} x${item.quantidade} - R$ ${(item.preco_unitario * item.quantidade).toFixed(2)}\n`;
    });

    msg += `\n💰 Total: R$ ${pedido.total.toFixed(2)}\n`;
    if (pedido.observacoes) {
        msg += `\n📝 Observações: ${pedido.observacoes}\n`;
    }

    return msg;
}
