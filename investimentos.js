import { 
    collection, 
    addDoc, 
    query, 
    where, 
    doc, 
    updateDoc, 
    deleteDoc,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";

let userIdLogadoInv = null;
let investimentos = [];
let dadosCarregados = false;

const container = document.getElementById('investimentos-container');
const formNovo = document.getElementById('form-novo-investimento');
const inputNome = document.getElementById('in-investimento-nome');
const inputRendimento = document.getElementById('in-investimento-rendimento');

// Monitorar Autenticação
const checkAuth = setInterval(() => {
    if (window.auth) {
        clearInterval(checkAuth);
        onAuthStateChanged(window.auth, (user) => {
            if (user) {
                userIdLogadoInv = user.uid;
            } else {
                userIdLogadoInv = null;
                investimentos = [];
                dadosCarregados = false;
                if (container) container.innerHTML = '';
            }
        });
    }
}, 100);

// Carregar sob demanda
document.querySelectorAll('.main-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (e.target.getAttribute('data-target') === 'tela-investimentos') {
            if (userIdLogadoInv && !dadosCarregados) {
                carregarInvestimentos();
            }
        }
    });
});

async function carregarInvestimentos() {
    if (!window.db || !userIdLogadoInv) return;
    if (container) container.innerHTML = '<p style="color: var(--text-muted); grid-column: 1/-1; text-align: center; padding: 2rem;">Carregando...</p>';

    try {
        const q = query(collection(window.db, "investimentos"), where("userId", "==", userIdLogadoInv));
        const snapshot = await getDocs(q);
        investimentos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        investimentos.sort((a, b) => a.nome.localeCompare(b.nome));
        dadosCarregados = true;
        renderizarInvestimentos();
        window.dispatchEvent(new CustomEvent('investimentosAtualizados', { detail: investimentos }));
    } catch (error) {
        console.error("Erro ao carregar investimentos:", error);
        if (container) container.innerHTML = '<p style="color: var(--danger); text-align: center;">Erro ao carregar dados.</p>';
    }
}

function renderizarInvestimentos() {
    if (!container) return;
    if (investimentos.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); grid-column: 1/-1; text-align: center; padding: 2rem;">Nenhum investimento cadastrado.</p>';
        return;
    }

    container.innerHTML = investimentos.map(inv => `
        <div class="card-investimento" style="background: var(--surface); padding: 1.5rem; border-radius: var(--radius-lg); border: 1px solid var(--border); position: relative; transition: 0.3s; display: flex; flex-direction: column; justify-content: space-between; min-height: 180px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <h3 style="color: var(--text-main); font-size: 1.1rem; font-weight: 600; margin-bottom: 5px;">${inv.nome}</h3>
                    ${inv.rendimento ? `<span class="badge-rendimento">${inv.rendimento}</span>` : ''}
                </div>
                <div class="card-investimento-acoes">
                    <button onclick="abrirModalEdicaoInvestimento('${inv.id}')" class="btn-edit" title="Editar Investimento"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="confirmarExclusaoInvestimento('${inv.id}', '${inv.nome}')" class="btn-delete" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
            <div style="margin-top: 1.5rem;">
                <p style="color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Saldo Acumulado</p>
                <p style="color: ${(inv.saldo || 0) >= 0 ? 'var(--success)' : 'var(--danger)'}; font-size: 1.8rem; font-weight: 700;">
                    R$ ${inv.saldo ? inv.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
                </p>
            </div>
        </div>
    `).join('');
}

// --- Funções de Modal e CRUD ---

function mostrarAlertaPersonalizado(titulo, texto, tipo = 'info') {
    const modal = document.getElementById('modal-confirmacao');
    const tituloUI = document.getElementById('modal-confirmacao-titulo');
    const textoUI = document.getElementById('modal-confirmacao-texto');
    const btnSim = document.getElementById('btn-confirmacao-sim');
    const btnNao = document.getElementById('btn-confirmacao-nao');

    tituloUI.innerText = titulo;
    textoUI.innerText = texto;
    btnSim.innerText = "Ok";
    btnNao.style.display = 'none';
    modal.style.display = 'flex';

    btnSim.onclick = () => { modal.style.display = 'none'; btnNao.style.display = 'block'; };
}

window.confirmarExclusaoInvestimento = (id, nome) => {
    const modal = document.getElementById('modal-confirmacao');
    const tituloUI = document.getElementById('modal-confirmacao-titulo');
    const textoUI = document.getElementById('modal-confirmacao-texto');
    const btnSim = document.getElementById('btn-confirmacao-sim');
    const btnNao = document.getElementById('btn-confirmacao-nao');

    tituloUI.innerText = "Excluir Investimento";
    textoUI.innerText = `Tem certeza que deseja excluir o investimento "${nome}"? Os lançamentos vinculados não serão apagados, mas o saldo deste card deixará de existir.`;
    btnSim.innerText = "Sim, excluir";
    btnNao.style.display = 'block';
    modal.style.display = 'flex';

    btnSim.onclick = async () => {
        modal.style.display = 'none';
        try {
            await deleteDoc(doc(window.db, "investimentos", id));
            investimentos = investimentos.filter(i => i.id !== id);
            renderizarInvestimentos();
            window.dispatchEvent(new CustomEvent('investimentosAtualizados', { detail: investimentos }));
        } catch (error) {
            console.error("Erro ao excluir:", error);
            mostrarAlertaPersonalizado("Erro", "Não foi possível excluir o investimento.");
        }
    };
    btnNao.onclick = () => { modal.style.display = 'none'; };
};

window.abrirModalEdicaoInvestimento = (id) => {
    const inv = investimentos.find(i => i.id === id);
    if (!inv) return;

    document.getElementById('edit-invest-id').value = id;
    document.getElementById('edit-invest-nome').value = inv.nome;
    document.getElementById('edit-invest-rendimento').value = inv.rendimento || '';
    document.getElementById('modal-edicao-investimento').style.display = 'flex';
};

document.getElementById('fechar-modal-edicao-invest').onclick = () => document.getElementById('modal-edicao-investimento').style.display = 'none';
document.getElementById('btn-cancelar-edicao-invest').onclick = () => document.getElementById('modal-edicao-investimento').style.display = 'none';

document.getElementById('form-editar-investimento').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-invest-id').value;
    const nome = document.getElementById('edit-invest-nome').value.trim();
    const rendimento = document.getElementById('edit-invest-rendimento').value.trim();

    if (!nome || !window.db) return;

    try {
        await updateDoc(doc(window.db, "investimentos", id), {
            nome: nome,
            rendimento: rendimento
        });
        
        const index = investimentos.findIndex(i => i.id === id);
        if (index !== -1) {
            investimentos[index].nome = nome;
            investimentos[index].rendimento = rendimento;
            investimentos.sort((a, b) => a.nome.localeCompare(b.nome));
            renderizarInvestimentos();
            window.dispatchEvent(new CustomEvent('investimentosAtualizados', { detail: investimentos }));
        }
        document.getElementById('modal-edicao-investimento').style.display = 'none';
    } catch (error) {
        console.error("Erro ao editar:", error);
        mostrarAlertaPersonalizado("Erro", "Não foi possível salvar as alterações.");
    }
};

if (formNovo) {
    formNovo.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = inputNome.value.trim();
        const rendimento = inputRendimento.value.trim();
        if (!nome || !userIdLogadoInv || !window.db) return;

        const novoInv = {
            nome: nome,
            rendimento: rendimento,
            saldo: 0,
            userId: userIdLogadoInv,
            createdAt: new Date().toISOString()
        };

        try {
            const docRef = await addDoc(collection(window.db, "investimentos"), novoInv);
            investimentos.push({ id: docRef.id, ...novoInv });
            investimentos.sort((a, b) => a.nome.localeCompare(b.nome));
            renderizarInvestimentos();
            inputNome.value = '';
            inputRendimento.value = '';
            window.dispatchEvent(new CustomEvent('investimentosAtualizados', { detail: investimentos }));
        } catch (error) {
            console.error("Erro ao adicionar:", error);
            mostrarAlertaPersonalizado("Erro", "Não foi possível adicionar o investimento.");
        }
    });
}

window.atualizarSaldoInvestimento = async (id, valor) => {
    const invIndex = investimentos.findIndex(i => i.id === id);
    if (invIndex === -1 || !window.db) return;
    
    try {
        const novoSaldo = (investimentos[invIndex].saldo || 0) + valor;
        await updateDoc(doc(window.db, "investimentos", id), {
            saldo: novoSaldo
        });
        investimentos[invIndex].saldo = novoSaldo;
        renderizarInvestimentos();
        window.dispatchEvent(new CustomEvent('investimentosAtualizados', { detail: investimentos }));
    } catch (error) {
        console.error("Erro ao atualizar saldo:", error);
    }
};