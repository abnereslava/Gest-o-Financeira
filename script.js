import { collection, addDoc, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

// --- Seletores DOM ---
const btnConfig = document.getElementById('btn-config');
const modalConfiguracoes = document.getElementById('modal-configuracoes');
const closeBtns = document.querySelectorAll('.close-btn');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const listaTransacoes = document.getElementById('lista-transacoes');
const toggleSimulacao = document.getElementById('toggle-ver-simulacoes');
const filtroCategoria = document.getElementById('filtro-categoria');
const filtroCartao = document.getElementById('filtro-cartao');
const filtroStatus = document.getElementById('filtro-status');

const formInline = document.getElementById('form-inline');
const selectCategoria = document.getElementById('in-categoria');
const selectCartao = document.getElementById('in-cartao');
const selectTipo = document.getElementById('in-tipo');

const formCategoria = document.getElementById('form-categoria');
const listaCategoriasUI = document.getElementById('lista-categorias');
const formCartao = document.getElementById('form-cartao');
const listaCartoesUI = document.getElementById('lista-cartoes');
const formEntradasFixas = document.getElementById('form-entradas-fixas');
const listaEntradasFixasUI = document.getElementById('lista-entradas-fixas');
const formSaidasFixas = document.getElementById('form-saidas-fixas');
const listaSaidasFixasUI = document.getElementById('lista-saidas-fixas');

const btnMesAnterior = document.getElementById('btn-mes-anterior');
const btnMesProximo = document.getElementById('btn-mes-proximo');
const labelMesAtual = document.getElementById('mes-atual-label');
const inputMesPicker = document.getElementById('input-mes-picker');

// --- Estado ---
let transacoes = [];
let ultimaDataInserida = new Date().toISOString().split('T')[0]; 
let dataNavegacao = new Date();
const nomesMeses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// Bases agora vazias/limpas para você preencher pelo app
let categorias = [];
let cartoes = []; // Inicia vazio
let entradasFixas = []; // Inicia vazio
let saidasFixas = []; // Inicia vazio
// Ordenação Multicritério
let listSortConfig = [{ col: 'data', dir: 'desc' }];

document.querySelectorAll('#lista-header .sortable').forEach(span => {
    span.addEventListener('click', () => {
        const col = span.getAttribute('data-sort');
        const existingIndex = listSortConfig.findIndex(s => s.col === col);
        
        if (existingIndex === 0) {
            const defaultDir = (col === 'data' || col === 'valor') ? 'desc' : 'asc';
            if (listSortConfig[0].dir === defaultDir) {
                listSortConfig[0].dir = defaultDir === 'asc' ? 'desc' : 'asc';
            } else {
                listSortConfig.shift(); // Remove desativando o filtro
            }
        } else {
            if (existingIndex > 0) listSortConfig.splice(existingIndex, 1);
            // Ao clicar pela primeira vez, asc para texto e desc para números/datas
            const defaultDir = (col === 'data' || col === 'valor') ? 'desc' : 'asc';
            listSortConfig.unshift({ col: col, dir: defaultDir });
        }
        renderizarLista();
    });
});

// --- Funções Auxiliares e UI ---
function normalizarStatus(t) {
    if (t.status) return t.status; 
    if (t.simulacao) return 'simulacao';
    if (t.pago) return 'realizada';
    return 'prevista'; 
}

// Coloração do +/-
function atualizarCorTipo() {
    if (selectTipo.value === 'entrada') {
        selectTipo.style.color = 'var(--success)';
        selectTipo.style.borderColor = 'var(--success)';
    } else {
        selectTipo.style.color = 'var(--danger)';
        selectTipo.style.borderColor = 'var(--danger)';
    }
    if (typeof atualizarCategoriasSelect === 'function') atualizarCategoriasSelect();
}
selectTipo.addEventListener('change', atualizarCorTipo);

function atualizarInterfaceMes() {
    labelMesAtual.innerText = `${nomesMeses[dataNavegacao.getMonth()]} ${dataNavegacao.getFullYear()}`;
    const mesFormatado = String(dataNavegacao.getMonth() + 1).padStart(2, '0');
    if (inputMesPicker) inputMesPicker.value = `${dataNavegacao.getFullYear()}-${mesFormatado}`;
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

btnConfig.addEventListener('click', () => modalConfiguracoes.style.display = 'flex');
closeBtns.forEach(btn => btn.addEventListener('click', (e) => e.target.closest('.modal').style.display = 'none'));
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
    selectCategoria.innerHTML = '';
    const tipoAtual = selectTipo.value;
    const catOrdenadas = [...categorias].sort((a,b) => a.nome.localeCompare(b.nome));
    const catFiltradas = catOrdenadas.filter(c => !c.tipo || c.tipo === 'ambas' || c.tipo === tipoAtual);
    catFiltradas.forEach(cat => {
        selectCategoria.appendChild(new Option(cat.nome, cat.nome));
    });
}

function carregarOpcoesFormulario() {
    atualizarCategoriasSelect();
    selectCartao.innerHTML = '<option value="">Nenhum (Pix/Dinheiro)</option>';
    filtroCategoria.innerHTML = '<option value="">Todas Categorias</option>';
    filtroCartao.innerHTML = '<option value="">Todos Cartões</option>';
    
    const catOrdenadas = [...categorias].sort((a,b) => a.nome.localeCompare(b.nome));
    const cartoesOrdenados = [...cartoes].sort((a,b) => a.nome.localeCompare(b.nome));

    catOrdenadas.forEach(cat => {
        filtroCategoria.appendChild(new Option(cat.nome, cat.nome));
    });
    cartoesOrdenados.forEach(c => {
        selectCartao.appendChild(new Option(c.nome, c.nome));
        filtroCartao.appendChild(new Option(c.nome, c.nome));
    });

    const selectCatEntrada = document.getElementById('nova-entrada-fixa-cat');
    const selectCatSaida = document.getElementById('nova-saida-fixa-cat');
    const selectsCartao = [document.getElementById('nova-entrada-fixa-cartao'), document.getElementById('nova-saida-fixa-cartao')];
    
    if (selectCatEntrada) {
        selectCatEntrada.innerHTML = '<option value="">Categoria...</option>';
        catOrdenadas.filter(c => !c.tipo || c.tipo === 'ambas' || c.tipo === 'entrada').forEach(c => selectCatEntrada.appendChild(new Option(c.nome, c.nome)));
    }
    if (selectCatSaida) {
        selectCatSaida.innerHTML = '<option value="">Categoria...</option>';
        catOrdenadas.filter(c => !c.tipo || c.tipo === 'ambas' || c.tipo === 'saida').forEach(c => selectCatSaida.appendChild(new Option(c.nome, c.nome)));
    }
    
    selectsCartao.forEach(sel => { if(sel) { sel.innerHTML = '<option value="">Cartão (Opcional)</option>'; cartoesOrdenados.forEach(c => sel.appendChild(new Option(c.nome, c.nome))); } });
}

// Modal helper
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

// Renderizadores de Listas nas Configurações
function renderizarListaCategorias() {
    const listaEntrada = document.getElementById('lista-categorias-entrada');
    const listaSaida = document.getElementById('lista-categorias-saida');
    const listaAmbas = document.getElementById('lista-categorias-ambas');
    
    if (listaEntrada) listaEntrada.innerHTML = '';
    if (listaSaida) listaSaida.innerHTML = '';
    if (listaAmbas) listaAmbas.innerHTML = '';
    
    const catOrdenadas = [...categorias].sort((a,b) => a.nome.localeCompare(b.nome));
    catOrdenadas.forEach(cat => {
        let tipoBadge = '';
        if (cat.tipo === 'entrada') tipoBadge = '<span style="font-size:0.7rem; background:#d1fae5; color:#065f46; padding:2px 5px; border-radius:4px; margin-left:5px;">Entrada</span>';
        else if (cat.tipo === 'saida') tipoBadge = '<span style="font-size:0.7rem; background:#fee2e2; color:#991b1b; padding:2px 5px; border-radius:4px; margin-left:5px;">Saída</span>';
        
        const htmlLi = `
        <li style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 15px; height: 15px; border-radius: 50%; background-color: ${cat.cor};"></div>
                <span class="cat-nome-texto">${cat.nome}</span>${tipoBadge}
            </div>
            <div class="acoes-linha" style="margin-top: 0; padding-top: 0; border: none;">
                <button class="btn-editar-categoria" data-id="${cat.id}" data-cor="${cat.cor}" data-tipo="${cat.tipo || 'ambas'}" title="Editar Categoria" style="color: var(--accent);"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-excluir-config" data-id="${cat.id}" data-col="categorias" title="Excluir Categoria" style="color: var(--danger);"><i class="fa-solid fa-trash"></i></button>
            </div>
        </li>`;

        if (cat.tipo === 'entrada' && listaEntrada) listaEntrada.innerHTML += htmlLi;
        else if (cat.tipo === 'saida' && listaSaida) listaSaida.innerHTML += htmlLi;
        else if (listaAmbas) listaAmbas.innerHTML += htmlLi;
    });
}
function renderizarListaCartoes() {
    listaCartoesUI.innerHTML = '';
    const cartoesOrdenados = [...cartoes].sort((a,b) => a.nome.localeCompare(b.nome));
    cartoesOrdenados.forEach(c => {
        const tipoLabel = c.tipo === 'credito' ? 'Crédito' : (c.tipo === 'debito' ? 'Débito' : 'Cartão');
        listaCartoesUI.innerHTML += `
        <li style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <div style="display: flex; align-items: center; gap: 10px;">
                <i class="fa-solid fa-credit-card" style="color: var(--text-muted)"></i> 
                <span class="cartao-nome-texto">${c.nome}</span>
                <span style="font-size:0.7rem; background:#f3f4f6; color:#4b5563; padding:2px 5px; border-radius:4px; margin-left:5px;">${tipoLabel}</span>
            </div>
            <div class="acoes-linha" style="margin-top: 0; padding-top: 0; border: none;">
                <button class="btn-editar-cartao" data-id="${c.id}" data-tipo="${c.tipo || 'credito'}" title="Editar Cartão" style="color: var(--accent); border: none; background: none; cursor: pointer; padding: 5px;"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-excluir-config" data-id="${c.id}" data-col="cartoes" data-nome="${c.nome}" title="Excluir Cartão" style="color: var(--danger); border: none; background: none; cursor: pointer; padding: 5px;"><i class="fa-solid fa-trash"></i></button>
            </div>
        </li>`;
    });
}
function renderizarListaEntradasFixas() {
    listaEntradasFixasUI.innerHTML = '';
    entradasFixas.forEach(g => {
        const prazo = g.fim ? `${g.inicio} a ${g.fim}` : `A partir de ${g.inicio}`;
        listaEntradasFixasUI.innerHTML += `
        <li style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 2px; width: 100%;">
                <strong style="color: var(--success);" class="fixo-desc">${g.desc} (R$ <span class="fixo-valor">${parseFloat(g.valor).toFixed(2).replace('.', ',')}</span>)</strong>
                <span style="font-size: 0.8rem; color: var(--text-muted);">Dia <span class="fixo-dia">${g.dia}</span> | ${prazo}</span>
                <input type="hidden" class="fixo-cat" value="${g.categoria || ''}">
                <input type="hidden" class="fixo-cartao" value="${g.cartao || ''}">
                <input type="hidden" class="fixo-inicio" value="${g.inicio || ''}">
                <input type="hidden" class="fixo-fim" value="${g.fim || ''}">
            </div>
            <div class="acoes-linha" style="margin-top: 0; padding-top: 0; border: none; flex-shrink: 0;">
                <button class="btn-editar-fixo-config" data-id="${g.id}" data-col="entradasFixas" title="Editar" style="color: var(--accent); background:none; border:none; cursor:pointer; padding: 5px;"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-excluir-fixo" data-id="${g.id}" data-col="entradasFixas" title="Excluir" style="color: var(--danger); background:none; border:none; cursor:pointer; padding: 5px;"><i class="fa-solid fa-trash"></i></button>
            </div>
        </li>`;
    });
}
function renderizarListaSaidasFixas() {
    listaSaidasFixasUI.innerHTML = '';
    saidasFixas.forEach(g => {
        const prazo = g.fim ? `${g.inicio} a ${g.fim}` : `A partir de ${g.inicio}`;
        listaSaidasFixasUI.innerHTML += `
        <li style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 2px; width: 100%;">
                <strong style="color: var(--danger);" class="fixo-desc">${g.desc} (R$ <span class="fixo-valor">${parseFloat(g.valor).toFixed(2).replace('.', ',')}</span>)</strong>
                <span style="font-size: 0.8rem; color: var(--text-muted);">Dia <span class="fixo-dia">${g.dia}</span> | ${prazo}</span>
                <input type="hidden" class="fixo-cat" value="${g.categoria || ''}">
                <input type="hidden" class="fixo-cartao" value="${g.cartao || ''}">
                <input type="hidden" class="fixo-inicio" value="${g.inicio || ''}">
                <input type="hidden" class="fixo-fim" value="${g.fim || ''}">
            </div>
            <div class="acoes-linha" style="margin-top: 0; padding-top: 0; border: none; flex-shrink: 0;">
                <button class="btn-editar-fixo-config" data-id="${g.id}" data-col="gastosFixos" title="Editar" style="color: var(--accent); background:none; border:none; cursor:pointer; padding: 5px;"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-excluir-fixo" data-id="${g.id}" data-col="gastosFixos" title="Excluir" style="color: var(--danger); background:none; border:none; cursor:pointer; padding: 5px;"><i class="fa-solid fa-trash"></i></button>
            </div>
        </li>`;
    });
}

// Edição e Exclusão nas Configurações
let impactoTimer;
function solicitarImpactoFixo(callback) {
    const modal = document.getElementById('modal-impacto-fixo');
    const btnConfirmar = document.getElementById('btn-confirmar-impacto');
    const btnCancelar = document.getElementById('btn-cancelar-impacto');
    const radios = document.getElementsByName('impacto-fixo');
    radios[0].checked = true; // reset selection

    modal.style.display = 'flex';
    
    // Timer 5s
    let timeLeft = 5;
    btnConfirmar.disabled = true;
    btnConfirmar.innerText = `Confirmar (${timeLeft}s)`;
    
    if (impactoTimer) clearInterval(impactoTimer);
    impactoTimer = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
            clearInterval(impactoTimer);
            btnConfirmar.disabled = false;
            btnConfirmar.innerText = 'Confirmar Alteração';
        } else {
            btnConfirmar.innerText = `Confirmar (${timeLeft}s)`;
        }
    }, 1000);

    const limparModal = () => {
        clearInterval(impactoTimer);
        modal.style.display = 'none';
        btnConfirmar.replaceWith(btnConfirmar.cloneNode(true));
        btnCancelar.replaceWith(btnCancelar.cloneNode(true));
    };

    document.getElementById('btn-confirmar-impacto').addEventListener('click', () => {
        const impacto = Array.from(radios).find(r => r.checked).value;
        limparModal();
        callback(impacto);
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
                transacoes.forEach(async (t) => {
                    if (t[campoFixoId] === id && t.id && !t.isProjection) {
                        await deleteDoc(doc(window.db, "transacoes", t.id));
                    }
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
        
        const desc = li.querySelector('.fixo-desc').childNodes[0].nodeValue.trim().replace(' (R$ ', '');
        const valor = li.querySelector('.fixo-valor').innerText.replace(',', '.');
        const dia = li.querySelector('.fixo-dia').innerText;
        const cat = li.querySelector('.fixo-cat').value;
        const cartao = li.querySelector('.fixo-cartao').value;
        const inicio = li.querySelector('.fixo-inicio').value;
        const fim = li.querySelector('.fixo-fim').value;

        const catOrdenadas = [...categorias].sort((a,b) => a.nome.localeCompare(b.nome));
        const tipoFixo = col === 'entradasFixas' ? 'entrada' : 'saida';
        const catFiltradas = catOrdenadas.filter(c => !c.tipo || c.tipo === 'ambas' || c.tipo === tipoFixo);
        const cartoesOrdenados = [...cartoes].sort((a,b) => a.nome.localeCompare(b.nome));

        let catOptions = '<option value="">Categoria...</option>';
        catFiltradas.forEach(c => catOptions += `<option value="${c.nome}" ${c.nome===cat?'selected':''}>${c.nome}</option>`);
        let cartaoOptions = '<option value="">Cartão (Opcional)</option>';
        cartoesOrdenados.forEach(c => cartaoOptions += `<option value="${c.nome}" ${c.nome===cartao?'selected':''}>${c.nome}</option>`);

        li.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
                <div style="display: flex; gap: 5px;">
                    <input type="text" class="edit-fixo-desc" value="${desc}" style="flex: 2; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;">
                    <input type="number" step="0.01" class="edit-fixo-valor" value="${valor}" style="flex: 1; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;">
                    <input type="number" class="edit-fixo-dia" value="${dia}" min="1" max="31" style="width: 60px; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;">
                </div>
                <div style="display: flex; gap: 5px;">
                    <select class="edit-fixo-cat" style="flex: 1; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;">${catOptions}</select>
                    <select class="edit-fixo-cartao" style="flex: 1; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;">${cartaoOptions}</select>
                </div>
                <div style="display: flex; gap: 5px; align-items: center;">
                    <input type="month" class="edit-fixo-inicio" value="${inicio}" style="flex: 1; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;">
                    <span style="color: var(--text-muted); font-size: 0.8rem;">até</span>
                    <input type="month" class="edit-fixo-fim" value="${fim}" style="flex: 1; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;">
                </div>
                <div style="display: flex; gap: 10px; margin-top: 5px;">
                    <button class="btn-salvar-fixo-config btn-primary" data-id="${id}" data-col="${col}" style="flex: 1; padding: 5px;"><i class="fa-solid fa-check"></i> Salvar</button>
                    <button class="btn-cancelar-fixo-config btn-secondary" style="flex: 1; padding: 5px;">Cancelar</button>
                </div>
            </div>
        `;
    }

    if (btnCancelarFixoConfig) {
        renderizarListaEntradasFixas();
        renderizarListaSaidasFixas();
    }

    if (btnSalvarFixoConfig) {
        const li = btnSalvarFixoConfig.closest('li');
        const id = btnSalvarFixoConfig.getAttribute('data-id');
        const col = btnSalvarFixoConfig.getAttribute('data-col');
        
        const novosDados = {
            desc: li.querySelector('.edit-fixo-desc').value,
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
                transacoes.forEach(async (t) => {
                    if (t[campoFixoId] === id && t.id && !t.isProjection) {
                        const novoDia = String(novosDados.dia).padStart(2, '0');
                        const dataAtualizada = t.data.substring(0, 8) + novoDia; 
                        await updateDoc(doc(window.db, "transacoes", t.id), {
                            descricao: novosDados.desc,
                            valor: novosDados.valor,
                            categoria: novosDados.categoria,
                            cartao: novosDados.cartao,
                            data: dataAtualizada
                        });
                    }
                });
            } else if (impacto === 'frente') {
                const dataNav = new Date(dataNavegacao.getFullYear(), dataNavegacao.getMonth());
                dataNav.setMonth(dataNav.getMonth() - 1);
                const mesPassado = `${dataNav.getFullYear()}-${String(dataNav.getMonth() + 1).padStart(2, '0')}`;
                
                await updateDoc(doc(window.db, col, id), { fim: mesPassado });
                
                novosDados.inicio = `${dataNavegacao.getFullYear()}-${String(dataNavegacao.getMonth() + 1).padStart(2, '0')}`;
                await addDoc(collection(window.db, col), novosDados);
            }
        });
    }

    if (btnExcluirConfig) {
        const col = btnExcluirConfig.getAttribute('data-col');
        const nomeItem = btnExcluirConfig.getAttribute('data-nome');
        const tipoStr = col === 'categorias' ? 'esta categoria' : 'este cartão';
        
        let avisoEmUso = "";
        if (col === 'cartoes' && nomeItem) {
            const emUso = transacoes.some(t => t.cartao === nomeItem && t.status !== 'excluida') || saidasFixas.some(g => g.cartao === nomeItem) || entradasFixas.some(g => g.cartao === nomeItem);
            if (emUso) {
                avisoEmUso = "<br><br><strong style='color:var(--danger)'>⚠️ AVISO: Este cartão está sendo usado em transações ou gastos fixos. Excluí-lo afetará a visualização desses registros.</strong>";
            }
        }
        
        confirmarAcao("Excluir", `Tem certeza que deseja excluir ${tipoStr} permanentemente? Os registros já existentes não serão apagados.${avisoEmUso}`, async () => {
            await deleteDoc(doc(window.db, col, btnExcluirConfig.getAttribute('data-id')));
        });
    }

    if (btnEditarCategoria) {
        const li = btnEditarCategoria.closest('li');
        const id = btnEditarCategoria.getAttribute('data-id');
        const cor = btnEditarCategoria.getAttribute('data-cor');
        const tipo = btnEditarCategoria.getAttribute('data-tipo');
        const nomeTexto = li.querySelector('.cat-nome-texto').innerText;

        li.innerHTML = `
            <div style="display: flex; gap: 5px; width: 100%;">
                <input type="text" class="edit-cat-nome" value="${nomeTexto}" data-old-nome="${nomeTexto}" style="flex: 1; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;">
                <select class="edit-cat-tipo" style="padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;">
                    <option value="ambas" ${tipo==='ambas'?'selected':''}>Ambas</option>
                    <option value="entrada" ${tipo==='entrada'?'selected':''}>Entrada</option>
                    <option value="saida" ${tipo==='saida'?'selected':''}>Saída</option>
                </select>
                <input type="color" class="edit-cat-cor" value="${cor}" style="width: 40px; height: 35px; border: 1px solid var(--border); border-radius: 4px; padding: 0;">
                <button class="btn-salvar-categoria" data-id="${id}" style="color: var(--success); background: none; border: none; cursor: pointer; font-size: 1.1rem; margin-left: 5px;"><i class="fa-solid fa-check"></i></button>
                <button class="btn-cancelar-categoria" style="color: var(--text-muted); background: none; border: none; cursor: pointer; font-size: 1.1rem; margin-left: 5px;"><i class="fa-solid fa-times"></i></button>
            </div>
        `;
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
            transacoes.forEach(async (t) => {
                if (t.categoria === nomeAntigo && t.id && !t.isProjection) {
                    await updateDoc(doc(window.db, "transacoes", t.id), { categoria: novoNome });
                }
            });
            entradasFixas.forEach(async (t) => {
                if (t.categoria === nomeAntigo) await updateDoc(doc(window.db, "entradasFixas", t.id), { categoria: novoNome });
            });
            saidasFixas.forEach(async (t) => {
                if (t.categoria === nomeAntigo) await updateDoc(doc(window.db, "gastosFixos", t.id), { categoria: novoNome });
            });
        }
    }

    if (btnCancelarCategoria) {
        renderizarListaCategorias();
    }

    if (btnEditarCartao) {
        const li = btnEditarCartao.closest('li');
        const id = btnEditarCartao.getAttribute('data-id');
        const tipo = btnEditarCartao.getAttribute('data-tipo');
        const nomeTexto = li.querySelector('.cartao-nome-texto').innerText;

        let avisoEmUso = "";
        const emUso = transacoes.some(t => t.cartao === nomeTexto && t.status !== 'excluida') || saidasFixas.some(g => g.cartao === nomeTexto) || entradasFixas.some(g => g.cartao === nomeTexto);
        if (emUso) {
            avisoEmUso = "<div style='color:var(--danger); font-size: 0.75rem; margin-top: 5px; width: 100%; text-align: left;'>⚠️ Cartão em uso. Edições afetarão lançamentos existentes.</div>";
        }

        li.innerHTML = `
            <div style="display: flex; flex-direction: column; width: 100%;">
                <div style="display: flex; gap: 5px; width: 100%;">
                    <input type="text" class="edit-cartao-nome" value="${nomeTexto}" data-old-nome="${nomeTexto}" style="flex: 1; padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;">
                    <select class="edit-cartao-tipo" style="padding: 0.5rem; border: 1px solid var(--border); border-radius: 4px;">
                        <option value="credito" ${tipo==='credito'?'selected':''}>Crédito</option>
                        <option value="debito" ${tipo==='debito'?'selected':''}>Débito</option>
                    </select>
                    <button class="btn-salvar-cartao" data-id="${id}" style="color: var(--success); background: none; border: none; cursor: pointer; font-size: 1.1rem; margin-left: 5px;"><i class="fa-solid fa-check"></i></button>
                    <button class="btn-cancelar-cartao" style="color: var(--text-muted); background: none; border: none; cursor: pointer; font-size: 1.1rem; margin-left: 5px;"><i class="fa-solid fa-times"></i></button>
                </div>
                ${avisoEmUso}
            </div>
        `;
    }

    if (btnSalvarCartao) {
        const li = btnSalvarCartao.closest('li');
        const id = btnSalvarCartao.getAttribute('data-id');
        const novoNome = li.querySelector('.edit-cartao-nome').value;
        const nomeAntigo = li.querySelector('.edit-cartao-nome').getAttribute('data-old-nome');
        const novoTipo = li.querySelector('.edit-cartao-tipo').value;
        
        await updateDoc(doc(window.db, "cartoes", id), { nome: novoNome, tipo: novoTipo });
        
        if (novoNome !== nomeAntigo) {
            transacoes.forEach(async (t) => {
                if (t.cartao === nomeAntigo && t.id && !t.isProjection) {
                    await updateDoc(doc(window.db, "transacoes", t.id), { cartao: novoNome });
                }
            });
            entradasFixas.forEach(async (t) => {
                if (t.cartao === nomeAntigo) await updateDoc(doc(window.db, "entradasFixas", t.id), { cartao: novoNome });
            });
            saidasFixas.forEach(async (t) => {
                if (t.cartao === nomeAntigo) await updateDoc(doc(window.db, "gastosFixos", t.id), { cartao: novoNome });
            });
        }
    }

    if (btnCancelarCartao) {
        renderizarListaCartoes();
    }
});

// Eventos de Submissão das Configurações
formCategoria.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!window.db) return;
    await addDoc(collection(window.db, "categorias"), {
        nome: document.getElementById('nova-cat-nome').value,
        cor: document.getElementById('nova-cat-cor').value,
        tipo: document.getElementById('nova-cat-tipo').value
    });
    document.getElementById('form-categoria').reset();
});
formCartao.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!window.db) return;
    await addDoc(collection(window.db, "cartoes"), {
        nome: document.getElementById('novo-cartao-nome').value,
        tipo: document.getElementById('novo-cartao-tipo').value
    });
    document.getElementById('form-cartao').reset();
});
formEntradasFixas.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!window.db) return;
    await addDoc(collection(window.db, "entradasFixas"), {
        desc: document.getElementById('nova-entrada-fixa-desc').value,
        valor: parseFloat(document.getElementById('nova-entrada-fixa-valor').value),
        dia: document.getElementById('nova-entrada-fixa-dia').value,
        categoria: document.getElementById('nova-entrada-fixa-cat').value,
        cartao: document.getElementById('nova-entrada-fixa-cartao').value,
        inicio: document.getElementById('nova-entrada-fixa-inicio').value || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
        fim: document.getElementById('nova-entrada-fixa-fim').value
    });
    document.getElementById('form-entradas-fixas').reset();
});
formSaidasFixas.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!window.db) return;
    await addDoc(collection(window.db, "gastosFixos"), { // Mantido na mesma coleção 'gastosFixos' para não perder dados antigos
        desc: document.getElementById('nova-saida-fixa-desc').value,
        valor: parseFloat(document.getElementById('nova-saida-fixa-valor').value),
        dia: document.getElementById('nova-saida-fixa-dia').value,
        categoria: document.getElementById('nova-saida-fixa-cat').value,
        cartao: document.getElementById('nova-saida-fixa-cartao').value,
        inicio: document.getElementById('nova-saida-fixa-inicio').value || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
        fim: document.getElementById('nova-saida-fixa-fim').value
    });
    document.getElementById('form-saidas-fixas').reset();
});

// --- Lógica Principal de Renderização e Cálculos ---
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

function atualizarResumo(transacoesRenderizadas, mesNavString) {
    const mesAnteriorStr = getMesAnterior(mesNavString);

    let totalEntradasMes = 0;
    let totalSaidasVistaMes = 0;
    let totalUsoCartaoMes = 0;
    let totalFaturaAnterior = 0;

    const checkIsCredito = (nomeCartao) => {
        if (!nomeCartao || nomeCartao === '') return false;
        const cObj = cartoes.find(c => c.nome === nomeCartao);
        return cObj && (cObj.tipo === 'credito' || !cObj.tipo); // antigos default para crédito
    };

    // 1. Cálculos do mês atual
    transacoesRenderizadas.forEach(t => {
        if (t.status === 'excluida') return;
        
        if (t.tipo === 'entrada') {
            totalEntradasMes += t.valor;
        } else if (t.tipo === 'saida') {
            if (checkIsCredito(t.cartao)) {
                totalUsoCartaoMes += t.valor; // Cartões (Mês Atual)
            } else {
                totalSaidasVistaMes += t.valor; // Gastos à vista ou Débito
            }
        }
    });

    // 2. Fatura do mês anterior (Cartão Mês Anterior)
    transacoes.forEach(t => {
        if (t.status === 'excluida') return;
        const tMes = t.data.substring(0, 7);
        if (tMes === mesAnteriorStr && t.tipo === 'saida' && checkIsCredito(t.cartao)) {
            if (normalizarStatus(t) !== 'simulacao') {
                totalFaturaAnterior += t.valor;
            }
        }
    });

    // Projeções fixas de cartão do mês passado
    saidasFixas.forEach(g => {
        if (checkIsCredito(g.cartao) && mesAnteriorStr >= g.inicio && (!g.fim || mesAnteriorStr <= g.fim)) {
            const jaExiste = transacoes.some(t => t.gastoFixoId === g.id && t.data.startsWith(mesAnteriorStr) && t.status !== 'excluida');
            if (!jaExiste) {
                totalFaturaAnterior += parseFloat(g.valor);
            }
        }
    });

    // 3. Saldo Global (Efetivo e Projetado)
    let totalEfetivo = 0;
    let totalProjetado = 0;

    const processTransactionForBalance = (t) => {
        if (t.status === 'excluida') return;
        const tMes = t.data.substring(0, 7);
        const isCartaoCredito = t.tipo === 'saida' && checkIsCredito(t.cartao);
        const mesImpacto = isCartaoCredito ? getMesCobranca(tMes) : tMes;

        if (mesImpacto <= mesNavString) {
            if (normalizarStatus(t) === 'realizada') {
                t.tipo === 'entrada' ? totalEfetivo += t.valor : totalEfetivo -= t.valor;
            }
            if (normalizarStatus(t) !== 'simulacao') {
                t.tipo === 'entrada' ? totalProjetado += t.valor : totalProjetado -= t.valor;
            }
        }
    };

    transacoes.forEach(processTransactionForBalance);

    // Iterar todas as projeções fixas passadas e atuais para refletir corretamente nos saldos
    const gerarMesesAte = (inicio, fim) => {
        if (!inicio) return [];
        const meses = [];
        let [anoI, mesI] = inicio.split('-').map(Number);
        const [anoF, mesF] = fim.split('-').map(Number);
        while (anoI < anoF || (anoI === anoF && mesI <= mesF)) {
            meses.push(`${anoI}-${String(mesI).padStart(2, '0')}`);
            mesI++;
            if (mesI > 12) {
                mesI = 1;
                anoI++;
            }
        }
        return meses;
    };

    entradasFixas.forEach(g => {
        const limiteFim = (g.fim && g.fim < mesNavString) ? g.fim : mesNavString;
        if (g.inicio && g.inicio <= limiteFim) {
            gerarMesesAte(g.inicio, limiteFim).forEach(mesProj => {
                const jaExiste = transacoes.some(t => t.entradaFixaId === g.id && t.data.startsWith(mesProj) && t.status !== 'excluida');
                if (!jaExiste) {
                    processTransactionForBalance({
                        status: 'prevista',
                        data: `${mesProj}-01`,
                        tipo: 'entrada',
                        cartao: g.cartao,
                        valor: parseFloat(g.valor)
                    });
                }
            });
        }
    });

    saidasFixas.forEach(g => {
        const limiteFim = (g.fim && g.fim < mesNavString) ? g.fim : mesNavString;
        if (g.inicio && g.inicio <= limiteFim) {
            gerarMesesAte(g.inicio, limiteFim).forEach(mesProj => {
                const jaExiste = transacoes.some(t => t.gastoFixoId === g.id && t.data.startsWith(mesProj) && t.status !== 'excluida');
                if (!jaExiste) {
                    processTransactionForBalance({
                        status: 'prevista',
                        data: `${mesProj}-01`,
                        tipo: 'saida',
                        cartao: g.cartao,
                        valor: parseFloat(g.valor)
                    });
                }
            });
        }
    });

    document.getElementById('total-entradas').innerText = `R$ ${totalEntradasMes.toFixed(2).replace('.', ',')}`;
    document.getElementById('total-saidas').innerText = `R$ ${totalSaidasVistaMes.toFixed(2).replace('.', ',')}`;
    document.getElementById('total-fatura').innerText = `R$ ${totalFaturaAnterior.toFixed(2).replace('.', ',')}`;
    document.getElementById('total-cartao-mes').innerText = `R$ ${totalUsoCartaoMes.toFixed(2).replace('.', ',')}`;
    document.getElementById('saldo-atual').innerText = `R$ ${totalEfetivo.toFixed(2).replace('.', ',')}`;
    document.getElementById('saldo-previsto').innerText = `R$ ${totalProjetado.toFixed(2).replace('.', ',')}`;
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
    
    // Auto-projetar fixos (entradas e saídas)
    const transacoesProjeto = [];
    entradasFixas.forEach(g => {
        if (navYYYYMM >= g.inicio && (!g.fim || navYYYYMM <= g.fim)) {
            const jaExiste = transacoes.some(t => t.entradaFixaId === g.id && t.data.startsWith(navYYYYMM));
            if (!jaExiste) {
                transacoesProjeto.push({
                    id: 'proje_' + g.id + '_' + navYYYYMM,
                    entradaFixaId: g.id,
                    isProjection: true,
                    tipo: 'entrada',
                    descricao: g.desc,
                    valor: parseFloat(g.valor),
                    data: `${navYYYYMM}-${String(g.dia).padStart(2, '0')}`,
                    categoria: g.categoria || 'Sem Categoria',
                    cartao: g.cartao || '',
                    status: 'prevista'
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
                    gastoFixoId: g.id,
                    isProjection: true,
                    tipo: 'saida',
                    descricao: g.desc,
                    valor: parseFloat(g.valor),
                    data: `${navYYYYMM}-${String(g.dia).padStart(2, '0')}`,
                    categoria: g.categoria || 'Sem Categoria',
                    cartao: g.cartao || '',
                    status: 'prevista'
                });
            }
        }
    });

    const todasTransacoes = [...transacoes, ...transacoesProjeto];
    
    // Aplicar filtros
    const valCat = filtroCategoria.value;
    const valCartao = filtroCartao.value;
    const valStatus = filtroStatus.value;

    let transacoesFiltradas = todasTransacoes.filter(t => {
        if (t.status === 'excluida') return false;
        const tStatus = normalizarStatus(t);
        const passaSimulacao = incluirSimulacoes ? true : tStatus !== 'simulacao';
        const passaMes = t.data.startsWith(prefixoData);
        
        let passaCat = valCat === '' || t.categoria === valCat;
        let passaCartao = valCartao === '' || t.cartao === valCartao;
        let passaStatus = valStatus === '' || tStatus === valStatus;
        
        return passaSimulacao && passaMes && passaCat && passaCartao && passaStatus;
    });

    // Ordenar de acordo com o filtro multicritério
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

                if (cmp !== 0) {
                    return criteria.dir === 'asc' ? cmp : -cmp;
                }
            }
            return 0;
        });
    }

    // Atualizar UI dos cabeçalhos
    document.querySelectorAll('#lista-header .sortable').forEach(span => {
        const col = span.getAttribute('data-sort');
        const icon = span.querySelector('i');
        span.classList.remove('active-sort-asc', 'active-sort-desc');
        
        const sortIndex = listSortConfig.findIndex(s => s.col === col);
        
        if (sortIndex !== -1) {
            const dir = listSortConfig[sortIndex].dir;
            span.classList.add(dir === 'asc' ? 'active-sort-asc' : 'active-sort-desc');
            icon.className = dir === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down';
            // Deixa o ícone primário mais evidente, os secundários ficam levemente transparentes via CSS, mas aqui mostramos a direção de todos ativados.
        } else {
            icon.className = 'fa-solid fa-sort';
        }
    });

    transacoesFiltradas.forEach(t => {
        const li = document.createElement('li');
        li.setAttribute('data-id', t.id);
        
        const tStatus = normalizarStatus(t);
        if (tStatus === 'simulacao') li.classList.add('simulacao-row');
        
        const valorFormatado = `R$ ${t.valor.toFixed(2).replace('.', ',')}`;
        const classeValor = t.tipo === 'entrada' ? 'valor-entrada' : 'valor-saida';
        const sinal = t.tipo === 'entrada' ? '+' : '-';
        
        let labelStatus = '';
        if(tStatus === 'realizada') labelStatus = `<span class="badge realizada">Realizada</span>`;
        if(tStatus === 'prevista') labelStatus = `<span class="badge prevista">Previsto</span>`;
        if(tStatus === 'simulacao') labelStatus = `<span class="badge simulacao">Simulação</span>`;

        let descFinal = t.descricao;
        let fixoOrigem = t.gastoFixoId ? saidasFixas.find(g => g.id === t.gastoFixoId) : (t.entradaFixaId ? entradasFixas.find(g => g.id === t.entradaFixaId) : null);
        
        if (fixoOrigem && fixoOrigem.fim) {
            const [anoIni, mesIni] = fixoOrigem.inicio.split('-');
            const [anoFim, mesFim] = fixoOrigem.fim.split('-');
            const totalParcelas = (parseInt(anoFim) - parseInt(anoIni)) * 12 + (parseInt(mesFim) - parseInt(mesIni)) + 1;
            
            const tMes = t.data.substring(0, 7);
            const [anoT, mesT] = tMes.split('-');
            const parcelaAtual = (parseInt(anoT) - parseInt(anoIni)) * 12 + (parseInt(mesT) - parseInt(mesIni)) + 1;
            
            if (parcelaAtual > 0 && parcelaAtual <= totalParcelas) {
                descFinal += ` (${parcelaAtual}/${totalParcelas})`;
            }
        }

        const catObj = categorias.find(c => c.nome === t.categoria);
        const corCat = catObj ? catObj.cor : 'transparent';
        const borderStyle = corCat !== 'transparent' ? `border-left: 4px solid ${corCat}; padding-left: 8px;` : '';

        // NOVO: guardar dados brutos no dataset do li
        li.dataset.rawData = t.data;
        li.dataset.rawDesc = t.descricao;
        li.dataset.rawCat = t.categoria;
        li.dataset.rawCartao = t.cartao || '';
        li.dataset.rawValor = t.valor;
        li.dataset.rawTipo = t.tipo;
        li.dataset.rawStatus = tStatus;

        li.innerHTML = `
            <span data-label="Data" style="cursor:pointer" title="Clique para editar">${t.data.split('-').reverse().join('/')}</span>
            <span data-label="Descrição" title="Clique para editar: ${descFinal}" style="cursor:pointer">${descFinal}</span>
            <span data-label="Categoria" style="${borderStyle}; cursor:pointer" title="Clique para editar">${t.categoria}</span>
            <span data-label="Cartão" style="cursor:pointer" title="Clique para editar">${t.cartao || '-'}</span>
            <span data-label="Valor" class="${classeValor}" style="cursor:pointer" title="Clique para editar">${sinal} ${valorFormatado}</span>
            <span data-label="Status" class="acoes-linha" style="cursor:pointer" title="Clique para editar">
                ${labelStatus}
                <button class="btn-excluir" title="Excluir"><i class="fa-solid fa-trash"></i></button>
            </span>
        `;
        listaTransacoes.appendChild(li);
    });
    atualizarResumo(transacoesFiltradas, navYYYYMM);
}

toggleSimulacao.addEventListener('change', renderizarLista);
filtroCategoria.addEventListener('change', renderizarLista);
filtroCartao.addEventListener('change', renderizarLista);
filtroStatus.addEventListener('change', (e) => {
    if (e.target.value === 'prevista' || e.target.value === 'simulacao') {
        toggleSimulacao.checked = true;
    }
    renderizarLista();
});

listaTransacoes.addEventListener('click', async (e) => {
    const btnExcluir = e.target.closest('.btn-excluir');
    const spanEditavel = e.target.closest('span[data-label]');
    const li = e.target.closest('li');

    if (!li) return;

    const idTransacao = li.getAttribute('data-id');

    if (btnExcluir) {
        const isProjecao = idTransacao.startsWith('proj');
        const transacaoOriginal = transacoes.find(t => t.id === idTransacao);
        const isFixoSalvo = transacaoOriginal && (transacaoOriginal.entradaFixaId || transacaoOriginal.gastoFixoId);

        const deletarComum = async () => await deleteDoc(doc(window.db, "transacoes", idTransacao));
        const deletarFixoDesteMes = async () => {
            if (isProjecao) {
                const isEntrada = idTransacao.startsWith('proje_');
                const fixoId = idTransacao.split('_')[1]; 
                const novosDados = {
                    status: 'excluida', criadoEm: new Date(),
                    data: `${dataNavegacao.getFullYear()}-${String(dataNavegacao.getMonth() + 1).padStart(2, '0')}-01`,
                    valor: 0, descricao: 'Excluída'
                };
                if (isEntrada) novosDados.entradaFixaId = fixoId;
                else novosDados.gastoFixoId = fixoId;
                await addDoc(collection(window.db, "transacoes"), novosDados);
            } else {
                await updateDoc(doc(window.db, "transacoes", idTransacao), { status: 'excluida' });
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

            btnConfirmar.onclick = async () => { limparModal(); await deletarFixoDesteMes(); };
            btnCancelar.onclick = limparModal;
            btnFechar.onclick = limparModal;

        } else {
            confirmarAcao("Excluir Lançamento", "Tem certeza que deseja excluir esta transação?", deletarComum);
        }
        return;
    }

    if (spanEditavel && !li.classList.contains('editando') && !btnExcluir) {
        const tData = li.dataset.rawData;
        const tDesc = li.dataset.rawDesc;
        const tCat = li.dataset.rawCat;
        const tCartao = li.dataset.rawCartao;
        const tValorRaw = li.dataset.rawValor;
        const tTipo = li.dataset.rawTipo;
        const tStatus = li.dataset.rawStatus;

        li.classList.add('editando');
        
        const catOrdenadas = [...categorias].sort((a,b) => a.nome.localeCompare(b.nome));
        const catFiltradas = catOrdenadas.filter(c => !c.tipo || c.tipo === 'ambas' || c.tipo === tTipo);
        const optsCat = gerarOptionsSelect(catFiltradas, tCat);
        const optsCartoes = `<option value="">Nenhum</option>` + gerarOptionsSelect(cartoes, tCartao);
        
        li.innerHTML = `
            <input type="date" class="edit-data">
            <input type="text" class="edit-desc">
            <select class="edit-cat">${optsCat}</select>
            <select class="edit-cartao">${optsCartoes}</select>
            <div class="valor-input-group">
                <select class="edit-tipo" onchange="this.style.color = this.value === 'entrada' ? 'var(--success)' : 'var(--danger)'">
                    <option value="saida">-</option>
                    <option value="entrada">+</option>
                </select>
                <input type="number" step="0.01" class="edit-valor">
            </div>
            <div class="acoes-linha">
                <select class="edit-status">
                    <option value="realizada">Realizada</option>
                    <option value="prevista">Previsto</option>
                    <option value="simulacao">Simulação</option>
                </select>
            </div>
        `;

        li.querySelector('.edit-data').value = tData;
        li.querySelector('.edit-desc').value = tDesc;
        
        const catSelect = li.querySelector('.edit-cat');
        if (tCat && !Array.from(catSelect.options).some(o => o.value === tCat)) {
            const opt = document.createElement('option');
            opt.value = tCat;
            opt.text = tCat;
            catSelect.add(opt);
        }
        catSelect.value = tCat || '';
        
        const cartaoSelect = li.querySelector('.edit-cartao');
        if (tCartao && !Array.from(cartaoSelect.options).some(o => o.value === tCartao)) {
            const opt = document.createElement('option');
            opt.value = tCartao;
            opt.text = tCartao;
            cartaoSelect.add(opt);
        }
        cartaoSelect.value = tCartao || '';
        
        li.querySelector('.edit-tipo').value = tTipo;
        li.querySelector('.edit-valor').value = parseFloat(tValorRaw);
        li.querySelector('.edit-status').value = tStatus;
        
        li.querySelector('.edit-tipo').dispatchEvent(new Event('change'));

        const clickedLabel = spanEditavel.getAttribute('data-label');
        if (clickedLabel === 'Data') li.querySelector('.edit-data').focus();
        else if (clickedLabel === 'Descrição') li.querySelector('.edit-desc').focus();
        else if (clickedLabel === 'Categoria') li.querySelector('.edit-cat').focus();
        else if (clickedLabel === 'Cartão') li.querySelector('.edit-cartao').focus();
        else if (clickedLabel === 'Valor') li.querySelector('.edit-valor').focus();
        else if (clickedLabel === 'Status') li.querySelector('.edit-status').focus();

        const handleSave = async () => {
            if (li.dataset.saving === 'true') return;
            li.dataset.saving = 'true';

            const novosDados = {
                data: li.querySelector('.edit-data').value,
                descricao: li.querySelector('.edit-desc').value,
                categoria: li.querySelector('.edit-cat').value,
                cartao: li.querySelector('.edit-cartao').value,
                tipo: li.querySelector('.edit-tipo').value,
                valor: parseFloat(li.querySelector('.edit-valor').value),
                status: li.querySelector('.edit-status').value 
            };

            const mudouQualquerCoisa = 
                String(novosDados.descricao).trim() !== String(li.dataset.rawDesc).trim() ||
                String(novosDados.categoria).trim() !== String(li.dataset.rawCat).trim() ||
                String(novosDados.cartao).trim() !== String(li.dataset.rawCartao).trim() ||
                parseFloat(novosDados.valor) !== parseFloat(li.dataset.rawValor) ||
                String(novosDados.data).trim() !== String(li.dataset.rawData).trim() ||
                String(novosDados.tipo).trim() !== String(li.dataset.rawTipo).trim() ||
                String(novosDados.status).trim() !== String(li.dataset.rawStatus).trim();

            if (!mudouQualquerCoisa) {
                renderizarLista();
                return;
            }

            const mudouAlgoAlemDoStatus = 
                String(novosDados.descricao).trim() !== String(li.dataset.rawDesc).trim() ||
                String(novosDados.categoria).trim() !== String(li.dataset.rawCat).trim() ||
                String(novosDados.cartao).trim() !== String(li.dataset.rawCartao).trim() ||
                parseFloat(novosDados.valor) !== parseFloat(li.dataset.rawValor) ||
                String(novosDados.data).trim() !== String(li.dataset.rawData).trim() ||
                String(novosDados.tipo).trim() !== String(li.dataset.rawTipo).trim();

            const isProjecao = idTransacao.startsWith('proj');
            const transacaoOriginal = transacoes.find(t => t.id === idTransacao);
            const isFixoSalvo = transacaoOriginal && (transacaoOriginal.entradaFixaId || transacaoOriginal.gastoFixoId);

            const executarSalvamento = async () => {
                if (isProjecao) {
                    const isEntrada = idTransacao.startsWith('proje_');
                    const fixoId = idTransacao.split('_')[1]; 
                    if (isEntrada) novosDados.entradaFixaId = fixoId;
                    else novosDados.gastoFixoId = fixoId;
                    
                    novosDados.criadoEm = new Date();
                    await addDoc(collection(window.db, "transacoes"), novosDados);
                } else {
                    await updateDoc(doc(window.db, "transacoes", idTransacao), novosDados);
                }
            };

            if ((isProjecao || isFixoSalvo) && mudouAlgoAlemDoStatus) {
                const modalAviso = document.getElementById('modal-aviso-edicao-fixo');
                document.getElementById('aviso-edicao-titulo').innerText = 'Aviso de Edição';
                document.getElementById('aviso-edicao-texto').innerHTML = 'Você está alterando uma receita/despesa fixa na planilha. Esta modificação será aplicada <strong>apenas neste mês específico</strong>.<br><br>Para alterar para todos os meses futuros de forma definitiva, cancele esta ação e faça a alteração através das Configurações (⚙️).';
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

                document.getElementById('btn-confirmar-edicao-fixo').addEventListener('click', async () => {
                    limparModal();
                    await executarSalvamento();
                });

                document.getElementById('btn-cancelar-edicao-fixo').addEventListener('click', () => {
                    limparModal();
                    renderizarLista();
                });

                document.getElementById('fechar-modal-aviso').addEventListener('click', () => {
                    limparModal();
                    renderizarLista();
                });
            } else {
                await executarSalvamento();
            }
        };

        li.addEventListener('focusout', (e) => {
            setTimeout(() => {
                if (!li.contains(document.activeElement) && document.getElementById('modal-aviso-edicao-fixo').style.display !== 'flex') {
                    handleSave();
                }
            }, 10);
        });

        li.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.activeElement.blur(); // Triggers focusout which handles save
            }
        });
    }
});

// --- Inserção Rápida ---
formInline.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const novaTransacao = {
        tipo: document.getElementById('in-tipo').value,
        descricao: document.getElementById('in-desc').value,
        valor: parseFloat(document.getElementById('in-valor').value),
        data: document.getElementById('in-data').value,
        categoria: document.getElementById('in-categoria').value,
        cartao: document.getElementById('in-cartao').value,
        status: document.getElementById('in-status').value, 
        criadoEm: new Date()
    };

    try {
        await addDoc(collection(window.db, "transacoes"), novaTransacao);
        ultimaDataInserida = novaTransacao.data;
        
        document.getElementById('in-desc').value = '';
        document.getElementById('in-valor').value = '';
        document.getElementById('in-data').value = ultimaDataInserida;
        document.getElementById('in-desc').focus();
    } catch (error) {
        console.error("Erro ao salvar:", error);
    }
});

// --- Firebase Sync ---
function inicializarSincronizacao() {
    if(!window.db) return;
    const q = query(collection(window.db, "transacoes"), orderBy("data", "desc"));
    onSnapshot(q, (snapshot) => {
        transacoes = [];
        snapshot.forEach((doc) => transacoes.push({ id: doc.id, ...doc.data() }));
        renderizarLista();
    });
    
    onSnapshot(collection(window.db, "categorias"), (snapshot) => {
        categorias = [];
        snapshot.forEach((doc) => categorias.push({ id: doc.id, ...doc.data() }));
        renderizarListaCategorias();
        carregarOpcoesFormulario();
        renderizarLista();
    });

    onSnapshot(collection(window.db, "cartoes"), (snapshot) => {
        cartoes = [];
        snapshot.forEach((doc) => cartoes.push({ id: doc.id, ...doc.data() }));
        renderizarListaCartoes();
        carregarOpcoesFormulario();
        renderizarLista();
    });

    onSnapshot(collection(window.db, "entradasFixas"), (snapshot) => {
        entradasFixas = [];
        snapshot.forEach((doc) => entradasFixas.push({ id: doc.id, ...doc.data() }));
        renderizarListaEntradasFixas();
        renderizarLista();
    });

    onSnapshot(collection(window.db, "gastosFixos"), (snapshot) => {
        saidasFixas = [];
        snapshot.forEach((doc) => saidasFixas.push({ id: doc.id, ...doc.data() }));
        renderizarListaSaidasFixas();
        renderizarLista();
    });
}

// --- Setup ---
document.getElementById('in-data').value = ultimaDataInserida;
atualizarCorTipo(); // Pinta o botão de +/-
atualizarInterfaceMes();
carregarOpcoesFormulario();
renderizarListaCategorias();
renderizarListaCartoes();
renderizarListaEntradasFixas();
renderizarListaSaidasFixas();

setTimeout(() => { inicializarSincronizacao(); }, 1000);