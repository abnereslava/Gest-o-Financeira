import { collection, addDoc, onSnapshot, query, where, doc, deleteDoc, updateDoc, getDocs, setDoc, getDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";

// --- Auth ---
let userIdLogado = null;
let listenersAtivos = [];
const provider = new GoogleAuthProvider();

onAuthStateChanged(window.auth, (user) => {
    if (user) {
        userIdLogado = user.uid;
        document.getElementById('tela-login').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';
        inicializarSincronizacao();
        setTimeout(() => garantirCategoriasInvestimento(user.uid), 2000);
    } else {
        userIdLogado = null;
        document.getElementById('tela-login').style.display = 'flex';
        document.getElementById('app-content').style.display = 'none';
        limparSincronizacao();
    }
});

document.getElementById('btn-login-google').addEventListener('click', () => {
    signInWithPopup(window.auth, provider).catch(error => console.error("Erro no login:", error));
});

document.getElementById('btn-logout').addEventListener('click', () => { signOut(window.auth); });

function limparSincronizacao() {
    listenersAtivos.forEach(unsub => unsub());
    listenersAtivos = [];
    transacoes = []; categorias = []; cartoes = []; entradasFixas = []; saidasFixas = [];
    renderizarLista();
    renderizarListaCategorias();
    renderizarListaCartoes();
    renderizarListaEntradasFixas();
    renderizarListaSaidasFixas();
}

// --- DOM Selectors ---
const btnConfig = document.getElementById('btn-config');
const btnThemeToggle = document.getElementById('btn-theme-toggle');
const modalConfiguracoes = document.getElementById('modal-configuracoes');
const closeBtns = document.querySelectorAll('.close-btn');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const listaTransacoes = document.getElementById('lista-transacoes');
const toggleSimulacao = document.getElementById('toggle-ver-simulacoes');
const filtroCategoria = document.getElementById('filtro-categoria');
const filtroCartao = document.getElementById('filtro-cartao');
const filtroStatus = document.getElementById('filtro-status');
const filtroBusca = document.getElementById('filtro-busca');
const filtroTipo = document.getElementById('filtro-tipo');

const formInline = document.getElementById('form-inline');
const selectCategoria = document.getElementById('in-categoria');
const selectCartao = document.getElementById('in-cartao');
const selectTipo = document.getElementById('in-tipo');

const formCategoria = document.getElementById('form-categoria');
const listaCartoesUI = document.getElementById('lista-cartoes');
const formCartao = document.getElementById('form-cartao');
const formEntradasFixas = document.getElementById('form-entradas-fixas');
const listaEntradasFixasUI = document.getElementById('lista-entradas-fixas');
const formSaidasFixas = document.getElementById('form-saidas-fixas');
const listaSaidasFixasUI = document.getElementById('lista-saidas-fixas');

const btnMesAnterior = document.getElementById('btn-mes-anterior');
const btnMesProximo = document.getElementById('btn-mes-proximo');
const labelMesAtual = document.getElementById('mes-atual-label');
const inputMesPicker = document.getElementById('input-mes-picker');

// --- State ---
let transacoes = [];
let ultimaDataInserida = new Date().toISOString().split('T')[0];
let dataNavegacao = new Date();
const nomesMeses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

let categorias = [];
let cartoes = [];
let entradasFixas = [];
let saidasFixas = [];
let listSortConfig = [{ col: 'data', dir: 'desc' }];

// --- Main Tab Switching ---
document.querySelectorAll('.main-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.main-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tela').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        const target = document.getElementById(btn.dataset.target);
        if (target) target.classList.add('active');

        if (btn.dataset.target === 'tela-ano') {
            if (typeof carregarDadosDoAno === 'function' && typeof userIdLogadoAno !== 'undefined' && userIdLogadoAno) {
                carregarDadosDoAno();
            }
        }
    });
});

// --- Card Expand Toggle ---
window.toggleCard = function(cardId) {
    const card = document.getElementById(cardId);
    if (!card) return;
    card.classList.toggle('expanded');
};


// --- configurarDataPadrao ---
function configurarDataPadrao() {
    const d = document.getElementById('in-data');
    if (d) d.value = new Date().toISOString().split('T')[0];
    const md = document.getElementById('modal-data');
    if (md) md.value = new Date().toISOString().split('T')[0];
}

// --- Sort header ---
document.querySelectorAll('#lista-header .sortable').forEach(span => {
    span.addEventListener('click', () => {
        const col = span.getAttribute('data-sort');
        const existingIndex = listSortConfig.findIndex(s => s.col === col);
        if (existingIndex === 0) {
            const defaultDir = (col === 'data' || col === 'valor') ? 'desc' : 'asc';
            if (listSortConfig[0].dir === defaultDir) listSortConfig[0].dir = defaultDir === 'asc' ? 'desc' : 'asc';
            else listSortConfig.shift();
        } else {
            if (existingIndex > 0) listSortConfig.splice(existingIndex, 1);
            const defaultDir = (col === 'data' || col === 'valor') ? 'desc' : 'asc';
            listSortConfig.unshift({ col: col, dir: defaultDir });
        }
        renderizarLista();
    });
});

// --- Helpers ---
function normalizarStatus(t) {
    if (t.status === 'simulacao' || t.status === 'simulação') return 'simulacao';
    if (t.status) return t.status;
    if (t.simulacao) return 'simulacao';
    if (t.pago) return 'realizada';
    return 'prevista';
}

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor);
}

function atualizarBackgroundPorMes() {
    const mesIdx = dataNavegacao.getMonth();
    const cycleIdx = (mesIdx % 3) + 1;
    document.body.classList.remove('bg-mes-1','bg-mes-2','bg-mes-3');
    document.body.classList.add(`bg-mes-${cycleIdx}`);
}

function toggleTheme() {
    if (!btnThemeToggle) return;
    const isLight = document.documentElement.toggleAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', isLight ? '' : 'light');
    const nowLight = document.documentElement.getAttribute('data-theme') === 'light';
    if (nowLight) {
        document.documentElement.setAttribute('data-theme', 'light');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
    // simple toggle
    const current = document.documentElement.getAttribute('data-theme');
    localStorage.setItem('theme', current || 'dark');
    btnThemeToggle.innerHTML = (current === 'light') ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
}

// Theme toggle with proper class approach
btnThemeToggle.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light-mode');
    document.documentElement.setAttribute('data-theme', isLight ? 'light' : '');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    btnThemeToggle.innerHTML = isLight ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
});

if (localStorage.getItem('theme') === 'light') {
    document.body.classList.add('light-mode');
    document.documentElement.setAttribute('data-theme', 'light');
    if (btnThemeToggle) btnThemeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
}

if (localStorage.getItem('verSimulacoes') === 'true') {
    if (toggleSimulacao) toggleSimulacao.checked = true;
} else {
    if (toggleSimulacao) toggleSimulacao.checked = false;
}

function atualizarCorTipo() {
    if (!selectTipo) return;
    if (selectTipo.value === 'entrada') {
        selectTipo.style.color = 'var(--success)';
        selectTipo.style.borderColor = 'var(--success)';
    } else {
        selectTipo.style.color = 'var(--danger)';
        selectTipo.style.borderColor = 'var(--danger)';
    }
    if (typeof atualizarCategoriasSelect === 'function') atualizarCategoriasSelect();
}
if (selectTipo) selectTipo.addEventListener('change', atualizarCorTipo);

function atualizarInterfaceMes() {
    labelMesAtual.innerText = `${nomesMeses[dataNavegacao.getMonth()]} ${dataNavegacao.getFullYear()}`;
    const mesFormatado = String(dataNavegacao.getMonth() + 1).padStart(2, '0');
    if (inputMesPicker) inputMesPicker.value = `${dataNavegacao.getFullYear()}-${mesFormatado}`;
    atualizarBackgroundPorMes();
    renderizarLista();
}

btnMesAnterior.addEventListener('click', () => { dataNavegacao.setMonth(dataNavegacao.getMonth() - 1); atualizarInterfaceMes(); });
btnMesProximo.addEventListener('click', () => { dataNavegacao.setMonth(dataNavegacao.getMonth() + 1); atualizarInterfaceMes(); });

if (inputMesPicker) {
    inputMesPicker.addEventListener('change', (e) => {
        if (e.target.value) {
            const [ano, mes] = e.target.value.split('-');
            dataNavegacao.setFullYear(parseInt(ano));
            dataNavegacao.setMonth(parseInt(mes) - 1);
            atualizarInterfaceMes();
        }
    });
}

labelMesAtual.addEventListener('click', () => {
    if (inputMesPicker) { inputMesPicker.style.pointerEvents = 'auto'; inputMesPicker.showPicker?.(); inputMesPicker.click(); }
});

btnConfig.addEventListener('click', () => modalConfiguracoes.style.display = 'flex');
closeBtns.forEach(btn => btn.addEventListener('click', (e) => { const m = e.target.closest('.modal'); if (m) m.style.display = 'none'; }));
window.addEventListener('click', (e) => { if (e.target.classList.contains('modal')) e.target.style.display = 'none'; });

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active');
    });
});

function atualizarCategoriasSelect() {
    selectCategoria.innerHTML = '<option value="">Categoria...</option>';
    const tipoAtual = selectTipo.value;
    const catOrdenadas = [...categorias].sort((a, b) => a.nome.localeCompare(b.nome));
    const catFiltradas = catOrdenadas.filter(c => !c.tipo || c.tipo === 'ambas' || c.tipo === tipoAtual);
    catFiltradas.forEach(cat => { selectCategoria.appendChild(new Option(formatarNomeCategoria(cat.nome), cat.nome)); });
}

async function garantirCategoriasInvestimento(uid) {
    if (!window.db) return;
    const nomesNecessarios = [
        { nome: 'Resgate', tipo: 'entrada', cor: '#10b981' },
        { nome: 'Poupança e investimentos', tipo: 'saida', cor: '#3b82f6' }
    ];
    for (const cat of nomesNecessarios) {
        const existe = categorias.some(c => c.nome.toLowerCase().includes(cat.nome.toLowerCase()));
        if (!existe) {
            try {
                await addDoc(collection(window.db, "categorias"), { nome: cat.nome, tipo: cat.tipo, cor: cat.cor, userId: uid });
            } catch (e) { console.error("Erro ao criar categoria padrão:", e); }
        }
    }
}

function atualizarFiltroCategorias() {
    if (!filtroCategoria || !filtroTipo) return;
    const valTipo = filtroTipo.value;
    const selectedCat = filtroCategoria.value;
    filtroCategoria.innerHTML = '<option value="">Todas Categorias</option>';
    const catOrdenadas = [...categorias].sort((a, b) => a.nome.localeCompare(b.nome));
    catOrdenadas.filter(c => valTipo === '' || !c.tipo || c.tipo === 'ambas' || c.tipo === valTipo).forEach(cat => {
        filtroCategoria.appendChild(new Option(formatarNomeCategoria(cat.nome), cat.nome));
    });
    if (Array.from(filtroCategoria.options).some(o => o.value === selectedCat)) filtroCategoria.value = selectedCat;
}

function carregarOpcoesFormulario() {
    atualizarCategoriasSelect();
    selectCartao.innerHTML = '<option value="">Débito/pix/dinheiro</option>';
    atualizarFiltroCategorias();

    filtroCartao.innerHTML = `
        <option value="">Tudo</option>
        <option value="debito_pix_dinheiro">Débito/pix/dinheiro</option>
        <option value="todos_credito">Todos os cartões (crédito)</option>
    `;

    const cartoesOrdenados = [...cartoes].sort((a, b) => a.nome.localeCompare(b.nome));
    cartoesOrdenados.forEach(c => {
        selectCartao.appendChild(new Option(c.nome, c.nome));
        filtroCartao.appendChild(new Option(`${c.nome} (${c.tipo === 'credito' ? 'Crédito' : 'Débito'})`, c.nome));
    });

    const selectCatEntrada = document.getElementById('nova-entrada-fixa-cat');
    const selectCatSaida = document.getElementById('nova-saida-fixa-cat');
    const selectsCartao = [document.getElementById('nova-entrada-fixa-cartao'), document.getElementById('nova-saida-fixa-cartao')];
    const catOrdenadas = [...categorias].sort((a, b) => a.nome.localeCompare(b.nome));

    if (selectCatEntrada) {
        selectCatEntrada.innerHTML = '<option value="">Categoria...</option>';
        catOrdenadas.filter(c => !c.tipo || c.tipo === 'ambas' || c.tipo === 'entrada').forEach(c => selectCatEntrada.appendChild(new Option(c.nome, c.nome)));
    }
    if (selectCatSaida) {
        selectCatSaida.innerHTML = '<option value="">Categoria...</option>';
        catOrdenadas.filter(c => !c.tipo || c.tipo === 'ambas' || c.tipo === 'saida').forEach(c => selectCatSaida.appendChild(new Option(c.nome, c.nome)));
    }
    selectsCartao.forEach(sel => { if (sel) { sel.innerHTML = '<option value="">Débito/pix/dinheiro</option>'; cartoesOrdenados.forEach(c => sel.appendChild(new Option(c.nome, c.nome))); } });

    // Populate modal selects
    popularModalSelects();
}

function popularModalSelects() {
    const catOrdenadas = [...categorias].sort((a, b) => a.nome.localeCompare(b.nome));
    const cartoesOrdenados = [...cartoes].sort((a, b) => a.nome.localeCompare(b.nome));

    ['modal-categoria', 'editar-categoria'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const val = sel.value;
        sel.innerHTML = '<option value="">Sem categoria</option>';
        catOrdenadas.forEach(c => sel.appendChild(new Option(formatarNomeCategoria(c.nome), c.nome)));
        if (Array.from(sel.options).some(o => o.value === val)) sel.value = val;
    });

    ['modal-cartao', 'editar-cartao'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const val = sel.value;
        sel.innerHTML = '<option value="">Débito / Pix / Dinheiro</option>';
        cartoesOrdenados.forEach(c => sel.appendChild(new Option(c.nome, c.nome)));
        if (Array.from(sel.options).some(o => o.value === val)) sel.value = val;
    });
}

function confirmarAcao(titulo, texto, callbackSim) {
    const modal = document.getElementById('modal-confirmacao');
    document.getElementById('modal-confirmacao-titulo').innerText = titulo;
    document.getElementById('modal-confirmacao-texto').innerHTML = texto;
    modal.style.display = 'flex';
    const btnSim = document.getElementById('btn-confirmacao-sim');
    const btnNao = document.getElementById('btn-confirmacao-nao');
    btnSim.onclick = () => { modal.style.display = 'none'; callbackSim(); };
    btnNao.onclick = () => modal.style.display = 'none';
}

function renderizarListaCategorias() {
    const listaEntrada = document.getElementById('lista-categorias-entrada');
    const listaSaida = document.getElementById('lista-categorias-saida');
    const listaAmbas = document.getElementById('lista-categorias-ambas');
    if (listaEntrada) listaEntrada.innerHTML = '';
    if (listaSaida) listaSaida.innerHTML = '';
    if (listaAmbas) listaAmbas.innerHTML = '';
    const catOrdenadas = [...categorias].sort((a, b) => a.nome.localeCompare(b.nome));
    catOrdenadas.forEach(cat => {
        let tipoBadge = '';
        if (cat.tipo === 'entrada') tipoBadge = '<span style="font-size:0.7rem; background:#fef3c7; color:#92400e; padding:2px 5px; border-radius:4px; margin-left:5px;">Entrada</span>';
        else if (cat.tipo === 'saida') tipoBadge = '<span style="font-size:0.7rem; background:#fee2e2; color:#991b1b; padding:2px 5px; border-radius:4px; margin-left:5px;">Saída</span>';
        const isSistema = isCategoriaInvestimento(cat.nome);
        const iconSistema = isSistema ? '<i class="fa-solid fa-gem" style="color:var(--accent); margin-left:6px; font-size:0.8rem;" title="Categoria do Sistema"></i>' : '';
        const acoesHtml = isSistema ? '' : `
            <button class="btn-editar-categoria" data-id="${cat.id}" data-cor="${cat.cor}" data-tipo="${cat.tipo || 'ambas'}" title="Editar" style="color:var(--accent); background:none; border:none; cursor:pointer; padding:5px;"><i class="fa-solid fa-pen"></i></button>
            <button class="btn-excluir-config" data-id="${cat.id}" data-col="categorias" title="Excluir" style="color:var(--danger); background:none; border:none; cursor:pointer; padding:5px;"><i class="fa-solid fa-trash"></i></button>
        `;
        const htmlLi = `<li style="display:flex; justify-content:space-between; align-items:center; width:100%;">
            <div style="display:flex; align-items:center; gap:10px;">
                <div style="width:14px; height:14px; border-radius:50%; background-color:${cat.cor}; flex-shrink:0;"></div>
                <span class="cat-nome-texto">${formatarNomeCategoria(cat.nome)}</span>${tipoBadge}${iconSistema}
            </div>
            <div style="display:flex; gap:4px; align-items:center;">
                ${acoesHtml}
            </div>
        </li>`;
        if (cat.tipo === 'entrada' && listaEntrada) listaEntrada.innerHTML += htmlLi;
        else if (cat.tipo === 'saida' && listaSaida) listaSaida.innerHTML += htmlLi;
        else if (listaAmbas) listaAmbas.innerHTML += htmlLi;
    });
}

function renderizarListaCartoes() {
    listaCartoesUI.innerHTML = '';
    const cartoesOrdenados = [...cartoes].sort((a, b) => a.nome.localeCompare(b.nome));
    cartoesOrdenados.forEach(c => {
        const tipoLabel = c.tipo === 'credito' ? 'Crédito' : (c.tipo === 'debito' ? 'Débito' : 'Cartão');
        listaCartoesUI.innerHTML += `<li style="display:flex; justify-content:space-between; align-items:center; width:100%;">
            <div style="display:flex; align-items:center; gap:10px;">
                <i class="fa-solid fa-credit-card" style="color:var(--text-muted)"></i>
                <span class="cartao-nome-texto">${c.nome}</span>
                <span style="font-size:0.7rem; background:var(--surface-3); padding:2px 5px; border-radius:4px;">${tipoLabel}</span>
            </div>
            <div style="display:flex; gap:4px;">
                <button class="btn-editar-cartao" data-id="${c.id}" data-tipo="${c.tipo || 'credito'}" title="Editar" style="color:var(--accent); border:none; background:none; cursor:pointer; padding:5px;"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-excluir-config" data-id="${c.id}" data-col="cartoes" data-nome="${c.nome}" title="Excluir" style="color:var(--danger); border:none; background:none; cursor:pointer; padding:5px;"><i class="fa-solid fa-trash"></i></button>
            </div>
        </li>`;
    });
}

function renderizarListaEntradasFixas(termoBusca = '') {
    listaEntradasFixasUI.innerHTML = '';
    const entradasOrdenadas = [...entradasFixas].sort((a, b) => a.desc.localeCompare(b.desc));
    
    // Fallback to reading the input if no term passed but input exists
    const inputBusca = document.getElementById('busca-entradas-fixas');
    if (!termoBusca && inputBusca) termoBusca = inputBusca.value;

    entradasOrdenadas.forEach(g => {
        if (termoBusca) {
            const tBusca = termoBusca.toLowerCase();
            const desc = g.desc ? g.desc.toLowerCase() : '';
            const origem = g.origem ? g.origem.toLowerCase() : '';
            if (!desc.includes(tBusca) && !origem.includes(tBusca)) return;
        }

        let infoPrazo = `A partir de ${g.inicio}`;
        if (g.fim) {
            const [anoIni, mesIni] = g.inicio.split('-');
            const [anoFim, mesFim] = g.fim.split('-');
            const totalParcelas = (parseInt(anoFim) - parseInt(anoIni)) * 12 + (parseInt(mesFim) - parseInt(mesIni)) + 1;
            infoPrazo = totalParcelas > 0 ? `${g.inicio} a ${g.fim} (${totalParcelas} parcelas)` : `${g.inicio} (Data inválida)`;
        }
        listaEntradasFixasUI.innerHTML += `<li style="display:flex; justify-content:space-between; align-items:center; width:100%;">
            <div style="display:flex; flex-direction:column; gap:2px; width:100%;">
                <strong style="color:var(--success);" class="fixo-desc">${g.desc}</strong>
                ${g.origem || g.detalhes ? `<span style="font-size:0.75rem; color:var(--text-faint); margin-bottom:2px;">${g.origem ? g.origem + (g.detalhes ? ' - ' : '') : ''}${g.detalhes || ''}</span>` : ''}
                <span style="font-size:0.8rem; color:var(--text-muted);">R$ <span class="fixo-valor">${formatarMoeda(g.valor)}</span> | Dia <span class="fixo-dia">${g.dia}</span> | ${infoPrazo}</span>
                <input type="hidden" class="fixo-cat" value="${g.categoria || ''}"><input type="hidden" class="fixo-cartao" value="${g.cartao || ''}">
                <input type="hidden" class="fixo-inicio" value="${g.inicio || ''}"><input type="hidden" class="fixo-fim" value="${g.fim || ''}">
                <input type="hidden" class="fixo-origem" value="${g.origem || ''}"><input type="hidden" class="fixo-detalhes" value="${g.detalhes || ''}">
            </div>
            <div style="display:flex; gap:4px; flex-shrink:0;">
                <button class="btn-editar-fixo-config" data-id="${g.id}" data-col="entradasFixas" title="Editar" style="color:var(--accent); background:none; border:none; cursor:pointer; padding:5px;"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-excluir-fixo" data-id="${g.id}" data-col="entradasFixas" title="Excluir" style="color:var(--danger); background:none; border:none; cursor:pointer; padding:5px;"><i class="fa-solid fa-trash"></i></button>
            </div>
        </li>`;
    });
}

function renderizarListaSaidasFixas(termoBusca = '') {
    listaSaidasFixasUI.innerHTML = '';
    const saidasOrdenadas = [...saidasFixas].sort((a, b) => a.desc.localeCompare(b.desc));

    // Fallback to reading the input if no term passed but input exists
    const inputBusca = document.getElementById('busca-saidas-fixas');
    if (!termoBusca && inputBusca) termoBusca = inputBusca.value;

    saidasOrdenadas.forEach(g => {
        if (termoBusca) {
            const tBusca = termoBusca.toLowerCase();
            const desc = g.desc ? g.desc.toLowerCase() : '';
            const origem = g.origem ? g.origem.toLowerCase() : '';
            if (!desc.includes(tBusca) && !origem.includes(tBusca)) return;
        }

        let infoPrazo = `A partir de ${g.inicio}`;
        if (g.fim) {
            const [anoIni, mesIni] = g.inicio.split('-');
            const [anoFim, mesFim] = g.fim.split('-');
            const totalParcelas = (parseInt(anoFim) - parseInt(anoIni)) * 12 + (parseInt(mesFim) - parseInt(mesIni)) + 1;
            infoPrazo = totalParcelas > 0 ? `${g.inicio} a ${g.fim} (${totalParcelas} parcelas)` : `${g.inicio} (Data inválida)`;
        }
        listaSaidasFixasUI.innerHTML += `<li style="display:flex; justify-content:space-between; align-items:center; width:100%;">
            <div style="display:flex; flex-direction:column; gap:2px; width:100%;">
                <strong style="color:var(--danger);" class="fixo-desc">${g.desc}</strong>
                ${g.origem || g.detalhes ? `<span style="font-size:0.75rem; color:var(--text-faint); margin-bottom:2px;">${g.origem ? g.origem + (g.detalhes ? ' - ' : '') : ''}${g.detalhes || ''}</span>` : ''}
                <span style="font-size:0.8rem; color:var(--text-muted);">R$ <span class="fixo-valor">${formatarMoeda(g.valor)}</span> | Dia <span class="fixo-dia">${g.dia}</span> | ${infoPrazo}</span>
                <input type="hidden" class="fixo-cat" value="${g.categoria || ''}"><input type="hidden" class="fixo-cartao" value="${g.cartao || ''}">
                <input type="hidden" class="fixo-inicio" value="${g.inicio || ''}"><input type="hidden" class="fixo-fim" value="${g.fim || ''}">
                <input type="hidden" class="fixo-origem" value="${g.origem || ''}"><input type="hidden" class="fixo-detalhes" value="${g.detalhes || ''}">
            </div>
            <div style="display:flex; gap:4px; flex-shrink:0;">
                <button class="btn-editar-fixo-config" data-id="${g.id}" data-col="gastosFixos" title="Editar" style="color:var(--accent); background:none; border:none; cursor:pointer; padding:5px;"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-excluir-fixo" data-id="${g.id}" data-col="gastosFixos" title="Excluir" style="color:var(--danger); background:none; border:none; cursor:pointer; padding:5px;"><i class="fa-solid fa-trash"></i></button>
            </div>
        </li>`;
    });
}

// --- Config Edit Handlers ---
let impactoTimer;
function solicitarImpactoFixo(callback) {
    const modal = document.getElementById('modal-impacto-fixo');
    const btnConfirmar = document.getElementById('btn-confirmar-impacto');
    const btnCancelar = document.getElementById('btn-cancelar-impacto');
    const radios = document.getElementsByName('impacto-fixo');
    radios[0].checked = true;

    modal.style.display = 'flex';
    let timeLeft = 5;
    btnConfirmar.disabled = true;
    btnConfirmar.innerText = `Confirmar (${timeLeft}s)`;

    if (impactoTimer) clearInterval(impactoTimer);
    impactoTimer = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) { clearInterval(impactoTimer); btnConfirmar.disabled = false; btnConfirmar.innerText = 'Confirmar Alteração'; }
        else btnConfirmar.innerText = `Confirmar (${timeLeft}s)`;
    }, 1000);

    const limparModal = () => {
        clearInterval(impactoTimer);
        modal.style.display = 'none';
        btnConfirmar.replaceWith(btnConfirmar.cloneNode(true));
        btnCancelar.replaceWith(btnCancelar.cloneNode(true));
    };

    document.getElementById('btn-confirmar-impacto').addEventListener('click', () => {
        const impacto = Array.from(radios).find(r => r.checked).value;
        limparModal(); callback(impacto);
    });
    document.getElementById('btn-cancelar-impacto').addEventListener('click', limparModal);
}

document.addEventListener('click', async (e) => {
    const btnExcluirFixo = e.target.closest('.btn-excluir-fixo');
    const btnEditarFixoConfig = e.target.closest('.btn-editar-fixo-config');
    const btnSalvarFixoConfig = e.target.closest('.btn-salvar-fixo-config');
    const btnCancelarFixoConfig = e.target.closest('.btn-cancelar-fixo-config');
    const btnExcluirConfig = e.target.closest('.btn-excluir-config');
    const btnEditarCategoria = e.target.closest('.btn-editar-categoria');
    const btnSalvarCategoria = e.target.closest('.btn-salvar-categoria');
    const btnCancelarCategoria = e.target.closest('.btn-cancelar-categoria');
    const btnEditarCartao = e.target.closest('.btn-editar-cartao');
    const btnSalvarCartao = e.target.closest('.btn-salvar-cartao');
    const btnCancelarCartao = e.target.closest('.btn-cancelar-cartao');

    if (btnExcluirFixo) {
        solicitarImpactoFixo(async (impacto) => {
            const id = btnExcluirFixo.getAttribute('data-id');
            const col = btnExcluirFixo.getAttribute('data-col');
            if (impacto === 'todos') {
                await deleteDoc(doc(window.db, col, id));
                const campoFixoId = col === 'entradasFixas' ? 'entradaFixaId' : 'gastoFixoId';
                const docsSnap = await getDocs(query(collection(window.db, "dados_mensais"), where("userId", "==", userIdLogado)));
                docsSnap.forEach(async (dSnap) => {
                    let arr = dSnap.data().transacoes || [];
                    const lenAntes = arr.length;
                    arr = arr.filter(t => !(t[campoFixoId] === id && t.id && !t.isProjection));
                    if (arr.length !== lenAntes) await updateDoc(dSnap.ref, { transacoes: arr });
                });
            } else if (impacto === 'frente') {
                const dataNav = new Date(dataNavegacao.getFullYear(), dataNavegacao.getMonth());
                dataNav.setMonth(dataNav.getMonth() - 1);
                const mesPassado = `${dataNav.getFullYear()}-${String(dataNav.getMonth() + 1).padStart(2, '0')}`;
                await updateDoc(doc(window.db, col, id), { fim: mesPassado });
            }
        });
    }

    if (btnEditarFixoConfig) {
        const li = btnEditarFixoConfig.closest('li');
        const id = btnEditarFixoConfig.getAttribute('data-id');
        const col = btnEditarFixoConfig.getAttribute('data-col');
        const desc = li.querySelector('.fixo-desc').innerText.trim().split(' (R$')[0];
        const valor = li.querySelector('.fixo-valor').innerText.replace(/\./g, '').replace(',', '.');
        const dia = li.querySelector('.fixo-dia').innerText;
        const cat = li.querySelector('.fixo-cat').value;
        const cartao = li.querySelector('.fixo-cartao').value;
        const inicio = li.querySelector('.fixo-inicio').value;
        const fim = li.querySelector('.fixo-fim').value;
        const origem = li.querySelector('.fixo-origem').value;
        const detalhes = li.querySelector('.fixo-detalhes').value;

        const catOrdenadas = [...categorias].sort((a, b) => a.nome.localeCompare(b.nome));
        const tipoFixo = col === 'entradasFixas' ? 'entrada' : 'saida';
        const catFiltradas = catOrdenadas.filter(c => !c.tipo || c.tipo === 'ambas' || c.tipo === tipoFixo);
        const cartoesOrdenados = [...cartoes].sort((a, b) => a.nome.localeCompare(b.nome));

        let catOptions = '<option value="">Categoria...</option>';
        catFiltradas.forEach(c => catOptions += `<option value="${c.nome}" ${c.nome === cat ? 'selected' : ''}>${c.nome}</option>`);
        let cartaoOptions = '<option value="">Débito/pix/dinheiro</option>';
        cartoesOrdenados.forEach(c => cartaoOptions += `<option value="${c.nome}" ${c.nome === cartao ? 'selected' : ''}>${c.nome}</option>`);

        li.innerHTML = `<div style="display:flex; flex-direction:column; gap:8px; width:100%;">
            <div style="display:flex; gap:5px;">
                <input type="text" class="edit-fixo-desc" value="${desc}" style="flex:2; padding:0.5rem; border:1px solid var(--border); border-radius:6px; background:var(--surface-2); color:var(--text-main);">
                <input type="text" class="edit-fixo-origem" value="${origem}" placeholder="Origem" style="flex:2; padding:0.5rem; border:1px solid var(--border); border-radius:6px; background:var(--surface-2); color:var(--text-main);">
                <input type="number" step="0.01" class="edit-fixo-valor" value="${valor}" style="flex:1; padding:0.5rem; border:1px solid var(--border); border-radius:6px; background:var(--surface-2); color:var(--text-main);">
                <input type="number" class="edit-fixo-dia" value="${dia}" min="1" max="31" style="width:60px; padding:0.5rem; border:1px solid var(--border); border-radius:6px; background:var(--surface-2); color:var(--text-main);">
            </div>
            <textarea class="edit-fixo-detalhes" placeholder="Detalhes" rows="1" style="width:100%; padding:0.5rem; border:1px solid var(--border); border-radius:6px; background:var(--surface-2); color:var(--text-main); font-family:inherit;">${detalhes}</textarea>
            <div style="display:flex; gap:5px;">
                <select class="edit-fixo-cat" style="flex:1; padding:0.5rem; border:1px solid var(--border); border-radius:6px; background:var(--surface-2); color:var(--text-main);">${catOptions}</select>
                <select class="edit-fixo-cartao" style="flex:1; padding:0.5rem; border:1px solid var(--border); border-radius:6px; background:var(--surface-2); color:var(--text-main);">${cartaoOptions}</select>
            </div>
            <div style="display:flex; gap:5px; align-items:center;">
                <input type="month" class="edit-fixo-inicio" value="${inicio}" style="flex:1; padding:0.5rem; border:1px solid var(--border); border-radius:6px; background:var(--surface-2); color:var(--text-main);">
                <span style="color:var(--text-muted); font-size:0.8rem;">até</span>
                <input type="month" class="edit-fixo-fim" value="${fim}" style="flex:1; padding:0.5rem; border:1px solid var(--border); border-radius:6px; background:var(--surface-2); color:var(--text-main);">
            </div>
            <div style="display:flex; gap:8px;">
                <button class="btn-salvar-fixo-config btn-primary" data-id="${id}" data-col="${col}" style="flex:1;"><i class="fa-solid fa-check"></i> Salvar</button>
                <button class="btn-cancelar-fixo-config btn-secondary" style="flex:1;">Cancelar</button>
            </div>
        </div>`;
    }

    if (btnCancelarFixoConfig) { renderizarListaEntradasFixas(); renderizarListaSaidasFixas(); }

    if (btnSalvarFixoConfig) {
        const li = btnSalvarFixoConfig.closest('li');
        const id = btnSalvarFixoConfig.getAttribute('data-id');
        const col = btnSalvarFixoConfig.getAttribute('data-col');
        const novosDados = {
            desc: li.querySelector('.edit-fixo-desc').value,
            origem: li.querySelector('.edit-fixo-origem').value.trim(),
            detalhes: li.querySelector('.edit-fixo-detalhes').value.trim(),
            valor: parseFloat(li.querySelector('.edit-fixo-valor').value),
            dia: li.querySelector('.edit-fixo-dia').value,
            categoria: li.querySelector('.edit-fixo-cat').value,
            cartao: li.querySelector('.edit-fixo-cartao').value,
            inicio: li.querySelector('.edit-fixo-inicio').value,
            fim: li.querySelector('.edit-fixo-fim').value
        };
        solicitarImpactoFixo(async (impacto) => {
            if (impacto === 'todos') {
                await updateDoc(doc(window.db, col, id), novosDados);
                const campoFixoId = col === 'entradasFixas' ? 'entradaFixaId' : 'gastoFixoId';
                const docsSnap = await getDocs(query(collection(window.db, "dados_mensais"), where("userId", "==", userIdLogado)));
                docsSnap.forEach(async (dSnap) => {
                    let changed = false;
                    let arr = dSnap.data().transacoes || [];
                    arr = arr.map(t => {
                        if (t[campoFixoId] === id && t.id && !t.isProjection) {
                            changed = true;
                            const novoDia = String(novosDados.dia).padStart(2, '0');
                            const dataAtualizada = t.data.substring(0, 8) + novoDia;
                            return { ...t, descricao: novosDados.desc, valor: novosDados.valor, categoria: novosDados.categoria, cartao: novosDados.cartao, data: dataAtualizada, origem: novosDados.origem, detalhes: novosDados.detalhes };
                        }
                        return t;
                    });
                    if (changed) await updateDoc(dSnap.ref, { transacoes: arr });
                });
            } else if (impacto === 'frente') {
                const dataNav = new Date(dataNavegacao.getFullYear(), dataNavegacao.getMonth());
                dataNav.setMonth(dataNav.getMonth() - 1);
                const mesPassado = `${dataNav.getFullYear()}-${String(dataNav.getMonth() + 1).padStart(2, '0')}`;
                await updateDoc(doc(window.db, col, id), { fim: mesPassado });
                novosDados.inicio = `${dataNavegacao.getFullYear()}-${String(dataNavegacao.getMonth() + 1).padStart(2, '0')}`;
                novosDados.userId = userIdLogado;
                await addDoc(collection(window.db, col), novosDados);
            }
            renderizarListaEntradasFixas();
            renderizarListaSaidasFixas();
        });
    }

    if (btnExcluirConfig) {
        const col = btnExcluirConfig.getAttribute('data-col');
        const nomeItem = btnExcluirConfig.getAttribute('data-nome');
        const tipoStr = col === 'categorias' ? 'esta categoria' : 'este cartão';
        let avisoEmUso = "";
        if (col === 'cartoes' && nomeItem) {
            const emUso = transacoes.some(t => t.cartao === nomeItem && t.status !== 'excluida') || saidasFixas.some(g => g.cartao === nomeItem) || entradasFixas.some(g => g.cartao === nomeItem);
            if (emUso) avisoEmUso = "<br><br><strong style='color:var(--danger)'>⚠️ AVISO: Este cartão está sendo usado. Excluí-lo afetará o histórico.</strong>";
        }
        confirmarAcao("Excluir", `Tem certeza que deseja excluir ${tipoStr} permanentemente?${avisoEmUso}`, async () => {
            await deleteDoc(doc(window.db, col, btnExcluirConfig.getAttribute('data-id')));
        });
    }

    if (btnEditarCategoria) {
        const li = btnEditarCategoria.closest('li');
        const id = btnEditarCategoria.getAttribute('data-id');
        const cor = btnEditarCategoria.getAttribute('data-cor');
        const tipo = btnEditarCategoria.getAttribute('data-tipo');
        const nomeTexto = li.querySelector('.cat-nome-texto').innerText;
        li.innerHTML = `<div style="display:flex; gap:5px; width:100%; align-items:center;">
            <input type="text" class="edit-cat-nome" value="${nomeTexto}" data-old-nome="${nomeTexto}" style="flex:1; padding:0.5rem; border:1px solid var(--border); border-radius:6px; background:var(--surface-2); color:var(--text-main);">
            <select class="edit-cat-tipo" style="padding:0.5rem; border:1px solid var(--border); border-radius:6px; background:var(--surface-2); color:var(--text-main);">
                <option value="ambas" ${tipo === 'ambas' ? 'selected' : ''}>Ambas</option>
                <option value="entrada" ${tipo === 'entrada' ? 'selected' : ''}>Entrada</option>
                <option value="saida" ${tipo === 'saida' ? 'selected' : ''}>Saída</option>
            </select>
            <input type="color" class="edit-cat-cor" value="${cor}" style="width:36px; height:36px; border:1px solid var(--border); border-radius:6px; padding:2px; cursor:pointer;">
            <button class="btn-salvar-categoria" data-id="${id}" style="color:var(--success); background:none; border:none; cursor:pointer; font-size:1.1rem;"><i class="fa-solid fa-check"></i></button>
            <button class="btn-cancelar-categoria" style="color:var(--text-muted); background:none; border:none; cursor:pointer; font-size:1.1rem;"><i class="fa-solid fa-times"></i></button>
        </div>`;
    }

    if (btnSalvarCategoria) {
        const li = btnSalvarCategoria.closest('li');
        const id = btnSalvarCategoria.getAttribute('data-id');
        const novoNome = li.querySelector('.edit-cat-nome').value;
        const nomeAntigo = li.querySelector('.edit-cat-nome').getAttribute('data-old-nome');
        const novaCor = li.querySelector('.edit-cat-cor').value;
        const novoTipo = li.querySelector('.edit-cat-tipo').value;
        await updateDoc(doc(window.db, "categorias", id), { nome: novoNome, cor: novaCor, tipo: novoTipo });
        if (novoNome !== nomeAntigo) {
            const docsSnap = await getDocs(query(collection(window.db, "dados_mensais"), where("userId", "==", userIdLogado)));
            docsSnap.forEach(async (dSnap) => {
                let changed = false;
                let arr = dSnap.data().transacoes || [];
                arr = arr.map(t => { if (t.categoria === nomeAntigo && !t.isProjection) { changed = true; return {...t, categoria: novoNome}; } return t; });
                if (changed) await updateDoc(dSnap.ref, { transacoes: arr });
            });
            entradasFixas.forEach(async (t) => { if (t.categoria === nomeAntigo) await updateDoc(doc(window.db, "entradasFixas", t.id), { categoria: novoNome }); });
            saidasFixas.forEach(async (t) => { if (t.categoria === nomeAntigo) await updateDoc(doc(window.db, "gastosFixos", t.id), { categoria: novoNome }); });
        }
    }

    if (btnCancelarCategoria) renderizarListaCategorias();

    if (btnEditarCartao) {
        const li = btnEditarCartao.closest('li');
        const id = btnEditarCartao.getAttribute('data-id');
        const tipo = btnEditarCartao.getAttribute('data-tipo');
        const nomeTexto = li.querySelector('.cartao-nome-texto').innerText;
        const emUso = transacoes.some(t => t.cartao === nomeTexto && t.status !== 'excluida') || saidasFixas.some(g => g.cartao === nomeTexto) || entradasFixas.some(g => g.cartao === nomeTexto);
        const avisoEmUso = emUso ? "<div style='color:var(--danger); font-size:0.75rem; margin-top:5px;'>⚠️ Cartão em uso. Edições afetarão lançamentos existentes.</div>" : "";
        li.innerHTML = `<div style="display:flex; flex-direction:column; width:100%;">
            <div style="display:flex; gap:5px; width:100%; align-items:center;">
                <input type="text" class="edit-cartao-nome" value="${nomeTexto}" data-old-nome="${nomeTexto}" style="flex:1; padding:0.5rem; border:1px solid var(--border); border-radius:6px; background:var(--surface-2); color:var(--text-main);">
                <select class="edit-cartao-tipo" style="padding:0.5rem; border:1px solid var(--border); border-radius:6px; background:var(--surface-2); color:var(--text-main);">
                    <option value="credito" ${tipo === 'credito' ? 'selected' : ''}>Crédito</option>
                    <option value="debito" ${tipo === 'debito' ? 'selected' : ''}>Débito</option>
                </select>
                <button class="btn-salvar-cartao" data-id="${id}" style="color:var(--success); background:none; border:none; cursor:pointer; font-size:1.1rem;"><i class="fa-solid fa-check"></i></button>
                <button class="btn-cancelar-cartao" style="color:var(--text-muted); background:none; border:none; cursor:pointer; font-size:1.1rem;"><i class="fa-solid fa-times"></i></button>
            </div>${avisoEmUso}
        </div>`;
    }

    if (btnSalvarCartao) {
        const li = btnSalvarCartao.closest('li');
        const id = btnSalvarCartao.getAttribute('data-id');
        const novoNome = li.querySelector('.edit-cartao-nome').value;
        const nomeAntigo = li.querySelector('.edit-cartao-nome').getAttribute('data-old-nome');
        const novoTipo = li.querySelector('.edit-cartao-tipo').value;
        await updateDoc(doc(window.db, "cartoes", id), { nome: novoNome, tipo: novoTipo });
        if (novoNome !== nomeAntigo) {
            const docsSnap = await getDocs(query(collection(window.db, "dados_mensais"), where("userId", "==", userIdLogado)));
            docsSnap.forEach(async (dSnap) => {
                let changed = false;
                let arr = dSnap.data().transacoes || [];
                arr = arr.map(t => { if (t.cartao === nomeAntigo && !t.isProjection) { changed = true; return {...t, cartao: novoNome}; } return t; });
                if (changed) await updateDoc(dSnap.ref, { transacoes: arr });
            });
            entradasFixas.forEach(async (t) => { if (t.cartao === nomeAntigo) await updateDoc(doc(window.db, "entradasFixas", t.id), { cartao: novoNome }); });
            saidasFixas.forEach(async (t) => { if (t.cartao === nomeAntigo) await updateDoc(doc(window.db, "gastosFixos", t.id), { cartao: novoNome }); });
        }
    }

    if (btnCancelarCartao) renderizarListaCartoes();
});

// --- Config form submissions ---
formCategoria.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!window.db || !userIdLogado) return;
    await addDoc(collection(window.db, "categorias"), {
        nome: document.getElementById('nova-cat-nome').value,
        cor: document.getElementById('nova-cat-cor').value,
        tipo: document.getElementById('nova-cat-tipo').value,
        userId: userIdLogado
    });
    formCategoria.reset();
});

formCartao.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!window.db || !userIdLogado) return;
    await addDoc(collection(window.db, "cartoes"), {
        nome: document.getElementById('novo-cartao-nome').value,
        tipo: document.getElementById('novo-cartao-tipo').value,
        userId: userIdLogado
    });
    formCartao.reset();
});

formEntradasFixas.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!window.db || !userIdLogado) return;
    await addDoc(collection(window.db, "entradasFixas"), {
        desc: document.getElementById('nova-entrada-fixa-desc').value,
        origem: document.getElementById('nova-entrada-fixa-origem').value.trim(),
        detalhes: document.getElementById('nova-entrada-fixa-detalhes').value.trim(),
        valor: parseFloat(document.getElementById('nova-entrada-fixa-valor').value),
        dia: document.getElementById('nova-entrada-fixa-dia').value,
        categoria: document.getElementById('nova-entrada-fixa-cat').value,
        cartao: document.getElementById('nova-entrada-fixa-cartao').value,
        inicio: document.getElementById('nova-entrada-fixa-inicio').value || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
        fim: document.getElementById('nova-entrada-fixa-fim').value,
        userId: userIdLogado
    });
    formEntradasFixas.reset();
});

formSaidasFixas.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!window.db || !userIdLogado) return;
    await addDoc(collection(window.db, "gastosFixos"), {
        desc: document.getElementById('nova-saida-fixa-desc').value,
        origem: document.getElementById('nova-saida-fixa-origem').value.trim(),
        detalhes: document.getElementById('nova-saida-fixa-detalhes').value.trim(),
        valor: parseFloat(document.getElementById('nova-saida-fixa-valor').value),
        dia: document.getElementById('nova-saida-fixa-dia').value,
        categoria: document.getElementById('nova-saida-fixa-cat').value,
        cartao: document.getElementById('nova-saida-fixa-cartao').value,
        inicio: document.getElementById('nova-saida-fixa-inicio').value || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
        fim: document.getElementById('nova-saida-fixa-fim').value,
        userId: userIdLogado
    });
    formSaidasFixas.reset();
});

// --- Core Render Logic ---
function getMesAnterior(yyyy_mm) {
    let [ano, mes] = yyyy_mm.split('-');
    let date = new Date(ano, mes - 1);
    date.setMonth(date.getMonth() - 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getMesCobranca(yyyy_mm) {
    let [ano, mes] = yyyy_mm.split('-');
    let date = new Date(ano, mes - 1);
    date.setMonth(date.getMonth() + 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const checkIsCredito = (nomeCartao) => {
    if (!nomeCartao || nomeCartao === '') return false;
    const cObj = cartoes.find(c => c.nome === nomeCartao);
    return cObj && (cObj.tipo === 'credito' || !cObj.tipo);
};

const isCategoriaInvestimento = (nome) => {
    if (!nome) return false;
    const n = nome.toLowerCase();
    return n.includes('poupança') || n.includes('investimento') || n.includes('resgate') || n.includes('rendimento') || n.includes('dividendo');
};

const formatarNomeCategoria = (nome) => {
    if (!nome) return '';
    return nome;
};

function atualizarResumo(transacoesRenderizadas, mesNavString, todasTransacoesMesSemFiltro) {
    const mesAnteriorStr = getMesAnterior(mesNavString);
    let totalEntradasMes = 0; let totalSaidasVistaMes = 0; let totalUsoCartaoMes = 0; let totalFaturaAnterior = 0;
    
    let totalEntradasMesSemFiltro = 0; let totalSaidasVistaMesSemFiltro = 0; let totalUsoCartaoMesSemFiltro = 0; let totalFaturaAnteriorSemFiltro = 0;

    transacoesRenderizadas.forEach(t => {
        if (t.status === 'excluida') return;
        if (t.tipo === 'entrada') totalEntradasMes += t.valor;
        else if (t.tipo === 'saida') {
            if (checkIsCredito(t.cartao)) totalUsoCartaoMes += t.valor;
            else totalSaidasVistaMes += t.valor;
        }
    });

    if (todasTransacoesMesSemFiltro) {
        todasTransacoesMesSemFiltro.forEach(t => {
            if (t.status === 'excluida') return;
            if (t.tipo === 'entrada') totalEntradasMesSemFiltro += t.valor;
            else if (t.tipo === 'saida') {
                if (checkIsCredito(t.cartao)) totalUsoCartaoMesSemFiltro += t.valor;
                else totalSaidasVistaMesSemFiltro += t.valor;
            }
        });
    }

    transacoes.forEach(t => {
        if (t.status === 'excluida') return;
        const tMes = t.data.substring(0, 7);
        if (tMes === mesAnteriorStr && t.tipo === 'saida' && checkIsCredito(t.cartao)) {
            if (normalizarStatus(t) !== 'simulacao') totalFaturaAnterior += t.valor;
        }
    });

    saidasFixas.forEach(g => {
        if (checkIsCredito(g.cartao) && mesAnteriorStr >= g.inicio && (!g.fim || mesAnteriorStr <= g.fim)) {
            const jaExiste = transacoes.some(t => t.gastoFixoId === g.id && t.data.startsWith(mesAnteriorStr));
            if (!jaExiste) {
                totalFaturaAnterior += parseFloat(g.valor);
            }
        }
    });
    
    // For now we assume Fatura Anterior isn't deeply filtered in the month view, but we copy it
    totalFaturaAnteriorSemFiltro = totalFaturaAnterior;

    let totalEfetivo = 0; let totalProjetado = 0;
    const processTransactionForBalance = (t) => {
        if (t.status === 'excluida') return;
        const tMes = t.data.substring(0, 7);
        const isCartaoCredito = t.tipo === 'saida' && checkIsCredito(t.cartao);
        const mesImpacto = isCartaoCredito ? getMesCobranca(tMes) : tMes;
        if (mesImpacto <= mesNavString) {
            if (normalizarStatus(t) === 'realizada') { t.tipo === 'entrada' ? totalEfetivo += t.valor : totalEfetivo -= t.valor; }
            if (normalizarStatus(t) !== 'simulacao') { t.tipo === 'entrada' ? totalProjetado += t.valor : totalProjetado -= t.valor; }
        }
    };

    transacoes.forEach(processTransactionForBalance);

    const gerarMesesAte = (inicio, fim) => {
        if (!inicio) return [];
        const meses = []; let [anoI, mesI] = inicio.split('-').map(Number);
        const [anoF, mesF] = fim.split('-').map(Number);
        while (anoI < anoF || (anoI === anoF && mesI <= mesF)) {
            meses.push(`${anoI}-${String(mesI).padStart(2, '0')}`);
            mesI++; if (mesI > 12) { mesI = 1; anoI++; }
        }
        return meses;
    };

    entradasFixas.forEach(g => {
        const limiteFim = (g.fim && g.fim < mesNavString) ? g.fim : mesNavString;
        if (g.inicio && g.inicio <= limiteFim) {
            gerarMesesAte(g.inicio, limiteFim).forEach(mesProj => {
                const jaExiste = transacoes.some(t => t.entradaFixaId === g.id && t.data.startsWith(mesProj));
                if (!jaExiste) processTransactionForBalance({ status: 'prevista', data: `${mesProj}-01`, tipo: 'entrada', cartao: g.cartao, valor: parseFloat(g.valor) });
            });
        }
    });

    saidasFixas.forEach(g => {
        const limiteFim = (g.fim && g.fim < mesNavString) ? g.fim : mesNavString;
        if (g.inicio && g.inicio <= limiteFim) {
            gerarMesesAte(g.inicio, limiteFim).forEach(mesProj => {
                const jaExiste = transacoes.some(t => t.gastoFixoId === g.id && t.data.startsWith(mesProj));
                if (!jaExiste) processTransactionForBalance({ status: 'prevista', data: `${mesProj}-01`, tipo: 'saida', cartao: g.cartao, valor: parseFloat(g.valor) });
            });
        }
    });

    // Update card elements
    document.getElementById('total-entradas').innerText = `R$\u00A0${formatarMoeda(totalEntradasMes)}`;
    document.getElementById('total-saidas').innerText = `R$\u00A0${formatarMoeda(totalSaidasVistaMes)}`;
    document.getElementById('total-fatura').innerText = `R$\u00A0${formatarMoeda(totalFaturaAnterior)}`;
    document.getElementById('total-cartao-mes').innerText = `R$\u00A0${formatarMoeda(totalUsoCartaoMes)}`;
    document.getElementById('saldo-atual').innerText = `R$\u00A0${formatarMoeda(totalEfetivo)}`;
    document.getElementById('saldo-previsto').innerText = `R$\u00A0${formatarMoeda(totalProjetado)}`;

    // Update computed "Saídas" card total = fatura anterior + gastos à vista
    const totalSaidasCard = totalSaidasVistaMes + totalFaturaAnterior;
    const totalSaidasCardSemFiltro = totalSaidasVistaMesSemFiltro + totalFaturaAnteriorSemFiltro;
    const saidasTotal = document.getElementById('saidas-valor-total');
    if (saidasTotal) saidasTotal.innerText = `R$\u00A0${formatarMoeda(totalSaidasCard)}`;

    // Color indicators for modified totals
    const cardEntradas = document.querySelector('.card.entrada');
    const cardSaidas = document.querySelector('.card.saida');
    
    if (todasTransacoesMesSemFiltro) {
        if (totalEntradasMes !== totalEntradasMesSemFiltro && cardEntradas) {
            cardEntradas.style.background = 'var(--surface-3)';
            cardEntradas.style.borderColor = 'var(--success)';
            cardEntradas.title = "Valor alterado pelos filtros";
        } else if (cardEntradas) {
            cardEntradas.style.background = '';
            cardEntradas.style.borderColor = '';
            cardEntradas.title = "";
        }

        if (totalSaidasCard !== totalSaidasCardSemFiltro && cardSaidas) {
            cardSaidas.style.background = 'var(--surface-3)';
            cardSaidas.style.borderColor = 'var(--danger)';
            cardSaidas.title = "Valor alterado pelos filtros";
        } else if (cardSaidas) {
            cardSaidas.style.background = '';
            cardSaidas.style.borderColor = '';
            cardSaidas.title = "";
        }
    }

    // Color saldo-atual based on value
    const saldoEl = document.getElementById('saldo-atual');
    if (saldoEl) {
        saldoEl.style.color = totalEfetivo >= 0 ? 'var(--accent)' : 'var(--danger)';
    }
    const saldoPrevEl = document.getElementById('saldo-previsto');
    if (saldoPrevEl) {
        saldoPrevEl.style.color = totalProjetado >= 0 ? 'var(--success)' : 'var(--danger)';
    }
}

function gerarOptionsSelect(lista, valorSelecionado) {
    return lista.map(item => `<option value="${item.nome}" ${item.nome === valorSelecionado ? 'selected' : ''}>${item.nome}</option>`).join('');
}

function renderizarLista() {
    listaTransacoes.innerHTML = '';
    const mesFormatado = String(dataNavegacao.getMonth() + 1).padStart(2, '0');
    const prefixoData = `${dataNavegacao.getFullYear()}-${mesFormatado}`;
    const navYYYYMM = prefixoData;
    const incluirSimulacoes = toggleSimulacao.checked;

    const transacoesProjeto = [];
    entradasFixas.forEach(g => {
        if (navYYYYMM >= g.inicio && (!g.fim || navYYYYMM <= g.fim)) {
            const jaExiste = transacoes.some(t => t.entradaFixaId === g.id && t.data.startsWith(navYYYYMM));
            if (!jaExiste) {
                transacoesProjeto.push({
                    id: 'proje_' + g.id + '_' + navYYYYMM,
                    entradaFixaId: g.id, isProjection: true, tipo: 'entrada',
                    descricao: g.desc, valor: parseFloat(g.valor),
                    origem: g.origem, detalhes: g.detalhes,
                    data: `${navYYYYMM}-${String(g.dia).padStart(2, '0')}`,
                    categoria: g.categoria || 'Sem Categoria', cartao: g.cartao || '', status: 'prevista'
                });
            }
        }
    });

    saidasFixas.forEach(g => {
        if (navYYYYMM >= g.inicio && (!g.fim || navYYYYMM <= g.fim)) {
            const jaExiste = transacoes.some(t => t.gastoFixoId === g.id && t.data.startsWith(navYYYYMM));
            if (!jaExiste) {
                transacoesProjeto.push({
                    id: 'projs_' + g.id + '_' + navYYYYMM,
                    gastoFixoId: g.id, isProjection: true, tipo: 'saida',
                    descricao: g.desc, valor: parseFloat(g.valor),
                    origem: g.origem, detalhes: g.detalhes,
                    data: `${navYYYYMM}-${String(g.dia).padStart(2, '0')}`,
                    categoria: g.categoria || 'Sem Categoria', cartao: g.cartao || '', status: 'prevista'
                });
            }
        }
    });

    const todasTransacoes = [...transacoes, ...transacoesProjeto];

    const valCat = filtroCategoria.value;
    const valCartao = filtroCartao.value;
    const valStatus = filtroStatus.value;
    const valBusca = filtroBusca.value.toLowerCase().trim();
    const valTipo = filtroTipo.value;

    filtroBusca.classList.toggle('filtro-ativo', valBusca !== '');
    filtroTipo.classList.toggle('filtro-ativo', valTipo !== '');
    filtroCategoria.classList.toggle('filtro-ativo', valCat !== '');
    filtroCartao.classList.toggle('filtro-ativo', valCartao !== '');
    filtroStatus.classList.toggle('filtro-ativo', valStatus !== '');

    let transacoesFiltradas = todasTransacoes.filter(t => {
        if (t.status === 'excluida') return false;
        const tStatus = normalizarStatus(t);
        const passaSimulacao = (incluirSimulacoes || valStatus === 'simulacao') ? true : tStatus !== 'simulacao';
        const passaMes = t.data.startsWith(prefixoData);

        let passaTipo = true;
        if (valTipo === 'entrada') passaTipo = t.tipo === 'entrada';
        else if (valTipo === 'saida') passaTipo = t.tipo === 'saida';
        else if (valTipo === 'entrada_fixa') passaTipo = !!t.entradaFixaId;
        else if (valTipo === 'saida_fixa') passaTipo = !!t.gastoFixoId;

        let passaCat = valCat === '' || t.categoria === valCat;

        let passaCartao = true;
        if (valCartao === 'debito_pix_dinheiro') passaCartao = !t.cartao;
        else if (valCartao === 'todos_credito') passaCartao = checkIsCredito(t.cartao);
        else if (valCartao !== '') passaCartao = t.cartao === valCartao;

        let passaStatus = valStatus === '' || tStatus === valStatus;
        let passaBusca = valBusca === '' || t.descricao.toLowerCase().includes(valBusca);

        return passaSimulacao && passaMes && passaTipo && passaCat && passaCartao && passaStatus && passaBusca;
    });

    if (listSortConfig.length === 0) {
        transacoesFiltradas.sort((a, b) => b.data.localeCompare(a.data));
    } else {
        transacoesFiltradas.sort((a, b) => {
            for (let i = 0; i < listSortConfig.length; i++) {
                const criteria = listSortConfig[i];
                let valA, valB;
                if (criteria.col === 'data') { valA = a.data; valB = b.data; }
                else if (criteria.col === 'descricao') { valA = a.descricao.toLowerCase(); valB = b.descricao.toLowerCase(); }
                else if (criteria.col === 'categoria') { valA = (a.categoria || '').toLowerCase(); valB = (b.categoria || '').toLowerCase(); }
                else if (criteria.col === 'cartao') { valA = (a.cartao || '').toLowerCase(); valB = (b.cartao || '').toLowerCase(); }
                else if (criteria.col === 'valor') { valA = a.valor; valB = b.valor; }
                else if (criteria.col === 'status') { valA = normalizarStatus(a).toLowerCase(); valB = normalizarStatus(b).toLowerCase(); }
                let cmp = 0;
                if (typeof valA === 'string') cmp = valA.localeCompare(valB);
                else cmp = valA - valB;
                if (cmp !== 0) { return criteria.dir === 'asc' ? cmp : -cmp; }
            }
            return 0;
        });
    }

    document.querySelectorAll('#lista-header .sortable').forEach(span => {
        const col = span.getAttribute('data-sort');
        const icon = span.querySelector('i');
        span.classList.remove('active-sort-asc','active-sort-desc');
        const sortIndex = listSortConfig.findIndex(s => s.col === col);
        if (sortIndex !== -1) {
            const dir = listSortConfig[sortIndex].dir;
            span.classList.add(dir === 'asc' ? 'active-sort-asc' : 'active-sort-desc');
            if (icon) icon.className = dir === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down';
        } else {
            if (icon) icon.className = 'fa-solid fa-sort';
        }
    });

    if (transacoesFiltradas.length === 0) {
        listaTransacoes.innerHTML = `<li class="empty-state"><i class="fa-solid fa-receipt"></i><p>Nenhum lançamento encontrado para este mês</p></li>`;
    } else {
        transacoesFiltradas.forEach((t, index) => {
            const li = document.createElement('li');
            li.setAttribute('data-id', t.id);

            const tStatus = normalizarStatus(t);
            if (tStatus === 'simulacao') li.classList.add('status-simulacao-row');
            else if (tStatus === 'realizada') li.classList.add('status-realizada-row');
            else if (tStatus === 'prevista') li.classList.add('status-previsto-row');
            li.classList.add(t.tipo === 'entrada' ? 'tipo-entrada' : 'tipo-saida');

            const valorFormatado = `R$\u00A0${formatarMoeda(t.valor)}`;
            const sinal = t.tipo === 'entrada' ? '+' : '-';

            let labelStatus = '';
            if (tStatus === 'realizada') labelStatus = `<span class="status-badge realizada" onclick="event.stopPropagation(); window.alternarStatusRapido('${t.id}', '${tStatus}', '${t.docId || ''}')" style="cursor:pointer;" title="Mudar para Previsto"><i class="fa-solid fa-circle-check" style="font-size:0.65rem;"></i> Realizada</span>`;
            else if (tStatus === 'prevista') labelStatus = `<span class="status-badge prevista" onclick="event.stopPropagation(); window.alternarStatusRapido('${t.id}', '${tStatus}', '${t.docId || ''}')" style="cursor:pointer;" title="Mudar para Realizado"><i class="fa-regular fa-clock" style="font-size:0.65rem;"></i> Previsto</span>`;
            else if (tStatus === 'simulacao') labelStatus = `<span class="status-badge simulacao" onclick="event.stopPropagation(); window.alternarStatusRapido('${t.id}', '${tStatus}', '${t.docId || ''}')" style="cursor:pointer;" title="Mudar para Previsto"><i class="fa-solid fa-flask" style="font-size:0.65rem;"></i> Simulação</span>`;
            else if (tStatus) labelStatus = `<span class="status-badge">${tStatus.charAt(0).toUpperCase() + tStatus.slice(1)}</span>`;

            let parcelaInfo = "";
            let fixoOrigem = t.gastoFixoId ? saidasFixas.find(g => g.id === t.gastoFixoId) : (t.entradaFixaId ? entradasFixas.find(g => g.id === t.entradaFixaId) : null);
            if (fixoOrigem && fixoOrigem.fim) {
                const [anoIni, mesIni] = fixoOrigem.inicio.split('-');
                const [anoFim, mesFim] = fixoOrigem.fim.split('-');
                const totalParcelas = (parseInt(anoFim) - parseInt(anoIni)) * 12 + (parseInt(mesFim) - parseInt(mesIni)) + 1;
                const tMes = t.data.substring(0, 7);
                const [anoT, mesT] = tMes.split('-');
                const parcelaAtual = (parseInt(anoT) - parseInt(anoIni)) * 12 + (parseInt(mesT) - parseInt(mesIni)) + 1;
                if (parcelaAtual > 0 && parcelaAtual <= totalParcelas) {
                    parcelaInfo = `<span style="font-size:0.7rem; color:var(--text-muted); display:block; margin-top:1px;">${parcelaAtual}/${totalParcelas}</span>`;
                }
            }

            const catObj = categorias.find(c => c.nome === t.categoria);
            const corCat = catObj ? catObj.cor : null;
            const iconSistema = isCategoriaInvestimento(t.categoria) ? ' <i class="fa-solid fa-gem" style="color:var(--accent); margin-left:4px; font-size:0.75rem;" title="Categoria do Sistema"></i>' : '';
            const catPill = corCat
                ? `<span class="cat-pill" style="background:${corCat}18; color:var(--text-main);"><span class="cat-dot" style="background:${corCat};"></span>${t.categoria || '—'}${iconSistema}</span>`
                : `<span style="color:var(--text-muted); font-size:0.82rem;">${t.categoria || '—'}${iconSistema}</span>`;

            li.dataset.rawData = t.data;
            li.dataset.rawDesc = t.descricao;
            li.dataset.rawOrigem = t.origem || '';
            li.dataset.rawDetalhes = t.detalhes || '';
            li.dataset.rawCat = t.categoria || '';
            li.dataset.rawCartao = t.cartao || '';
            li.dataset.rawValor = t.valor;
            li.dataset.rawTipo = t.tipo;
            li.dataset.rawStatus = tStatus;
            if (t.docId) li.dataset.docId = t.docId;
            if (t.entradaFixaId) li.dataset.entradaFixaId = t.entradaFixaId;
            if (t.gastoFixoId) li.dataset.gastoFixoId = t.gastoFixoId;
            if (t.isProjection) li.dataset.isProjection = 'true';
            if (t.investimentoId) li.dataset.investimentoId = t.investimentoId;

            li.innerHTML = `
                <span class="col-num">${index + 1}</span>
                <span>${t.data.split('-').reverse().join('/')}</span>
                <span style="display:flex; flex-direction:column; justify-content:center; gap:1px;">
                    <span style="display:flex; align-items:center; gap:5px;">
                        <span>${t.descricao}</span>
                        ${fixoOrigem ? '<i class="fa-solid fa-thumbtack" style="font-size:0.65rem; color:var(--text-muted); transform:rotate(45deg); flex-shrink:0;"></i>' : ''}
                    </span>
                    ${t.origem || t.detalhes ? `<span style="font-size:0.75rem; color:var(--text-faint); max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${t.origem ? 'Origem: '+t.origem : ''}${t.origem && t.detalhes ? ' | ' : ''}${t.detalhes || ''}">${t.origem ? t.origem + (t.detalhes ? ' - ' : '') : ''}${t.detalhes || ''}</span>` : ''}
                    ${parcelaInfo}
                </span>
                <span>${catPill}</span>
                <span style="color:var(--text-muted); font-size:0.82rem;">${(!t.cartao || t.cartao === 'nenhum' || t.cartao === '-') ? 'Débito/pix/dinheiro' : t.cartao}</span>
                <span class="col-valor ${t.tipo === 'entrada' ? 'entrada' : 'saida'}">${sinal} ${valorFormatado}</span>
                <span>${labelStatus}</span>
                <span class="col-acoes">
                    <button class="btn-excluir" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                </span>
            `;
            listaTransacoes.appendChild(li);
        });
    }

    atualizarResumo(transacoesFiltradas, navYYYYMM, todasTransacoes.filter(t => t.data.startsWith(prefixoData)));
}

// --- Filter Listeners ---
toggleSimulacao.addEventListener('change', () => { localStorage.setItem('verSimulacoes', toggleSimulacao.checked); renderizarLista(); });
filtroCategoria.addEventListener('change', renderizarLista);
filtroCartao.addEventListener('change', renderizarLista);
filtroBusca.addEventListener('input', renderizarLista);
const buscaEntradasFixas = document.getElementById('busca-entradas-fixas');
const buscaSaidasFixas = document.getElementById('busca-saidas-fixas');
if(buscaEntradasFixas) buscaEntradasFixas.addEventListener('input', (e) => renderizarListaEntradasFixas(e.target.value));
if(buscaSaidasFixas) buscaSaidasFixas.addEventListener('input', (e) => renderizarListaSaidasFixas(e.target.value));

filtroTipo.addEventListener('change', () => { atualizarFiltroCategorias(); renderizarLista(); });
document.getElementById('btn-limpar-filtros').addEventListener('click', (e) => {
    e.currentTarget.classList.add('anim-destroy');
    setTimeout(() => e.currentTarget.classList.remove('anim-destroy'), 400);
    filtroBusca.value = ''; filtroTipo.value = ''; filtroCategoria.value = ''; filtroCartao.value = ''; filtroStatus.value = '';
    atualizarFiltroCategorias(); renderizarLista();
});
filtroStatus.addEventListener('change', (e) => {
    if (e.target.value === 'prevista' || e.target.value === 'simulacao') {
        toggleSimulacao.checked = true;
        localStorage.setItem('verSimulacoes', 'true');
    }
    renderizarLista();
});

window.alternarStatusRapido = async (id, statusAtual, docId) => {
    if (!userIdLogado) return;
    if (id.startsWith('proj_')) {
        alert("Não é possível alterar o status de um lançamento projetado. Salve-o primeiro.");
        return;
    }
    const incluirSimulacoes = toggleSimulacao.checked;
    let novoStatus;
    if (incluirSimulacoes) {
        if (statusAtual === 'prevista') novoStatus = 'realizada';
        else if (statusAtual === 'realizada') novoStatus = 'simulacao';
        else novoStatus = 'prevista';
    } else {
        if (statusAtual === 'prevista') novoStatus = 'realizada';
        else novoStatus = 'prevista';
    }

    if (!docId) return;
    try {
        const docRef = doc(window.db, "dados_mensais", docId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            let arr = docSnap.data().transacoes || [];
            const idx = arr.findIndex(tx => tx.id === id);
            if (idx !== -1) {
                arr[idx].status = novoStatus;
                await updateDoc(docRef, { transacoes: arr });
            }
        }
    } catch (error) {
        console.error("Erro ao alterar status:", error);
    }
};

// --- Row Click: open Edit Modal ---
listaTransacoes.addEventListener('click', async (e) => {
    const btnExcluir = e.target.closest('.btn-excluir');
    const li = e.target.closest('li');
    if (!li || li.classList.contains('empty-state')) return;
    const idTransacao = li.getAttribute('data-id');

    if (btnExcluir) {
        const isProjecao = idTransacao.startsWith('proj');
        const transacaoOriginal = transacoes.find(t => t.id === idTransacao);
        const isFixoSalvo = transacaoOriginal && (transacaoOriginal.entradaFixaId || transacaoOriginal.gastoFixoId);

        const deletarComum = async () => {
            if (transacaoOriginal && transacaoOriginal.docId) {
                const docRef = doc(window.db, "dados_mensais", transacaoOriginal.docId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    let arr = docSnap.data().transacoes || [];
                    arr = arr.filter(t => t.id !== idTransacao);
                    await updateDoc(docRef, { transacoes: arr });
                }
            }
        };

        const deletarFixoDesteMes = async () => {
            const mesAcao = `${dataNavegacao.getFullYear()}-${String(dataNavegacao.getMonth() + 1).padStart(2, '0')}`;
            const docId = `${userIdLogado}_${mesAcao}`;
            if (isProjecao) {
                const isEntrada = idTransacao.startsWith('proje_');
                const fixoId = idTransacao.split('_')[1];
                const idExclusao = Date.now().toString(36) + Math.random().toString(36).substr(2);
                const novosDados = { id: idExclusao, status: 'excluida', criadoEm: new Date().toISOString(), data: `${mesAcao}-01`, valor: 0, descricao: 'Excluída', userId: userIdLogado };
                if (isEntrada) novosDados.entradaFixaId = fixoId;
                else novosDados.gastoFixoId = fixoId;
                await setDoc(doc(window.db, "dados_mensais", docId), { userId: userIdLogado, mes: mesAcao, transacoes: arrayUnion(novosDados) }, { merge: true });
            } else {
                if (transacaoOriginal && transacaoOriginal.docId) {
                    const docRef = doc(window.db, "dados_mensais", transacaoOriginal.docId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        let arr = docSnap.data().transacoes || [];
                        const idx = arr.findIndex(x => x.id === idTransacao);
                        if (idx !== -1) { arr[idx].status = 'excluida'; await updateDoc(docRef, { transacoes: arr }); }
                    }
                }
            }
        };

        if (isProjecao || isFixoSalvo) {
            const modalAviso = document.getElementById('modal-aviso-edicao-fixo');
            document.getElementById('aviso-edicao-titulo').innerText = 'Aviso de Exclusão';
            document.getElementById('aviso-edicao-texto').innerHTML = 'Você está excluindo uma ocorrência de um valor fixo. Esta modificação será aplicada <strong>apenas neste mês específico</strong>.<br><br>Para excluí-lo definitivamente de todos os meses, faça a exclusão através das Configurações (⚙️).';
            modalAviso.style.display = 'flex';
            const btnConfirmar = document.getElementById('btn-confirmar-edicao-fixo');
            const btnCancelar = document.getElementById('btn-cancelar-edicao-fixo');
            const btnFechar = document.getElementById('fechar-modal-aviso');
            const limparModal = () => {
                modalAviso.style.display = 'none';
                btnConfirmar.replaceWith(btnConfirmar.cloneNode(true));
                btnCancelar.replaceWith(btnCancelar.cloneNode(true));
                btnFechar.replaceWith(btnFechar.cloneNode(true));
            };
            document.getElementById('btn-confirmar-edicao-fixo').onclick = async () => { limparModal(); await deletarFixoDesteMes(); };
            document.getElementById('btn-cancelar-edicao-fixo').onclick = limparModal;
            document.getElementById('fechar-modal-aviso').onclick = limparModal;
        } else {
            confirmarAcao("Excluir Lançamento", "Tem certeza que deseja excluir esta transação?", deletarComum);
        }
        return;
    }

    // Open edit modal
    abrirModalEditar(li);
});

// --- MODAL: NOVO LANÇAMENTO ---
const btnAbrirModalLancamento = document.getElementById('btn-abrir-modal-lancamento');
const modalLancamento = document.getElementById('modal-lancamento');
const formModalLancamento = document.getElementById('form-modal-lancamento');

btnAbrirModalLancamento.addEventListener('click', () => {
    popularModalSelects();
    document.getElementById('modal-data').value = new Date().toISOString().split('T')[0];
    document.getElementById('modal-desc').value = '';
    document.getElementById('modal-valor').value = '';
    document.getElementById('modal-tipo').value = 'saida';
    document.getElementById('modal-status').value = 'prevista';
    document.getElementById('modal-categoria').value = '';
    document.getElementById('modal-cartao').value = '';
    document.getElementById('modal-lancamento-titulo').innerHTML = '<i class="fa-solid fa-plus-circle"></i> Novo Lançamento';
    modalLancamento.style.display = 'flex';
    setTimeout(() => document.getElementById('modal-desc').focus(), 100);
});

document.getElementById('fechar-modal-lancamento').addEventListener('click', () => { modalLancamento.style.display = 'none'; });
document.getElementById('btn-cancelar-lancamento').addEventListener('click', () => { modalLancamento.style.display = 'none'; });

formModalLancamento.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!userIdLogado) return;

    const dataValue = document.getElementById('modal-data').value;
    const descValue = document.getElementById('modal-desc').value;
    const valorValue = parseFloat(document.getElementById('modal-valor').value);
    const catValue = document.getElementById('modal-categoria').value;
    const tipoValue = document.getElementById('modal-tipo').value;
    const cartaoValue = document.getElementById('modal-cartao').value;
    const statusValue = document.getElementById('modal-status').value;

    if (!dataValue || !descValue || isNaN(valorValue)) return;

    const tFinal = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        data: dataValue,
        descricao: descValue,
        valor: valorValue,
        categoria: catValue,
        tipo: tipoValue,
        cartao: cartaoValue,
        status: statusValue,
        criadoEm: new Date().toISOString(),
        userId: userIdLogado
    };

    const catLower = catValue.toLowerCase();
    const catTriggerInvest = catLower.includes('poupança e investimentos') || catLower.includes('resgate');

    const salvar = async (investId = null) => {
        if (investId) {
            tFinal.investimentoId = investId;
            const sinal = catLower.includes('resgate') ? -1 : 1;
            if (window.atualizarSaldoInvestimento) await window.atualizarSaldoInvestimento(investId, tFinal.valor * sinal);
        }
        const mesTransacao = tFinal.data.substring(0, 7);
        const docId = `${userIdLogado}_${mesTransacao}`;
        await setDoc(doc(window.db, "dados_mensais", docId), { userId: userIdLogado, mes: mesTransacao, transacoes: arrayUnion(tFinal) }, { merge: true });
        modalLancamento.style.display = 'none';
        configurarDataPadrao();
        renderizarLista();
    };

    if (catTriggerInvest) {
        solicitarVinculoInvestimento(catValue, salvar);
    } else {
        await salvar();
    }
});

// --- MODAL: EDITAR LANÇAMENTO ---
const modalEditar = document.getElementById('modal-editar-lancamento');
const formEditar = document.getElementById('form-editar-lancamento');

function abrirModalEditar(li) {
    popularModalSelects();

    const idTransacao = li.getAttribute('data-id');
    const tData = li.dataset.rawData;
    const tDesc = li.dataset.rawDesc;
    const tCat = li.dataset.rawCat;
    const tCartao = li.dataset.rawCartao;
    const tValor = li.dataset.rawValor;
    const tTipo = li.dataset.rawTipo;
    const tStatus = li.dataset.rawStatus;
    const docId = li.dataset.docId || '';
    const entradaFixaId = li.dataset.entradaFixaId || '';
    const gastoFixoId = li.dataset.gastoFixoId || '';
    const isProjection = li.dataset.isProjection === 'true';

    document.getElementById('editar-id').value = idTransacao;
    document.getElementById('editar-doc-id').value = docId;
    document.getElementById('editar-fixo-type').value = entradaFixaId ? 'entrada' : (gastoFixoId ? 'saida' : '');
    document.getElementById('editar-fixo-id').value = entradaFixaId || gastoFixoId || '';

    document.getElementById('editar-data').value = tData;
    document.getElementById('editar-desc').value = tDesc;
    document.getElementById('editar-origem').value = li.dataset.rawOrigem || '';
    document.getElementById('editar-detalhes').value = li.dataset.rawDetalhes || '';
    document.getElementById('editar-valor').value = tValor;
    document.getElementById('editar-tipo').value = tTipo;
    document.getElementById('editar-status').value = tStatus;

    // Set categoria, add if not found
    const catSel = document.getElementById('editar-categoria');
    if (tCat && !Array.from(catSel.options).some(o => o.value === tCat)) {
        catSel.appendChild(new Option(tCat, tCat));
    }
    catSel.value = tCat || '';

    // Set cartao, add if not found
    const cartaoSel = document.getElementById('editar-cartao');
    if (tCartao && !Array.from(cartaoSel.options).some(o => o.value === tCartao)) {
        cartaoSel.appendChild(new Option(tCartao, tCartao));
    }
    cartaoSel.value = tCartao || '';

    modalEditar.style.display = 'flex';
    setTimeout(() => document.getElementById('editar-desc').focus(), 100);
}

document.getElementById('fechar-modal-editar').addEventListener('click', () => { modalEditar.style.display = 'none'; });
document.getElementById('btn-cancelar-editar').addEventListener('click', () => { modalEditar.style.display = 'none'; });

// Delete button inside edit modal
document.getElementById('btn-excluir-do-modal').addEventListener('click', async () => {
    const idTransacao = document.getElementById('editar-id').value;
    const docId = document.getElementById('editar-doc-id').value;
    const fixoType = document.getElementById('editar-fixo-type').value;
    const fixoId = document.getElementById('editar-fixo-id').value;
    const isProjecao = idTransacao.startsWith('proj');
    const transacaoOriginal = transacoes.find(t => t.id === idTransacao);
    const isFixoSalvo = (transacaoOriginal && (transacaoOriginal.entradaFixaId || transacaoOriginal.gastoFixoId)) || !!fixoId;

    modalEditar.style.display = 'none';

    const deletarComum = async () => {
        if (docId) {
            const docRef = doc(window.db, "dados_mensais", docId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                let arr = docSnap.data().transacoes || [];
                arr = arr.filter(t => t.id !== idTransacao);
                await updateDoc(docRef, { transacoes: arr });
            }
        }
    };

    const deletarFixoDesteMes = async () => {
        const mesAcao = `${dataNavegacao.getFullYear()}-${String(dataNavegacao.getMonth() + 1).padStart(2, '0')}`;
        const dId = `${userIdLogado}_${mesAcao}`;
        if (isProjecao) {
            const isEntrada = idTransacao.startsWith('proje_');
            const fId = idTransacao.split('_')[1];
            const idExclusao = Date.now().toString(36) + Math.random().toString(36).substr(2);
            const novosDados = { id: idExclusao, status: 'excluida', criadoEm: new Date().toISOString(), data: `${mesAcao}-01`, valor: 0, descricao: 'Excluída', userId: userIdLogado };
            if (isEntrada) novosDados.entradaFixaId = fId; else novosDados.gastoFixoId = fId;
            await setDoc(doc(window.db, "dados_mensais", dId), { userId: userIdLogado, mes: mesAcao, transacoes: arrayUnion(novosDados) }, { merge: true });
        } else {
            if (docId) {
                const docRef = doc(window.db, "dados_mensais", docId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    let arr = docSnap.data().transacoes || [];
                    const idx = arr.findIndex(x => x.id === idTransacao);
                    if (idx !== -1) { arr[idx].status = 'excluida'; await updateDoc(docRef, { transacoes: arr }); }
                }
            }
        }
    };

    if (isProjecao || isFixoSalvo) {
        const modalAviso = document.getElementById('modal-aviso-edicao-fixo');
        document.getElementById('aviso-edicao-titulo').innerText = 'Aviso de Exclusão';
        document.getElementById('aviso-edicao-texto').innerHTML = 'Você está excluindo uma ocorrência de um valor fixo. Esta modificação será aplicada <strong>apenas neste mês específico</strong>.<br><br>Para excluí-lo definitivamente, use as Configurações (⚙️).';
        modalAviso.style.display = 'flex';
        const btnC = document.getElementById('btn-confirmar-edicao-fixo');
        const btnX = document.getElementById('btn-cancelar-edicao-fixo');
        const btnF = document.getElementById('fechar-modal-aviso');
        const limpar = () => {
            modalAviso.style.display = 'none';
            btnC.replaceWith(btnC.cloneNode(true));
            btnX.replaceWith(btnX.cloneNode(true));
            btnF.replaceWith(btnF.cloneNode(true));
        };
        document.getElementById('btn-confirmar-edicao-fixo').onclick = async () => { limpar(); await deletarFixoDesteMes(); };
        document.getElementById('btn-cancelar-edicao-fixo').onclick = limpar;
        document.getElementById('fechar-modal-aviso').onclick = limpar;
    } else {
        confirmarAcao("Excluir Lançamento", "Tem certeza que deseja excluir esta transação?", deletarComum);
    }
});

formEditar.addEventListener('submit', async (e) => {
    e.preventDefault();

    const idTransacao = document.getElementById('editar-id').value;
    const docId = document.getElementById('editar-doc-id').value;
    const fixoId = document.getElementById('editar-fixo-id').value;
    const fixoType = document.getElementById('editar-fixo-type').value;
    const isProjecao = idTransacao.startsWith('proj');
    const transacaoOriginal = transacoes.find(t => t.id === idTransacao);
    const isFixoSalvo = (transacaoOriginal && (transacaoOriginal.entradaFixaId || transacaoOriginal.gastoFixoId)) || !!fixoId;

    const novosDados = {
        data: document.getElementById('editar-data').value,
        descricao: document.getElementById('editar-desc').value,
        origem: document.getElementById('editar-origem').value.trim(),
        detalhes: document.getElementById('editar-detalhes').value.trim(),
        categoria: document.getElementById('editar-categoria').value,
        cartao: document.getElementById('editar-cartao').value,
        tipo: document.getElementById('editar-tipo').value,
        valor: parseFloat(document.getElementById('editar-valor').value),
        status: document.getElementById('editar-status').value
    };

    const mudouStatus = transacaoOriginal && String(novosDados.status) !== String(normalizarStatus(transacaoOriginal));
    const mudouAlgoAlemDoStatus = transacaoOriginal && (
        String(novosDados.descricao).trim() !== String(transacaoOriginal.descricao || '').trim() ||
        String(novosDados.categoria) !== String(transacaoOriginal.categoria || '') ||
        String(novosDados.cartao) !== String(transacaoOriginal.cartao || '') ||
        parseFloat(novosDados.valor) !== parseFloat(transacaoOriginal.valor) ||
        String(novosDados.data) !== String(transacaoOriginal.data) ||
        String(novosDados.tipo) !== String(transacaoOriginal.tipo)
    );

    const executarSalvamento = async () => {
        const catLower = novosDados.categoria.toLowerCase();
        const catTriggerInvest = (catLower.includes('poupança e investimentos') || catLower.includes('resgate')) && transacaoOriginal && !transacaoOriginal.investimentoId;

        const finalizar = async (investId = null) => {
            const novoId = isProjecao ? Date.now().toString(36) + Math.random().toString(36).substr(2) : idTransacao;
            const tFinal = { id: novoId, ...novosDados };

            if (investId) {
                tFinal.investimentoId = investId;
                const sinal = tFinal.categoria.toLowerCase().includes('resgate') ? -1 : 1;
                if (window.atualizarSaldoInvestimento) await window.atualizarSaldoInvestimento(investId, tFinal.valor * sinal);
            }

            if (isProjecao) {
                const isEntrada = idTransacao.startsWith('proje_');
                const fxId = idTransacao.split('_')[1];
                if (isEntrada) tFinal.entradaFixaId = fxId; else tFinal.gastoFixoId = fxId;
                tFinal.criadoEm = new Date().toISOString();
                tFinal.userId = userIdLogado;
                const mesTransacao = tFinal.data.substring(0, 7);
                const dId = `${userIdLogado}_${mesTransacao}`;
                await setDoc(doc(window.db, "dados_mensais", dId), { userId: userIdLogado, mes: mesTransacao, transacoes: arrayUnion(tFinal) }, { merge: true });
            } else if (docId) {
                const oldMes = transacaoOriginal.data.substring(0, 7);
                const newMes = tFinal.data.substring(0, 7);

                if (oldMes === newMes) {
                    const docRef = doc(window.db, "dados_mensais", docId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        let arr = docSnap.data().transacoes || [];
                        const idx = arr.findIndex(x => x.id === idTransacao);
                        if (idx !== -1) {
                            arr[idx] = { ...arr[idx], ...novosDados };
                            if (investId) arr[idx].investimentoId = investId;
                            await updateDoc(docRef, { transacoes: arr });
                        }
                    }
                } else {
                    const oldDocRef = doc(window.db, "dados_mensais", docId);
                    const oldSnap = await getDoc(oldDocRef);
                    let objToMove = null;
                    if (oldSnap.exists()) {
                        let arr = oldSnap.data().transacoes || [];
                        objToMove = arr.find(x => x.id === idTransacao);
                        arr = arr.filter(x => x.id !== idTransacao);
                        await updateDoc(oldDocRef, { transacoes: arr });
                    }
                    if (objToMove) {
                        const newDocId = `${userIdLogado}_${newMes}`;
                        const tNova = { ...objToMove, ...novosDados };
                        if (investId) tNova.investimentoId = investId;
                        await setDoc(doc(window.db, "dados_mensais", newDocId), { userId: userIdLogado, mes: newMes, transacoes: arrayUnion(tNova) }, { merge: true });
                    }
                }
            }
            modalEditar.style.display = 'none';
            renderizarLista();
        };

        if (catTriggerInvest) {
            solicitarVinculoInvestimento(novosDados.categoria, finalizar);
        } else {
            await finalizar();
        }
    };

    if ((isProjecao || isFixoSalvo) && mudouAlgoAlemDoStatus) {
        modalEditar.style.display = 'none';
        const modalAviso = document.getElementById('modal-aviso-edicao-fixo');
        document.getElementById('aviso-edicao-titulo').innerText = 'Aviso de Edição';
        document.getElementById('aviso-edicao-texto').innerHTML = 'Você está alterando uma receita/despesa fixa. Esta modificação será aplicada <strong>apenas neste mês específico</strong>.<br><br>Para alterar todos os meses futuros, use as Configurações (⚙️).';
        modalAviso.style.display = 'flex';
        const btnC = document.getElementById('btn-confirmar-edicao-fixo');
        const btnX = document.getElementById('btn-cancelar-edicao-fixo');
        const btnF = document.getElementById('fechar-modal-aviso');
        const limpar = () => {
            modalAviso.style.display = 'none';
            btnC.replaceWith(btnC.cloneNode(true));
            btnX.replaceWith(btnX.cloneNode(true));
            btnF.replaceWith(btnF.cloneNode(true));
        };
        document.getElementById('btn-confirmar-edicao-fixo').addEventListener('click', async () => { limpar(); await executarSalvamento(); });
        document.getElementById('btn-cancelar-edicao-fixo').addEventListener('click', () => { limpar(); renderizarLista(); });
        document.getElementById('fechar-modal-aviso').addEventListener('click', () => { limpar(); renderizarLista(); });
    } else {
        try { await executarSalvamento(); } catch (err) { console.error("Erro ao salvar:", err); }
    }
});

// --- Firebase Sync ---
function inicializarSincronizacao() {
    if (!window.db || !userIdLogado) return;
    limparSincronizacao();

    const qDadosMensais = query(collection(window.db, "dados_mensais"), where("userId", "==", userIdLogado));
    listenersAtivos.push(onSnapshot(qDadosMensais, (snapshot) => {
        transacoes = [];
        snapshot.forEach((docSnap) => {
            const dados = docSnap.data();
            if (dados.transacoes && Array.isArray(dados.transacoes)) {
                const transacoesDesteMes = dados.transacoes.map(t => ({...t, docId: docSnap.id}));
                transacoes.push(...transacoesDesteMes);
            }
        });
        renderizarLista();
    }, erro => console.error("Erro transacoes:", erro)));

    const qCategorias = query(collection(window.db, "categorias"), where("userId", "==", userIdLogado));
    listenersAtivos.push(onSnapshot(qCategorias, (snapshot) => {
        categorias = [];
        snapshot.forEach((doc) => categorias.push({ id: doc.id, ...doc.data() }));
        renderizarListaCategorias();
        carregarOpcoesFormulario();
        renderizarLista();
    }));

    const qCartoes = query(collection(window.db, "cartoes"), where("userId", "==", userIdLogado));
    listenersAtivos.push(onSnapshot(qCartoes, (snapshot) => {
        cartoes = [];
        snapshot.forEach((doc) => cartoes.push({ id: doc.id, ...doc.data() }));
        renderizarListaCartoes();
        carregarOpcoesFormulario();
        renderizarLista();
    }));

    const qEntradas = query(collection(window.db, "entradasFixas"), where("userId", "==", userIdLogado));
    listenersAtivos.push(onSnapshot(qEntradas, (snapshot) => {
        entradasFixas = [];
        snapshot.forEach((doc) => entradasFixas.push({ id: doc.id, ...doc.data() }));
        renderizarListaEntradasFixas();
        renderizarLista();
    }));

    const qSaidas = query(collection(window.db, "gastosFixos"), where("userId", "==", userIdLogado));
    listenersAtivos.push(onSnapshot(qSaidas, (snapshot) => {
        saidasFixas = [];
        snapshot.forEach((doc) => saidasFixas.push({ id: doc.id, ...doc.data() }));
        renderizarListaSaidasFixas();
        renderizarLista();
    }));
}

// --- Vínculo de Investimento ---
let listaInvestimentosLocal = [];
window.addEventListener('investimentosAtualizados', (e) => { listaInvestimentosLocal = e.detail; });

function solicitarVinculoInvestimento(categoria, callback) {
    const modal = document.getElementById('modal-vinculo-investimento');
    const listaUI = document.getElementById('lista-opcoes-investimento');
    const titulo = document.getElementById('titulo-modal-vinculo');
    const texto = document.getElementById('texto-modal-vinculo');
    const secaoNovo = document.getElementById('secao-novo-investimento-rapido');
    const inputNovo = document.getElementById('in-novo-invest-rapido');

    const catLower = categoria.toLowerCase();
    titulo.innerText = catLower.includes('resgate') ? 'Resgatar de qual investimento?' : 'Direcionar para qual investimento?';
    texto.innerText = catLower.includes('resgate')
        ? 'Selecione o investimento de onde este valor está sendo retirado.'
        : 'Selecione o investimento para onde este valor está sendo enviado.';

    const renderizarOpcoes = () => {
        listaUI.innerHTML = listaInvestimentosLocal.map(inv => `
            <button class="btn-vinculo-item" data-id="${inv.id}" style="width:100%; padding:1rem; background:var(--surface-2); border:1px solid var(--border); border-radius:10px; color:var(--text-main); text-align:left; cursor:pointer; display:flex; justify-content:space-between; align-items:center; transition:0.2s;">
                <div style="display:flex; flex-direction:column; gap:2px;">
                    <span style="font-weight:600;">${inv.nome}</span>
                    ${inv.rendimento ? `<span style="font-size:0.7rem; color:var(--accent);">${inv.rendimento}</span>` : ''}
                </div>
                <span style="font-size:0.8rem; color:var(--text-muted);">R$ ${inv.saldo ? inv.saldo.toLocaleString('pt-BR', {minimumFractionDigits: 2}) : '0,00'}</span>
            </button>
        `).join('');

        listaUI.innerHTML += `<button id="btn-abrir-novo-rapido" style="width:100%; padding:1rem; background:none; border:1px dashed var(--border); border-radius:10px; color:var(--accent); cursor:pointer; transition:0.2s; margin-top:8px; font-size:0.9rem;">
            <i class="fa-solid fa-plus"></i> Criar Novo Investimento
        </button>`;
    };

    renderizarOpcoes();
    modal.style.display = 'flex';
    secaoNovo.style.display = 'none';

    const fechar = () => {
        modal.style.display = 'none';
        const newModal = modal.cloneNode(true);
        modal.parentNode.replaceChild(newModal, modal);
    };

    document.getElementById('modal-vinculo-investimento').addEventListener('click', async (e) => {
        const btnItem = e.target.closest('.btn-vinculo-item');
        const btnAbrirNovo = e.target.closest('#btn-abrir-novo-rapido');
        const btnPularLocal = e.target.closest('#btn-pular-vinculo');
        const btnFecharLocal = e.target.closest('#fechar-modal-vinculo');
        const btnCriarLocal = e.target.closest('#btn-criar-vincular');

        if (btnItem) {
            const id = btnItem.getAttribute('data-id');
            fechar(); callback(id);
        } else if (btnAbrirNovo) {
            secaoNovo.style.display = 'flex'; inputNovo.focus();
        } else if (btnPularLocal) {
            fechar(); callback(null);
        } else if (btnFecharLocal) {
            fechar(); callback(null);
        } else if (btnCriarLocal) {
            const nome = inputNovo.value.trim();
            if (!nome) return;
            try {
                const docRef = await addDoc(collection(window.db, "investimentos"), { nome, saldo: 0, userId: userIdLogado, createdAt: new Date().toISOString() });
                fechar(); callback(docRef.id);
            } catch (error) { console.error("Erro ao criar investimento rápido:", error); }
        }
    });
}

// --- Setup ---
configurarDataPadrao();
atualizarCorTipo();
atualizarInterfaceMes();
carregarOpcoesFormulario();
