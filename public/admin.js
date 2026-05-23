const API_URL = `https://appjaanotei.online/api`;

let token = null;
let admin = null;

const state = {
    section: 'dashboard',
    cache: {
        categorias: null,
        produtos: null,
        adicionais: null,
        clientes: null,
        pedidos: null,
        despesas: null,
        configuracoes: null
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const savedToken = localStorage.getItem('token');
    const savedAdmin = localStorage.getItem('admin');

    if (savedToken && savedAdmin) {
        token = savedToken;
        admin = JSON.parse(savedAdmin);
        mostrarAdmin();
        inicializarAdmin();
    } else {
        inicializarLogin();
    }
});

function qs(sel) {
    return document.querySelector(sel);
}

function qsa(sel) {
    return Array.from(document.querySelectorAll(sel));
}

function setText(el, text) {
    if (!el) return;
    el.textContent = text;
}

function setHtml(el, html) {
    if (!el) return;
    el.innerHTML = html;
}

function todayISO() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}

function addDaysISO(baseISO, days) {
    const d = new Date(`${baseISO}T00:00:00`);
    d.setDate(d.getDate() + days);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}

function formatCurrency(value) {
    const n = Number(value || 0);
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDateTime(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(s) {
    return String(s ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function parseJsonSafe(s) {
    try {
        return JSON.parse(s);
    } catch {
        return null;
    }
}

function atualizarPillDelivery(cfg) {
    const el = qs('#deliveryStatusPill');
    if (!el) return;
    const aberta = cfg?.loja_aberta !== 0;
    el.textContent = aberta ? 'Delivery em funcionamento' : 'Delivery fora do horário';
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
        reader.onload = () => resolve(String(reader.result || ''));
        reader.readAsDataURL(file);
    });
}

async function handleImageFileInput({ inputEl, targetInputSelector, maxBytes }) {
    const f = inputEl?.files?.[0];
    if (!f) return;
    if (maxBytes && f.size > maxBytes) {
        alert(`Arquivo muito grande. Máximo: ${(maxBytes / 1024 / 1024).toFixed(1)}MB`);
        inputEl.value = '';
        return;
    }
    try {
        const dataUrl = await fileToDataUrl(f);
        const target = qs(targetInputSelector);
        if (target) target.value = dataUrl;
    } catch (err) {
        alert(err.message || 'Erro ao carregar imagem');
    }
}

function getPeriodo() {
    const inicio = qs('#dateInicio')?.value?.trim();
    const fim = qs('#dateFim')?.value?.trim();
    if (!inicio || !fim) return null;
    return { inicio, fim };
}

async function apiFetch(path, options = {}) {
    const { method = 'GET', body, auth = true } = options;
    const headers = { 'Content-Type': 'application/json' };
    if (auth && token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${API_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });

    if (res.status === 401) {
        logout();
        throw new Error('Não autenticado');
    }

    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await res.json() : await res.text();

    if (!res.ok) {
        const msg = typeof data === 'object' ? (data.erro || data.mensagem || 'Erro') : String(data || 'Erro');
        throw new Error(msg);
    }

    return data;
}

function inicializarLogin() {
    qs('#loginForm')?.addEventListener('submit', login);
    qs('#closeModal')?.addEventListener('click', fecharModal);
}

function inicializarAdmin() {
    qs('#closeModal')?.addEventListener('click', fecharModal);
    qs('#btnAtualizarPeriodo')?.addEventListener('click', () => recarregarSecaoAtual({ force: true }));

    qs('#btnBaseClientes')?.addEventListener('click', () => navegarPara('clientes'));
    qs('#btnBasePedidos')?.addEventListener('click', () => navegarPara('pedidos'));
    qs('#btnNps')?.addEventListener('click', abrirModalNps);
    qs('#btnNotificacoes')?.addEventListener('click', () => abrirModalInfo('Notificações', 'Sem notificações no momento.'));
    qs('#btnPerfil')?.addEventListener('click', abrirModalPerfil);

    qs('#btnAtalhoPedidos')?.addEventListener('click', () => navegarPara('pedidos'));
    qs('#btnAtalhoClientes')?.addEventListener('click', () => navegarPara('clientes'));

    qs('#btnAbrirSistemaPedidos')?.addEventListener('click', () => {
        const ident = admin?.slug || admin?.id || '1';
        window.open(`/${ident}`, '_blank');
    });
    qs('#btnAbrirWhatsapp')?.addEventListener('click', abrirWhatsappDaLoja);
    const jaAnoteiPopup = qs('#jaAnoteiPopup');
    if (jaAnoteiPopup) {
        if (localStorage.getItem('hide_ja_anotei_popup') === '1') {
            jaAnoteiPopup.classList.add('hidden');
        }
        qs('#btnFecharJaAnotei')?.addEventListener('click', () => {
            jaAnoteiPopup.classList.add('hidden');
            localStorage.setItem('hide_ja_anotei_popup', '1');
        });
    }

    qsa('.sidebar .menu-item').forEach((item) => {
        item.addEventListener('click', () => {
            const section = item.dataset.section;
            if (section) navegarPara(section);
        });
    });

    qs('#statPedidos')?.closest('.stat-card')?.addEventListener('click', () => navegarPara('pedidos'));
    qs('#statFaturamento')?.closest('.stat-card')?.addEventListener('click', () => navegarPara('financeiro'));
    qs('#statTicket')?.closest('.stat-card')?.addEventListener('click', () => navegarPara('financeiro'));

    const fim = todayISO();
    const inicio = addDaysISO(fim, -7);
    const iEl = qs('#dateInicio');
    const fEl = qs('#dateFim');
    if (iEl && !iEl.value) iEl.value = inicio;
    if (fEl && !fEl.value) fEl.value = fim;

    ensureConfiguracoes({ force: false }).catch(() => {});
    navegarPara('dashboard');
}

async function abrirModalNps() {
    const periodo = getPeriodo();
    const params = new URLSearchParams();
    if (periodo?.inicio && periodo?.fim) {
        params.set('dataInicio', periodo.inicio);
        params.set('dataFim', periodo.fim);
    }
    const query = params.toString() ? `?${params.toString()}` : '';

    abrirModal({
        titulo: 'NPS / Satisfação',
        bodyHtml: `<div class="muted">Carregando...</div>`,
        footerHtml: `<button class="btn btn-outline" id="btnFecharNps">Fechar</button>`,
        onMount: () => {
            qs('#btnFecharNps')?.addEventListener('click', fecharModal);
        }
    });

    try {
        const nps = await apiFetch(`/admin/nps${query}`);
        const total = Number(nps?.total || 0);
        const mp = Number(nps?.media_pedido || 0);
        const ms = Number(nps?.media_servico || 0);
        const me = Number(nps?.media_entrega || 0);
        const geral = total ? (mp + ms + me) / 3 : 0;

        setHtml(qs('#modalBody'), `
            <div class="grid-2">
                <div class="card">
                    <div class="card-header-simple"><h3>Resumo</h3></div>
                    <div class="card-body-simple">
                        <div><strong>Avaliações:</strong> ${escapeHtml(String(total))}</div>
                        <div><strong>Média geral:</strong> ${geral.toFixed(2)} / 5</div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header-simple"><h3>Médias</h3></div>
                    <div class="card-body-simple">
                        <div><strong>Pedido:</strong> ${mp.toFixed(2)} / 5</div>
                        <div><strong>Serviço:</strong> ${ms.toFixed(2)} / 5</div>
                        <div><strong>Entrega:</strong> ${me.toFixed(2)} / 5</div>
                    </div>
                </div>
            </div>
        `);
    } catch (err) {
        setHtml(qs('#modalBody'), `<div class="muted">${escapeHtml(err.message || 'Erro ao carregar NPS')}</div>`);
    }
}

async function login(e) {
    e.preventDefault();

    const email = qs('#loginEmail')?.value?.trim();
    const senha = qs('#loginSenha')?.value ?? '';

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, senha })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.erro || 'Erro ao fazer login');

        token = data.token;
        admin = data.admin;
        localStorage.setItem('token', token);
        localStorage.setItem('admin', JSON.stringify(admin));
        mostrarAdmin();
        inicializarAdmin();
    } catch (erro) {
        alert(erro.message || 'Erro ao fazer login');
    }
}

function logout() {
    token = null;
    admin = null;
    localStorage.removeItem('token');
    localStorage.removeItem('admin');
    window.location.reload();
}

function mostrarAdmin() {
    qs('#loginSection')?.classList.add('hidden');
    qs('#adminSection')?.classList.remove('hidden');
}

function fecharModal() {
    qs('#modal')?.classList.add('hidden');
    setHtml(qs('#modalTitle'), '');
    setHtml(qs('#modalBody'), '');
    setHtml(qs('#modalFooter'), '');
}

function abrirModal({ titulo, bodyHtml, footerHtml, onMount }) {
    setText(qs('#modalTitle'), titulo || '');
    setHtml(qs('#modalBody'), bodyHtml || '');
    setHtml(qs('#modalFooter'), footerHtml || '');
    qs('#modal')?.classList.remove('hidden');
    if (typeof onMount === 'function') onMount();
}

function abrirModalInfo(titulo, mensagem) {
    abrirModal({
        titulo,
        bodyHtml: `<div class="muted">${escapeHtml(mensagem)}</div>`,
        footerHtml: `<button class="btn btn-outline" id="btnFecharInfo">Fechar</button>`,
        onMount: () => {
            qs('#btnFecharInfo')?.addEventListener('click', fecharModal);
        }
    });
}

function abrirModalPerfil() {
    abrirModal({
        titulo: 'Minha Conta',
        bodyHtml: `
            <div class="card">
                <div class="card-body-simple">
                    <div><strong>Nome:</strong> ${escapeHtml(admin?.nome || '')}</div>
                    <div><strong>Email:</strong> ${escapeHtml(admin?.email || '')}</div>
                    <div><strong>Loja (slug):</strong> ${escapeHtml(admin?.slug || '')}</div>
                    <div><strong>Link:</strong> <a href="/${escapeHtml(admin?.slug || admin?.id || '1')}" target="_blank">/${escapeHtml(admin?.slug || admin?.id || '1')}</a></div>
                </div>
            </div>
        `,
        footerHtml: `
            <button class="btn btn-outline" id="btnFecharPerfil">Fechar</button>
            <button class="btn btn-primary-solid" id="btnSair">Sair</button>
        `,
        onMount: () => {
            qs('#btnFecharPerfil')?.addEventListener('click', fecharModal);
            qs('#btnSair')?.addEventListener('click', logout);
        }
    });
}

function setActiveMenu(section) {
    qsa('.sidebar .menu-item').forEach((el) => el.classList.toggle('active', el.dataset.section === section));
}

function setTitle(section) {
    const map = {
        dashboard: 'Página Inicial',
        pedidos: 'Pedidos',
        clientes: 'Clientes',
        produtos: 'Produtos',
        adicionais: 'Adicionais',
        fidelidade: 'Fidelidade',
        financeiro: 'Financeiro',
        categorias: 'Categorias',
        configuracoes: 'Configurações'
    };
    setText(qs('#adminTitle'), map[section] || 'Admin');
}

function mostrarSecao(section) {
    const ids = ['dashboard', 'pedidos', 'clientes', 'produtos', 'adicionais', 'fidelidade', 'financeiro', 'categorias', 'configuracoes'];
    ids.forEach((id) => qs(`#section-${id}`)?.classList.toggle('hidden', id !== section));
}

async function navegarPara(section) {
    state.section = section;
    setActiveMenu(section);
    setTitle(section);
    mostrarSecao(section);
    await recarregarSecaoAtual({ force: false });
}

async function recarregarSecaoAtual({ force }) {
    const section = state.section;
    if (section === 'dashboard') return renderDashboard({ force });
    if (section === 'pedidos') return renderPedidos({ force });
    if (section === 'clientes') return renderClientes({ force });
    if (section === 'produtos') return renderProdutos({ force });
    if (section === 'adicionais') return renderAdicionais({ force });
    if (section === 'financeiro') return renderFinanceiro({ force });
    if (section === 'categorias') return renderCategorias({ force });
    if (section === 'configuracoes') return renderConfiguracoes({ force });
    if (section === 'fidelidade') return renderFidelidade();
}

async function ensureCategorias({ force }) {
    if (!force && state.cache.categorias) return state.cache.categorias;
    const data = await apiFetch('/admin/categorias');
    state.cache.categorias = Array.isArray(data) ? data : [];
    return state.cache.categorias;
}

async function ensureProdutos({ force }) {
    if (!force && state.cache.produtos) return state.cache.produtos;
    const data = await apiFetch('/admin/produtos');
    state.cache.produtos = Array.isArray(data) ? data : [];
    return state.cache.produtos;
}

async function ensureAdicionais({ force }) {
    if (!force && state.cache.adicionais) return state.cache.adicionais;
    const data = await apiFetch('/admin/adicionais');
    state.cache.adicionais = Array.isArray(data) ? data : [];
    return state.cache.adicionais;
}

async function ensureClientes({ force }) {
    if (!force && state.cache.clientes) return state.cache.clientes;
    const data = await apiFetch('/admin/clientes');
    state.cache.clientes = Array.isArray(data) ? data : [];
    return state.cache.clientes;
}

async function ensurePedidos({ force, filtros }) {
    if (!force && state.cache.pedidos && !filtros) return state.cache.pedidos;
    const params = new URLSearchParams();
    if (filtros?.status && filtros.status !== 'todos') params.set('status', filtros.status);
    if (filtros?.tipo && filtros.tipo !== 'todos') params.set('tipo', filtros.tipo);
    const query = params.toString() ? `?${params.toString()}` : '';
    const data = await apiFetch(`/admin/pedidos${query}`);
    if (!filtros) state.cache.pedidos = Array.isArray(data) ? data : [];
    return Array.isArray(data) ? data : [];
}

async function ensureDespesas({ force, filtros }) {
    if (!force && state.cache.despesas && !filtros) return state.cache.despesas;
    const params = new URLSearchParams();
    if (filtros?.inicio && filtros?.fim) {
        params.set('dataInicio', filtros.inicio);
        params.set('dataFim', filtros.fim);
    }
    if (filtros?.categoria) params.set('categoria', filtros.categoria);
    const query = params.toString() ? `?${params.toString()}` : '';
    const data = await apiFetch(`/admin/despesas${query}`);
    if (!filtros) state.cache.despesas = Array.isArray(data) ? data : [];
    return Array.isArray(data) ? data : [];
}

async function ensureConfiguracoes({ force }) {
    if (!force && state.cache.configuracoes) return state.cache.configuracoes;
    const data = await apiFetch('/admin/configuracoes');
    state.cache.configuracoes = data && typeof data === 'object' ? data : {};
    atualizarPillDelivery(state.cache.configuracoes);
    return state.cache.configuracoes;
}

async function renderDashboard({ force }) {
    const periodo = getPeriodo();
    const params = new URLSearchParams();
    if (periodo?.inicio && periodo?.fim) {
        params.set('dataInicio', periodo.inicio);
        params.set('dataFim', periodo.fim);
    }
    const query = params.toString() ? `?${params.toString()}` : '';

    try {
        const financeiro = await apiFetch(`/admin/financeiro${query}`);
        const vendas = Number(financeiro?.vendas || 0);
        const despesas = Number(financeiro?.despesas || 0);
        const totalPedidos = Number(financeiro?.totalPedidos || 0);
        const ticket = totalPedidos > 0 ? vendas / totalPedidos : 0;

        setText(qs('#statPedidos'), String(totalPedidos));
        setText(qs('#statFaturamento'), formatCurrency(vendas));
        setText(qs('#statTicket'), formatCurrency(ticket));
        setText(qs('#dashFaturamentoDelivery'), totalPedidos > 0 ? `${formatCurrency(vendas)} em ${totalPedidos} pedidos` : 'Não há registros nesse período.');

        await ensureConfiguracoes({ force: false });
    } catch (err) {
        setText(qs('#dashFaturamentoDelivery'), err.message || 'Erro ao carregar dashboard.');
    }
}

function badgeStatus(status) {
    const s = String(status || '').toLowerCase();
    const cls = `badge badge-${s || 'pendente'}`;
    return `<span class="${cls}">${escapeHtml(s || 'pendente')}</span>`;
}

function formatPagamento(pedido) {
    const metodo = String(pedido?.pagamento_metodo || '').toLowerCase();
    if (!metodo) return '-';
    if (metodo === 'pix') return 'Pix';
    if (metodo === 'cartao') return 'Cartão';
    if (metodo === 'dinheiro') {
        const t = pedido?.pagamento_troco;
        if (t !== null && t !== undefined && t !== '') return `Dinheiro (troco p/ ${formatCurrency(t)})`;
        return 'Dinheiro';
    }
    return escapeHtml(metodo);
}

async function atualizarStatusPedido(pedidoId, status) {
    await apiFetch(`/admin/pedidos/${pedidoId}/status`, { method: 'PUT', body: { status } });
}

function renderItensPedidoHtml(itens) {
    if (!Array.isArray(itens) || itens.length === 0) return '<div class="muted">Sem itens.</div>';
    const rows = itens.map((it) => {
        const adicionais = it.adicionais ? parseJsonSafe(it.adicionais) : null;
        const adicionaisText = Array.isArray(adicionais) && adicionais.length
            ? adicionais.map((a) => `${a.nome} (${formatCurrency(a.preco)})`).join(', ')
            : '';
        return `
            <tr>
                <td>${escapeHtml(it.produto_nome || '')}</td>
                <td>${it.quantidade || 0}</td>
                <td>${formatCurrency(it.preco_unitario)}</td>
                <td class="muted">${escapeHtml(adicionaisText)}</td>
            </tr>
        `;
    }).join('');
    return `
        <table class="table">
            <thead>
                <tr>
                    <th>Item</th>
                    <th>Qtd</th>
                    <th>Preço</th>
                    <th>Adicionais</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

async function renderPedidos({ force }) {
    const container = qs('#section-pedidos');
    if (!container) return;

    const statusAtual = container.dataset.status || 'todos';
    const tipoAtual = container.dataset.tipo || 'todos';

    setHtml(container, `
        <div class="section-toolbar">
            <div class="toolbar-left">
                <select class="select" id="filtroStatus">
                    <option value="todos">Todos</option>
                    <option value="pendente">Pendente</option>
                    <option value="preparando">Preparando</option>
                    <option value="pronto">Pronto</option>
                    <option value="entregue">Entregue</option>
                    <option value="cancelado">Cancelado</option>
                </select>
                <select class="select" id="filtroTipo">
                    <option value="todos">Todos os tipos</option>
                    <option value="online">Online</option>
                    <option value="delivery">Delivery</option>
                    <option value="retirada">Retirada</option>
                </select>
                <button class="btn btn-outline" id="btnRecarregarPedidos">Recarregar</button>
            </div>
            <div class="toolbar-right">
                <span class="muted" id="pedidosResumo"></span>
            </div>
        </div>

        <div class="card">
            <div class="card-header-simple">
                <h3>Lista de Pedidos</h3>
            </div>
            <div class="card-body-simple" id="pedidosBody">
                <div class="muted">Carregando...</div>
            </div>
        </div>
    `);

    const filtroStatus = qs('#filtroStatus');
    const filtroTipo = qs('#filtroTipo');
    if (filtroStatus) filtroStatus.value = statusAtual;
    if (filtroTipo) filtroTipo.value = tipoAtual;

    async function carregar() {
        const status = qs('#filtroStatus')?.value || 'todos';
        const tipo = qs('#filtroTipo')?.value || 'todos';
        container.dataset.status = status;
        container.dataset.tipo = tipo;

        try {
            const pedidos = await ensurePedidos({ force, filtros: { status, tipo } });
            setText(qs('#pedidosResumo'), `${pedidos.length} pedido(s)`);

            if (pedidos.length === 0) {
                setHtml(qs('#pedidosBody'), `<div class="muted">Nenhum pedido encontrado.</div>`);
                return;
            }

            const rows = pedidos.map((p) => {
                return `
                    <tr>
                        <td>#${p.id}</td>
                        <td>${escapeHtml(formatDateTime(p.created_at))}</td>
                        <td>
                            <div><strong>${escapeHtml(p.cliente_nome || '-')}</strong></div>
                            <div class="muted">${escapeHtml(p.cliente_telefone || '')}</div>
                        </td>
                        <td>${escapeHtml(p.tipo || '')}</td>
                        <td>${escapeHtml(formatPagamento(p))}</td>
                        <td>${badgeStatus(p.status)}</td>
                        <td>${formatCurrency(p.total)}</td>
                        <td>
                            <select class="select" data-action="status" data-id="${p.id}">
                                <option value="pendente" ${p.status === 'pendente' ? 'selected' : ''}>pendente</option>
                                <option value="preparando" ${p.status === 'preparando' ? 'selected' : ''}>preparando</option>
                                <option value="pronto" ${p.status === 'pronto' ? 'selected' : ''}>pronto</option>
                                <option value="entregue" ${p.status === 'entregue' ? 'selected' : ''}>entregue</option>
                                <option value="cancelado" ${p.status === 'cancelado' ? 'selected' : ''}>cancelado</option>
                            </select>
                            <button class="btn btn-outline" data-action="ver" data-id="${p.id}">Ver</button>
                        </td>
                    </tr>
                `;
            }).join('');

            setHtml(qs('#pedidosBody'), `
                <div style="overflow:auto">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Pedido</th>
                                <th>Data</th>
                                <th>Cliente</th>
                                <th>Tipo</th>
                                <th>Pagamento</th>
                                <th>Status</th>
                                <th>Total</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `);

            qsa('[data-action="status"]').forEach((sel) => {
                sel.addEventListener('change', async () => {
                    const id = sel.dataset.id;
                    const newStatus = sel.value;
                    sel.disabled = true;
                    try {
                        await atualizarStatusPedido(id, newStatus);
                        await carregar();
                    } catch (err) {
                        alert(err.message || 'Erro ao atualizar status');
                    } finally {
                        sel.disabled = false;
                    }
                });
            });

            qsa('[data-action="ver"]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const id = Number(btn.dataset.id);
                    const pedido = pedidos.find((x) => x.id === id);
                    if (!pedido) return;
                    abrirModalPedido(pedido, carregar);
                });
            });
        } catch (err) {
            setHtml(qs('#pedidosBody'), `<div class="muted">${escapeHtml(err.message || 'Erro ao carregar pedidos')}</div>`);
        }
    }

    qs('#btnRecarregarPedidos')?.addEventListener('click', () => carregar());
    qs('#filtroStatus')?.addEventListener('change', () => carregar());
    qs('#filtroTipo')?.addEventListener('change', () => carregar());

    await carregar();
}

function abrirModalPedido(pedido, onUpdated) {
    abrirModal({
        titulo: `Pedido #${pedido.id}`,
        bodyHtml: `
            <div class="grid-2">
                <div class="card">
                    <div class="card-header-simple"><h3>Resumo</h3></div>
                    <div class="card-body-simple">
                        <div><strong>Cliente:</strong> ${escapeHtml(pedido.cliente_nome || '-')}</div>
                        <div><strong>Telefone:</strong> ${escapeHtml(pedido.cliente_telefone || '-')}</div>
                        <div><strong>Endereço:</strong> ${escapeHtml(pedido.cliente_endereco || '-')}</div>
                        <div><strong>Tipo:</strong> ${escapeHtml(pedido.tipo || '-')}</div>
                        <div><strong>Pagamento:</strong> ${escapeHtml(formatPagamento(pedido))}</div>
                        <div><strong>Status:</strong> ${badgeStatus(pedido.status)}</div>
                        <div><strong>Total:</strong> ${formatCurrency(pedido.total)}</div>
                        <div><strong>Data:</strong> ${escapeHtml(formatDateTime(pedido.created_at))}</div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header-simple"><h3>Itens</h3></div>
                    <div class="card-body-simple">
                        ${renderItensPedidoHtml(pedido.itens)}
                    </div>
                </div>
            </div>
        `,
        footerHtml: `
            <select class="select" id="modalStatus">
                <option value="pendente" ${pedido.status === 'pendente' ? 'selected' : ''}>pendente</option>
                <option value="preparando" ${pedido.status === 'preparando' ? 'selected' : ''}>preparando</option>
                <option value="pronto" ${pedido.status === 'pronto' ? 'selected' : ''}>pronto</option>
                <option value="entregue" ${pedido.status === 'entregue' ? 'selected' : ''}>entregue</option>
                <option value="cancelado" ${pedido.status === 'cancelado' ? 'selected' : ''}>cancelado</option>
            </select>
            <button class="btn btn-outline" id="btnFecharPedido">Fechar</button>
            <button class="btn btn-primary-solid" id="btnSalvarStatusPedido">Salvar</button>
        `,
        onMount: () => {
            qs('#btnFecharPedido')?.addEventListener('click', fecharModal);
            qs('#btnSalvarStatusPedido')?.addEventListener('click', async () => {
                const status = qs('#modalStatus')?.value;
                try {
                    await atualizarStatusPedido(pedido.id, status);
                    fecharModal();
                    if (typeof onUpdated === 'function') await onUpdated();
                } catch (err) {
                    alert(err.message || 'Erro ao atualizar status');
                }
            });
        }
    });
}

async function renderClientes({ force }) {
    const container = qs('#section-clientes');
    if (!container) return;
    setHtml(container, `
        <div class="section-toolbar">
            <div class="toolbar-left">
                <button class="btn btn-outline" id="btnRecarregarClientes">Recarregar</button>
            </div>
            <div class="toolbar-right">
                <span class="muted" id="clientesResumo"></span>
            </div>
        </div>
        <div class="card">
            <div class="card-header-simple">
                <h3>Base de Clientes</h3>
            </div>
            <div class="card-body-simple" id="clientesBody">
                <div class="muted">Carregando...</div>
            </div>
        </div>
    `);

    async function carregar() {
        try {
            const clientes = await ensureClientes({ force });
            setText(qs('#clientesResumo'), `${clientes.length} cliente(s)`);
            if (clientes.length === 0) {
                setHtml(qs('#clientesBody'), `<div class="muted">Nenhum cliente encontrado.</div>`);
                return;
            }
            const rows = clientes.map((c) => `
                <tr>
                    <td>${escapeHtml(c.nome || '-')}</td>
                    <td>${escapeHtml(c.telefone || '-')}</td>
                    <td>${escapeHtml(c.endereco || '-')}</td>
                    <td>${escapeHtml(c.email || '-')}</td>
                    <td>${escapeHtml(formatDateTime(c.created_at))}</td>
                </tr>
            `).join('');

            setHtml(qs('#clientesBody'), `
                <div style="overflow:auto">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Nome</th>
                                <th>Telefone</th>
                                <th>Endereço</th>
                                <th>Email</th>
                                <th>Criado em</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `);
        } catch (err) {
            setHtml(qs('#clientesBody'), `<div class="muted">${escapeHtml(err.message || 'Erro ao carregar clientes')}</div>`);
        }
    }

    qs('#btnRecarregarClientes')?.addEventListener('click', () => carregar());
    await carregar();
}

async function salvarProduto(payload, produtoId) {
    if (produtoId) return apiFetch(`/admin/produtos/${produtoId}`, { method: 'PUT', body: payload });
    return apiFetch('/admin/produtos', { method: 'POST', body: payload });
}

async function deletarProduto(produtoId) {
    return apiFetch(`/admin/produtos/${produtoId}`, { method: 'DELETE' });
}

function abrirModalProduto({ produto, categorias, onSaved }) {
    const isEdit = !!produto;
    const catOptions = categorias.map((c) => `<option value="${c.id}" ${produto?.categoria_id === c.id ? 'selected' : ''}>${escapeHtml(c.nome)}</option>`).join('');
    abrirModal({
        titulo: isEdit ? 'Editar Produto' : 'Novo Produto',
        bodyHtml: `
            <form id="formProduto">
                <div class="two-cols">
                    <div class="form-group">
                        <label>Nome *</label>
                        <input class="input" type="text" id="produtoNome" value="${escapeHtml(produto?.nome || '')}" required>
                    </div>
                    <div class="form-group">
                        <label>Categoria *</label>
                        <select class="select" id="produtoCategoria" required>
                            ${catOptions}
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label>Descrição</label>
                    <textarea class="input" id="produtoDescricao" rows="3">${escapeHtml(produto?.descricao || '')}</textarea>
                </div>
                <div class="two-cols">
                    <div class="form-group">
                        <label>Preço *</label>
                        <input class="input" type="number" step="0.01" id="produtoPreco" value="${produto?.preco ?? ''}" required>
                    </div>
                    <div class="form-group">
                        <label>Disponível</label>
                        <select class="select" id="produtoDisponivel">
                            <option value="1" ${produto?.disponivel === 1 || produto?.disponivel === undefined ? 'selected' : ''}>Sim</option>
                            <option value="0" ${produto?.disponivel === 0 ? 'selected' : ''}>Não</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label>Imagem (URL)</label>
                    <input class="input" type="url" id="produtoImagem" value="${escapeHtml(produto?.imagem || '')}">
                </div>
                <div class="form-group">
                    <label>Imagem (Arquivo do PC)</label>
                    <input class="input" type="file" id="produtoImagemArquivo" accept="image/*">
                    <div class="muted">Ao selecionar um arquivo, ele vira um link interno (data URL).</div>
                </div>
            </form>
        `,
        footerHtml: `
            <button class="btn btn-outline" id="btnCancelarProduto">Cancelar</button>
            <button class="btn btn-primary-solid" id="btnSalvarProduto">${isEdit ? 'Salvar' : 'Criar'}</button>
        `,
        onMount: () => {
            qs('#btnCancelarProduto')?.addEventListener('click', fecharModal);
            qs('#produtoImagemArquivo')?.addEventListener('change', async (e) => {
                await handleImageFileInput({
                    inputEl: e.target,
                    targetInputSelector: '#produtoImagem',
                    maxBytes: 2 * 1024 * 1024
                });
            });
            qs('#btnSalvarProduto')?.addEventListener('click', async () => {
                const nome = qs('#produtoNome')?.value?.trim();
                const categoria_id = Number(qs('#produtoCategoria')?.value);
                const descricao = qs('#produtoDescricao')?.value ?? '';
                const preco = Number(qs('#produtoPreco')?.value);
                const imagem = qs('#produtoImagem')?.value?.trim() || null;
                const disponivel = Number(qs('#produtoDisponivel')?.value ?? 1);

                if (!nome || !categoria_id || Number.isNaN(preco)) {
                    alert('Preencha nome, categoria e preço.');
                    return;
                }

                const payload = { nome, categoria_id, descricao, preco, imagem, disponivel };
                try {
                    await salvarProduto(payload, produto?.id);
                    fecharModal();
                    if (typeof onSaved === 'function') await onSaved();
                } catch (err) {
                    alert(err.message || 'Erro ao salvar produto');
                }
            });
        }
    });
}

async function renderProdutos({ force }) {
    const container = qs('#section-produtos');
    if (!container) return;

    setHtml(container, `
        <div class="section-toolbar">
            <div class="toolbar-left">
                <input class="input" id="buscaProdutos" placeholder="Buscar produto..." />
                <button class="btn btn-outline" id="btnRecarregarProdutos">Recarregar</button>
            </div>
            <div class="toolbar-right">
                <button class="btn btn-outline" id="btnAbrirAdicionais">Adicionais</button>
                <button class="btn btn-primary-solid" id="btnNovoProduto">Novo Produto</button>
            </div>
        </div>
        <div class="card">
            <div class="card-header-simple">
                <h3>Produtos</h3>
                <span class="muted" id="produtosResumo"></span>
            </div>
            <div class="card-body-simple" id="produtosBody">
                <div class="muted">Carregando...</div>
            </div>
        </div>
    `);

    async function carregar({ forcar }) {
        try {
            const [categorias, produtos] = await Promise.all([
                ensureCategorias({ force: forcar }),
                ensureProdutos({ force: forcar })
            ]);

            const termo = (qs('#buscaProdutos')?.value || '').trim().toLowerCase();
            const filtrados = termo
                ? produtos.filter((p) => String(p.nome || '').toLowerCase().includes(termo))
                : produtos;

            setText(qs('#produtosResumo'), `${filtrados.length} produto(s)`);

            if (filtrados.length === 0) {
                setHtml(qs('#produtosBody'), `<div class="muted">Nenhum produto encontrado.</div>`);
                return;
            }

            const catMap = new Map(categorias.map((c) => [c.id, c.nome]));
            const rows = filtrados.map((p) => `
                <tr>
                    <td><strong>${escapeHtml(p.nome || '')}</strong><div class="muted">${escapeHtml(p.descricao || '')}</div></td>
                    <td>${escapeHtml(p.categoria_nome || catMap.get(p.categoria_id) || '-')}</td>
                    <td>${formatCurrency(p.preco)}</td>
                    <td>
                        <label class="switch">
                            <input type="checkbox" data-action="toggle-produto" data-id="${p.id}" ${p.disponivel === 1 ? 'checked' : ''}>
                            <span class="switch-label">${p.disponivel === 1 ? 'Ativo' : 'Inativo'}</span>
                        </label>
                    </td>
                    <td>
                        <button class="btn btn-outline" data-action="editar-produto" data-id="${p.id}">Editar</button>
                        <button class="btn btn-outline" data-action="deletar-produto" data-id="${p.id}">Excluir</button>
                    </td>
                </tr>
            `).join('');

            setHtml(qs('#produtosBody'), `
                <div style="overflow:auto">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Produto</th>
                                <th>Categoria</th>
                                <th>Preço</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `);

            qsa('[data-action="editar-produto"]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const id = Number(btn.dataset.id);
                    const produto = produtos.find((x) => x.id === id);
                    abrirModalProduto({ produto, categorias, onSaved: async () => carregar({ forcar: true }) });
                });
            });

            qsa('[data-action="deletar-produto"]').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    const id = Number(btn.dataset.id);
                    const ok = window.confirm('Excluir este produto?');
                    if (!ok) return;
                    try {
                        await deletarProduto(id);
                        await carregar({ forcar: true });
                    } catch (err) {
                        alert(err.message || 'Erro ao excluir produto');
                    }
                });
            });

            qsa('[data-action="toggle-produto"]').forEach((chk) => {
                chk.addEventListener('change', async () => {
                    const id = Number(chk.dataset.id);
                    const produto = produtos.find((x) => x.id === id);
                    if (!produto) return;
                    const payload = {
                        categoria_id: produto.categoria_id,
                        nome: produto.nome,
                        descricao: produto.descricao,
                        preco: produto.preco,
                        imagem: produto.imagem,
                        disponivel: chk.checked ? 1 : 0,
                        id_externo: produto.id_externo || null
                    };
                    chk.disabled = true;
                    try {
                        await salvarProduto(payload, id);
                        await carregar({ forcar: true });
                    } catch (err) {
                        chk.checked = !chk.checked;
                        alert(err.message || 'Erro ao atualizar produto');
                    } finally {
                        chk.disabled = false;
                    }
                });
            });
        } catch (err) {
            setHtml(qs('#produtosBody'), `<div class="muted">${escapeHtml(err.message || 'Erro ao carregar produtos')}</div>`);
        }
    }

    qs('#btnRecarregarProdutos')?.addEventListener('click', () => carregar({ forcar: true }));
    qs('#buscaProdutos')?.addEventListener('input', () => carregar({ forcar: false }));
    qs('#btnNovoProduto')?.addEventListener('click', async () => {
        const categorias = await ensureCategorias({ force: false });
        if (!categorias.length) {
            alert('Crie uma categoria primeiro.');
            return;
        }
        abrirModalProduto({ produto: null, categorias, onSaved: async () => carregar({ forcar: true }) });
    });
    qs('#btnAbrirAdicionais')?.addEventListener('click', () => navegarPara('adicionais'));

    await carregar({ forcar: force });
}

async function salvarAdicional(payload, adicionalId) {
    if (adicionalId) return apiFetch(`/admin/adicionais/${adicionalId}`, { method: 'PUT', body: payload });
    return apiFetch('/admin/adicionais', { method: 'POST', body: payload });
}

async function deletarAdicional(adicionalId) {
    return apiFetch(`/admin/adicionais/${adicionalId}`, { method: 'DELETE' });
}

function abrirModalAdicional({ adicional, categorias, produtos, onSaved }) {
    const isEdit = !!adicional;
    const catOptions = [
        `<option value="">Nenhuma</option>`,
        ...categorias.map((c) => `<option value="${c.id}" ${adicional?.categoria_id === c.id ? 'selected' : ''}>${escapeHtml(c.nome)}</option>`)
    ].join('');
    const prodOptions = [
        `<option value="">Nenhum</option>`,
        ...produtos.map((p) => `<option value="${p.id}" ${adicional?.produto_id === p.id ? 'selected' : ''}>${escapeHtml(p.nome)}</option>`)
    ].join('');

    abrirModal({
        titulo: isEdit ? 'Editar Adicional' : 'Novo Adicional',
        bodyHtml: `
            <form id="formAdicional">
                <div class="two-cols">
                    <div class="form-group">
                        <label>Nome *</label>
                        <input class="input" type="text" id="adNome" value="${escapeHtml(adicional?.nome || '')}" required>
                    </div>
                    <div class="form-group">
                        <label>Preço</label>
                        <input class="input" type="number" step="0.01" id="adPreco" value="${adicional?.preco ?? 0}">
                    </div>
                </div>
                <div class="two-cols">
                    <div class="form-group">
                        <label>Categoria</label>
                        <select class="select" id="adCategoria">${catOptions}</select>
                    </div>
                    <div class="form-group">
                        <label>Produto</label>
                        <select class="select" id="adProduto">${prodOptions}</select>
                    </div>
                </div>
                <div class="form-group">
                    <label>Disponível</label>
                    <select class="select" id="adDisponivel">
                        <option value="1" ${adicional?.disponivel === 1 || adicional?.disponivel === undefined ? 'selected' : ''}>Sim</option>
                        <option value="0" ${adicional?.disponivel === 0 ? 'selected' : ''}>Não</option>
                    </select>
                </div>
            </form>
        `,
        footerHtml: `
            <button class="btn btn-outline" id="btnCancelarAd">Cancelar</button>
            <button class="btn btn-primary-solid" id="btnSalvarAd">${isEdit ? 'Salvar' : 'Criar'}</button>
        `,
        onMount: () => {
            qs('#btnCancelarAd')?.addEventListener('click', fecharModal);
            qs('#btnSalvarAd')?.addEventListener('click', async () => {
                const nome = qs('#adNome')?.value?.trim();
                const preco = Number(qs('#adPreco')?.value ?? 0);
                const categoria_id = qs('#adCategoria')?.value ? Number(qs('#adCategoria').value) : null;
                const produto_id = qs('#adProduto')?.value ? Number(qs('#adProduto').value) : null;
                const disponivel = Number(qs('#adDisponivel')?.value ?? 1);
                if (!nome) {
                    alert('Informe o nome.');
                    return;
                }
                const payload = { nome, preco, categoria_id, produto_id, disponivel };
                try {
                    await salvarAdicional(payload, adicional?.id);
                    fecharModal();
                    if (typeof onSaved === 'function') await onSaved();
                } catch (err) {
                    alert(err.message || 'Erro ao salvar adicional');
                }
            });
        }
    });
}

async function renderAdicionais({ force }) {
    const container = qs('#section-adicionais');
    if (!container) return;

    setHtml(container, `
        <div class="section-toolbar">
            <div class="toolbar-left">
                <input class="input" id="buscaAdicionais" placeholder="Buscar adicional..." />
                <button class="btn btn-outline" id="btnRecarregarAdicionais">Recarregar</button>
            </div>
            <div class="toolbar-right">
                <button class="btn btn-outline" id="btnVoltarProdutos">Voltar Produtos</button>
                <button class="btn btn-primary-solid" id="btnNovoAdicional">Novo Adicional</button>
            </div>
        </div>
        <div class="card">
            <div class="card-header-simple">
                <h3>Adicionais</h3>
                <span class="muted" id="adResumo"></span>
            </div>
            <div class="card-body-simple" id="adBody">
                <div class="muted">Carregando...</div>
            </div>
        </div>
    `);

    async function carregar({ forcar }) {
        try {
            const [categorias, produtos, adicionais] = await Promise.all([
                ensureCategorias({ force: forcar }),
                ensureProdutos({ force: forcar }),
                ensureAdicionais({ force: forcar })
            ]);

            const termo = (qs('#buscaAdicionais')?.value || '').trim().toLowerCase();
            const filtrados = termo
                ? adicionais.filter((a) => String(a.nome || '').toLowerCase().includes(termo))
                : adicionais;

            setText(qs('#adResumo'), `${filtrados.length} adicional(is)`);

            const prodMap = new Map(produtos.map((p) => [p.id, p.nome]));
            const catMap = new Map(categorias.map((c) => [c.id, c.nome]));

            if (filtrados.length === 0) {
                setHtml(qs('#adBody'), `<div class="muted">Nenhum adicional encontrado.</div>`);
                return;
            }

            const rows = filtrados.map((a) => `
                <tr>
                    <td><strong>${escapeHtml(a.nome || '')}</strong></td>
                    <td>${formatCurrency(a.preco)}</td>
                    <td>${escapeHtml(a.categoria_nome || (a.categoria_id ? catMap.get(a.categoria_id) : '-') || '-')}</td>
                    <td>${escapeHtml(a.produto_id ? (prodMap.get(a.produto_id) || '-') : '-')}</td>
                    <td>${a.disponivel === 1 ? '<span class="badge badge-entregue">ativo</span>' : '<span class="badge badge-cancelado">inativo</span>'}</td>
                    <td>
                        <button class="btn btn-outline" data-action="editar-ad" data-id="${a.id}">Editar</button>
                        <button class="btn btn-outline" data-action="deletar-ad" data-id="${a.id}">Excluir</button>
                    </td>
                </tr>
            `).join('');

            setHtml(qs('#adBody'), `
                <div style="overflow:auto">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Nome</th>
                                <th>Preço</th>
                                <th>Categoria</th>
                                <th>Produto</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `);

            qsa('[data-action="editar-ad"]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const id = Number(btn.dataset.id);
                    const adicional = adicionais.find((x) => x.id === id);
                    abrirModalAdicional({ adicional, categorias, produtos, onSaved: async () => carregar({ forcar: true }) });
                });
            });

            qsa('[data-action="deletar-ad"]').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    const id = Number(btn.dataset.id);
                    const ok = window.confirm('Excluir este adicional?');
                    if (!ok) return;
                    try {
                        await deletarAdicional(id);
                        await carregar({ forcar: true });
                    } catch (err) {
                        alert(err.message || 'Erro ao excluir adicional');
                    }
                });
            });

            qs('#btnNovoAdicional')?.addEventListener('click', () => {
                abrirModalAdicional({ adicional: null, categorias, produtos, onSaved: async () => carregar({ forcar: true }) });
            });
        } catch (err) {
            setHtml(qs('#adBody'), `<div class="muted">${escapeHtml(err.message || 'Erro ao carregar adicionais')}</div>`);
        }
    }

    qs('#btnRecarregarAdicionais')?.addEventListener('click', () => carregar({ forcar: true }));
    qs('#buscaAdicionais')?.addEventListener('input', () => carregar({ forcar: false }));
    qs('#btnVoltarProdutos')?.addEventListener('click', () => navegarPara('produtos'));

    await carregar({ forcar: force });
}

async function criarCategoria(payload) {
    return apiFetch('/admin/categorias', { method: 'POST', body: payload });
}

async function deletarCategoria(categoriaId) {
    return apiFetch(`/admin/categorias/${categoriaId}`, { method: 'DELETE' });
}

async function renderCategorias({ force }) {
    const container = qs('#section-categorias');
    if (!container) return;

    setHtml(container, `
        <div class="section-toolbar">
            <div class="toolbar-left">
                <input class="input" id="catNome" placeholder="Nome da categoria" />
                <input class="input" id="catOrdem" type="number" placeholder="Ordem" style="width:120px" />
                <button class="btn btn-primary-solid" id="btnCriarCategoria">Adicionar</button>
                <button class="btn btn-outline" id="btnRecarregarCategorias">Recarregar</button>
            </div>
            <div class="toolbar-right">
                <span class="muted" id="catResumo"></span>
            </div>
        </div>
        <div class="card">
            <div class="card-header-simple"><h3>Categorias</h3></div>
            <div class="card-body-simple" id="catBody"><div class="muted">Carregando...</div></div>
        </div>
    `);

    async function carregar({ forcar }) {
        try {
            const categorias = await ensureCategorias({ force: forcar });
            setText(qs('#catResumo'), `${categorias.length} categoria(s)`);
            if (!categorias.length) {
                setHtml(qs('#catBody'), `<div class="muted">Nenhuma categoria encontrada.</div>`);
                return;
            }
            const rows = categorias.map((c) => `
                <tr>
                    <td><strong>${escapeHtml(c.nome || '')}</strong></td>
                    <td>${c.ordem ?? 0}</td>
                    <td>
                        <button class="btn btn-outline" data-action="del-cat" data-id="${c.id}">Excluir</button>
                    </td>
                </tr>
            `).join('');

            setHtml(qs('#catBody'), `
                <div style="overflow:auto">
                    <table class="table">
                        <thead><tr><th>Nome</th><th>Ordem</th><th>Ações</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `);

            qsa('[data-action="del-cat"]').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    const id = Number(btn.dataset.id);
                    const ok = window.confirm('Excluir esta categoria?');
                    if (!ok) return;
                    try {
                        await deletarCategoria(id);
                        state.cache.categorias = null;
                        await carregar({ forcar: true });
                    } catch (err) {
                        alert(err.message || 'Erro ao excluir categoria');
                    }
                });
            });
        } catch (err) {
            setHtml(qs('#catBody'), `<div class="muted">${escapeHtml(err.message || 'Erro ao carregar categorias')}</div>`);
        }
    }

    qs('#btnRecarregarCategorias')?.addEventListener('click', () => carregar({ forcar: true }));
    qs('#btnCriarCategoria')?.addEventListener('click', async () => {
        const nome = qs('#catNome')?.value?.trim();
        const ordem = Number(qs('#catOrdem')?.value ?? 0);
        if (!nome) {
            alert('Informe o nome da categoria.');
            return;
        }
        try {
            await criarCategoria({ nome, ordem });
            qs('#catNome').value = '';
            qs('#catOrdem').value = '';
            state.cache.categorias = null;
            await carregar({ forcar: true });
        } catch (err) {
            alert(err.message || 'Erro ao criar categoria');
        }
    });

    await carregar({ forcar: force });
}

async function renderFinanceiro({ force }) {
    const container = qs('#section-financeiro');
    if (!container) return;

    const periodo = getPeriodo();
    setHtml(container, `
        <div class="section-toolbar">
            <div class="toolbar-left">
                <button class="btn btn-outline" id="btnRecarregarFinanceiro">Recarregar</button>
            </div>
            <div class="toolbar-right">
                <button class="btn btn-primary-solid" id="btnNovaDespesa">Nova Despesa</button>
            </div>
        </div>
        <div class="grid-2">
            <div class="card">
                <div class="card-header-simple"><h3>Resumo</h3></div>
                <div class="card-body-simple" id="financeiroResumo">
                    <div class="muted">Carregando...</div>
                </div>
            </div>
            <div class="card">
                <div class="card-header-simple"><h3>Despesas</h3></div>
                <div class="card-body-simple" id="despesasBody">
                    <div class="muted">Carregando...</div>
                </div>
            </div>
        </div>
    `);

    async function carregar({ forcar }) {
        const params = new URLSearchParams();
        if (periodo?.inicio && periodo?.fim) {
            params.set('dataInicio', periodo.inicio);
            params.set('dataFim', periodo.fim);
        }
        const query = params.toString() ? `?${params.toString()}` : '';

        try {
            const [financeiro, despesas] = await Promise.all([
                apiFetch(`/admin/financeiro${query}`),
                ensureDespesas({ force: forcar, filtros: { inicio: periodo?.inicio, fim: periodo?.fim } })
            ]);

            const vendas = Number(financeiro?.vendas || 0);
            const totalDespesas = Number(financeiro?.despesas || 0);
            const lucro = Number(financeiro?.lucro || 0);
            const totalPedidos = Number(financeiro?.totalPedidos || 0);

            setHtml(qs('#financeiroResumo'), `
                <div><strong>Vendas:</strong> ${formatCurrency(vendas)}</div>
                <div><strong>Despesas:</strong> ${formatCurrency(totalDespesas)}</div>
                <div><strong>Lucro:</strong> ${formatCurrency(lucro)}</div>
                <div><strong>Pedidos:</strong> ${escapeHtml(String(totalPedidos))}</div>
            `);

            if (!despesas.length) {
                setHtml(qs('#despesasBody'), `<div class="muted">Nenhuma despesa no período.</div>`);
                return;
            }

            const rows = despesas.map((d) => `
                <tr>
                    <td>${escapeHtml(d.descricao || '')}</td>
                    <td>${escapeHtml(d.categoria || '')}</td>
                    <td>${escapeHtml(d.data || '')}</td>
                    <td>${formatCurrency(d.valor)}</td>
                    <td>
                        <button class="btn btn-outline" data-action="edit-despesa" data-id="${d.id}">Editar</button>
                        <button class="btn btn-outline" data-action="del-despesa" data-id="${d.id}">Excluir</button>
                    </td>
                </tr>
            `).join('');

            setHtml(qs('#despesasBody'), `
                <div style="overflow:auto">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Descrição</th>
                                <th>Categoria</th>
                                <th>Data</th>
                                <th>Valor</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `);

            qsa('[data-action="edit-despesa"]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const id = Number(btn.dataset.id);
                    const despesa = despesas.find((x) => x.id === id);
                    abrirModalDespesa({ despesa, onSaved: async () => carregar({ forcar: true }) });
                });
            });

            qsa('[data-action="del-despesa"]').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    const id = Number(btn.dataset.id);
                    const ok = window.confirm('Excluir esta despesa?');
                    if (!ok) return;
                    try {
                        await apiFetch(`/admin/despesas/${id}`, { method: 'DELETE' });
                        await carregar({ forcar: true });
                    } catch (err) {
                        alert(err.message || 'Erro ao excluir despesa');
                    }
                });
            });
        } catch (err) {
            setHtml(qs('#financeiroResumo'), `<div class="muted">${escapeHtml(err.message || 'Erro ao carregar resumo')}</div>`);
            setHtml(qs('#despesasBody'), `<div class="muted">${escapeHtml(err.message || 'Erro ao carregar despesas')}</div>`);
        }
    }

    qs('#btnRecarregarFinanceiro')?.addEventListener('click', () => carregar({ forcar: true }));
    qs('#btnNovaDespesa')?.addEventListener('click', () => abrirModalDespesa({ despesa: null, onSaved: async () => carregar({ forcar: true }) }));

    await carregar({ forcar: force });
}

function abrirModalDespesa({ despesa, onSaved }) {
    const isEdit = !!despesa;
    abrirModal({
        titulo: isEdit ? 'Editar Despesa' : 'Nova Despesa',
        bodyHtml: `
            <form id="formDespesa">
                <div class="two-cols">
                    <div class="form-group">
                        <label>Descrição *</label>
                        <input class="input" id="despDescricao" value="${escapeHtml(despesa?.descricao || '')}" required>
                    </div>
                    <div class="form-group">
                        <label>Categoria *</label>
                        <input class="input" id="despCategoria" value="${escapeHtml(despesa?.categoria || '')}" required>
                    </div>
                </div>
                <div class="two-cols">
                    <div class="form-group">
                        <label>Data *</label>
                        <input class="input" type="date" id="despData" value="${escapeHtml(despesa?.data || todayISO())}" required>
                    </div>
                    <div class="form-group">
                        <label>Valor *</label>
                        <input class="input" type="number" step="0.01" id="despValor" value="${despesa?.valor ?? ''}" required>
                    </div>
                </div>
                <div class="form-group">
                    <label>Observações</label>
                    <textarea class="input" id="despObs" rows="3">${escapeHtml(despesa?.observacoes || '')}</textarea>
                </div>
            </form>
        `,
        footerHtml: `
            <button class="btn btn-outline" id="btnCancelarDespesa">Cancelar</button>
            <button class="btn btn-primary-solid" id="btnSalvarDespesa">${isEdit ? 'Salvar' : 'Criar'}</button>
        `,
        onMount: () => {
            qs('#btnCancelarDespesa')?.addEventListener('click', fecharModal);
            qs('#btnSalvarDespesa')?.addEventListener('click', async () => {
                const descricao = qs('#despDescricao')?.value?.trim();
                const categoria = qs('#despCategoria')?.value?.trim();
                const data = qs('#despData')?.value?.trim();
                const valor = Number(qs('#despValor')?.value);
                const observacoes = qs('#despObs')?.value ?? '';

                if (!descricao || !categoria || !data || Number.isNaN(valor)) {
                    alert('Preencha descrição, categoria, data e valor.');
                    return;
                }

                const payload = { descricao, categoria, data, valor, observacoes };
                try {
                    if (despesa?.id) {
                        await apiFetch(`/admin/despesas/${despesa.id}`, { method: 'PUT', body: payload });
                    } else {
                        await apiFetch('/admin/despesas', { method: 'POST', body: payload });
                    }
                    fecharModal();
                    if (typeof onSaved === 'function') await onSaved();
                } catch (err) {
                    alert(err.message || 'Erro ao salvar despesa');
                }
            });
        }
    });
}

async function renderConfiguracoes({ force }) {
    const container = qs('#section-configuracoes');
    if (!container) return;

    setHtml(container, `
        <div class="card">
            <div class="card-header-simple">
                <h3>Configurações da Loja</h3>
                <button class="btn btn-primary-solid" id="btnSalvarConfig">Salvar</button>
            </div>
            <div class="card-body-simple" id="configBody">
                <div class="muted">Carregando...</div>
            </div>
        </div>
    `);

    try {
        const cfg = await ensureConfiguracoes({ force });

        setHtml(qs('#configBody'), `
            <div class="grid-2">
                <div>
                    <div class="form-group">
                        <label>URL da Loja (Slug)</label>
                        <input class="input" type="text" id="cfgSlug" value="${escapeHtml(admin?.slug || '')}">
                        <div class="muted">A página de pedidos fica em: /{slug}</div>
                    </div>
                    <div class="form-group">
                        <label>Cor Primária</label>
                        <input class="input" type="text" id="cfgCorPrimaria" value="${escapeHtml(cfg.cor_primaria || '#333333')}">
                    </div>
                    <div class="form-group">
                        <label>Cor Secundária</label>
                        <input class="input" type="text" id="cfgCorSecundaria" value="${escapeHtml(cfg.cor_secundaria || '#666666')}">
                    </div>
                    <div class="form-group">
                        <label>Logo (URL)</label>
                        <input class="input" type="url" id="cfgLogo" value="${escapeHtml(cfg.logo_url || '')}">
                    </div>
                    <div class="form-group">
                        <label>Logo (Arquivo do PC)</label>
                        <input class="input" type="file" id="cfgLogoArquivo" accept="image/*">
                    </div>
                    <div class="form-group">
                        <label>Banner (URL)</label>
                        <input class="input" type="url" id="cfgBanner" value="${escapeHtml(cfg.banner_url || '')}">
                    </div>
                    <div class="form-group">
                        <label>Banner (Arquivo do PC)</label>
                        <input class="input" type="file" id="cfgBannerArquivo" accept="image/*">
                    </div>
                </div>
                <div>
                    <div class="form-group">
                        <label>Formas de Pagamento</label>
                        <div class="switch">
                            <input type="checkbox" id="cfgAceitaDinheiro" ${cfg.aceita_dinheiro === 0 ? '' : 'checked'}>
                            <span class="switch-label">Dinheiro</span>
                        </div>
                        <div class="switch" style="margin-top:10px">
                            <input type="checkbox" id="cfgAceitaCartao" ${cfg.aceita_cartao === 0 ? '' : 'checked'}>
                            <span class="switch-label">Cartão</span>
                        </div>
                        <div class="switch" style="margin-top:10px">
                            <input type="checkbox" id="cfgAceitaPix" ${cfg.aceita_pix === 1 ? 'checked' : ''}>
                            <span class="switch-label">Pix</span>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Chave Pix</label>
                        <input class="input" type="text" id="cfgPixChave" value="${escapeHtml(cfg.pix_chave || '')}">
                    </div>
                    <div class="form-group">
                        <label>Nome do Pix</label>
                        <input class="input" type="text" id="cfgPixNome" value="${escapeHtml(cfg.pix_nome || '')}">
                    </div>
                    <div class="form-group">
                        <label>Telefone / WhatsApp</label>
                        <input class="input" type="text" id="cfgTelefone" value="${escapeHtml(cfg.telefone_contato || '')}">
                    </div>
                    <div class="form-group">
                        <label>Tempo de Entrega</label>
                        <input class="input" type="text" id="cfgTempo" value="${escapeHtml(cfg.tempo_entrega || '')}">
                    </div>
                    <div class="form-group">
                        <label>Horário de Funcionamento</label>
                        <input class="input" type="text" id="cfgHorario" value="${escapeHtml(cfg.horario_funcionamento || '')}">
                    </div>
                    <div class="form-group">
                        <label>Endereço</label>
                        <input class="input" type="text" id="cfgEndereco" value="${escapeHtml(cfg.endereco_loja || '')}">
                    </div>
                </div>
            </div>
            <div class="form-group">
                <label>Comunicado</label>
                <textarea class="input" id="cfgComunicado" rows="3">${escapeHtml(cfg.comunicado || '')}</textarea>
            </div>
            <div class="form-group">
                <label>Status da Loja</label>
                <label class="switch">
                    <input type="checkbox" id="cfgLojaAberta" ${cfg.loja_aberta === 0 ? '' : 'checked'}>
                    <span class="switch-label" id="cfgLojaAbertaLabel">${cfg.loja_aberta === 0 ? 'Fechada' : 'Aberta'}</span>
                </label>
            </div>
        `);

        qs('#cfgLogoArquivo')?.addEventListener('change', async (e) => {
            await handleImageFileInput({
                inputEl: e.target,
                targetInputSelector: '#cfgLogo',
                maxBytes: 2 * 1024 * 1024
            });
        });

        qs('#cfgBannerArquivo')?.addEventListener('change', async (e) => {
            await handleImageFileInput({
                inputEl: e.target,
                targetInputSelector: '#cfgBanner',
                maxBytes: 3 * 1024 * 1024
            });
        });

        qs('#cfgLojaAberta')?.addEventListener('change', async (e) => {
            const aberta = !!e.target.checked;
            const label = qs('#cfgLojaAbertaLabel');
            if (label) label.textContent = aberta ? 'Aberta' : 'Fechada';
            try {
                await apiFetch('/admin/loja/status', { method: 'PUT', body: { aberta } });
                state.cache.configuracoes = null;
                await ensureConfiguracoes({ force: true });
            } catch (err) {
                e.target.checked = !aberta;
                if (label) label.textContent = !aberta ? 'Aberta' : 'Fechada';
                alert(err.message || 'Erro ao alterar status da loja');
            }
        });

        qs('#btnSalvarConfig')?.addEventListener('click', async () => {
            const novoSlug = qs('#cfgSlug')?.value?.trim() || '';
            if (novoSlug && novoSlug !== (admin?.slug || '')) {
                try {
                    const r = await apiFetch('/admin/loja/slug', { method: 'PUT', body: { slug: novoSlug } });
                    admin = { ...(admin || {}), slug: r.slug };
                    localStorage.setItem('admin', JSON.stringify(admin));
                } catch (err) {
                    alert(err.message || 'Erro ao atualizar slug');
                    return;
                }
            }

            const payload = {
                cor_primaria: qs('#cfgCorPrimaria')?.value?.trim() || '#333333',
                cor_secundaria: qs('#cfgCorSecundaria')?.value?.trim() || '#666666',
                logo_url: qs('#cfgLogo')?.value?.trim() || null,
                banner_url: qs('#cfgBanner')?.value?.trim() || null,
                aceita_dinheiro: qs('#cfgAceitaDinheiro')?.checked ? 1 : 0,
                aceita_cartao: qs('#cfgAceitaCartao')?.checked ? 1 : 0,
                aceita_pix: qs('#cfgAceitaPix')?.checked ? 1 : 0,
                pix_chave: qs('#cfgPixChave')?.value?.trim() || null,
                pix_nome: qs('#cfgPixNome')?.value?.trim() || null,
                tempo_entrega: qs('#cfgTempo')?.value?.trim() || null,
                horario_funcionamento: qs('#cfgHorario')?.value?.trim() || null,
                telefone_contato: qs('#cfgTelefone')?.value?.trim() || null,
                endereco_loja: qs('#cfgEndereco')?.value?.trim() || null,
                comunicado: qs('#cfgComunicado')?.value ?? null
            };
            try {
                await apiFetch('/admin/configuracoes', { method: 'PUT', body: payload });
                state.cache.configuracoes = null;
                await ensureConfiguracoes({ force: true });
                alert('Configurações salvas.');
            } catch (err) {
                alert(err.message || 'Erro ao salvar configurações');
            }
        });
    } catch (err) {
        setHtml(qs('#configBody'), `<div class="muted">${escapeHtml(err.message || 'Erro ao carregar configurações')}</div>`);
    }
}

function renderFidelidade() {
    const container = qs('#section-fidelidade');
    if (!container) return;
    setHtml(container, `
        <div class="card">
            <div class="card-header-simple"><h3>Fidelidade</h3></div>
            <div class="card-body-simple">
                <div class="muted">Em breve.</div>
            </div>
        </div>
    `);
}

async function abrirWhatsappDaLoja() {
    try {
        const cfg = await ensureConfiguracoes({ force: false });
        let numero = String(cfg.telefone_contato || '').replace(/\D/g, '');
        if (!numero) {
            abrirModalInfo('WhatsApp', 'Configure o telefone/WhatsApp nas Configurações.');
            return;
        }
        if (!numero.startsWith('55')) numero = `55${numero}`;
        window.open(`https://wa.me/${numero}`, '_blank');
    } catch {
        abrirModalInfo('WhatsApp', 'Não foi possível abrir o WhatsApp.');
    }
}
