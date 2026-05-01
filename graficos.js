import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";

let userIdLogadoAno = null;
let anoVisualizado = new Date().getFullYear();

// Elementos DOM
const btnAnoAnterior = document.getElementById('btn-ano-anterior');
const btnAnoProximo = document.getElementById('btn-ano-proximo');
const labelAnoAtual = document.getElementById('ano-atual-label');

const elTotEntradas = document.getElementById('ano-total-entradas');
const elTotSaidas = document.getElementById('ano-total-saidas');
const elSaldoRetido = document.getElementById('ano-saldo-retido');
const elMediaGasto = document.getElementById('ano-media-gasto');
const elGraficoCaixa = document.getElementById('grafico-fluxo-caixa');
const elListaCategorias = document.getElementById('ano-lista-categorias');
const elPctVista = document.getElementById('ano-pct-vista');
const elBarraVista = document.getElementById('ano-barra-vista');
const elPctCartao = document.getElementById('ano-pct-cartao');
const elBarraCartao = document.getElementById('ano-barra-cartao');
const elProjecaoFinal = document.getElementById('ano-projecao-final');
const elEficiencia = document.getElementById('ano-eficiencia-pct');

// Auxiliares
const formatMoeda = (valor) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor);
const mesesSiglas = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Monitorar Autenticação
onAuthStateChanged(window.auth, (user) => {
    if (user) {
        userIdLogadoAno = user.uid;
    } else {
        userIdLogadoAno = null;
    }
});

// Atualizar Interface de Navegação de Ano
function atualizarNavegacaoAno() {
    labelAnoAtual.innerText = anoVisualizado;
    carregarDadosDoAno();
}

btnAnoAnterior.addEventListener('click', () => { anoVisualizado--; atualizarNavegacaoAno(); });
btnAnoProximo.addEventListener('click', () => { anoVisualizado++; atualizarNavegacaoAno(); });

// Monitorar clique na aba Anual para carregar dados sob demanda (Economiza Leituras)
document.querySelectorAll('.main-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (e.target.getAttribute('data-target') === 'tela-ano') {
            if (userIdLogadoAno) carregarDadosDoAno();
        }
    });
});

// O Motor Principal
async function carregarDadosDoAno() {
    if (!userIdLogadoAno || !window.db) return;

    elTotEntradas.innerText = "Carregando...";
    elTotSaidas.innerText = "Carregando...";

    // 1. Busca ultraeconômica: Lê os 12 documentos de Arrays do ano inteiro
    const prefixoAno = String(anoVisualizado);
    const qAno = query(
        collection(window.db, "dados_mensais"), 
        where("userId", "==", userIdLogadoAno),
        where("mes", ">=", `${prefixoAno}-01`),
        where("mes", "<=", `${prefixoAno}-12`)
    );

    const snapshot = await getDocs(qAno);
    
    let totalEntradas = 0;
    let totalSaidas = 0;
    let fluxoMensal = Array.from({length: 12}, () => ({ entradas: 0, saidas: 0 }));
    let categoriasSaida = {};
    let gastoCartao = 0;
    let gastoVista = 0;

    // Cartões (para saber quem é crédito)
    const qCartoes = query(collection(window.db, "cartoes"), where("userId", "==", userIdLogadoAno));
    const snapCartoes = await getDocs(qCartoes);
    let mapaCartoesCredito = {};
    snapCartoes.forEach(d => {
        const c = d.data();
        if (c.tipo === 'credito' || !c.tipo) mapaCartoesCredito[c.nome] = true;
    });

    // 2. Processar os Arrays
    snapshot.forEach(docSnap => {
        const dados = docSnap.data();
        const mesIndex = parseInt(dados.mes.split('-')[1]) - 1; // 0 a 11
        
        if (dados.transacoes && Array.isArray(dados.transacoes)) {
            dados.transacoes.forEach(t => {
                if (t.status === 'excluida' || t.status === 'simulacao') return;

                if (t.tipo === 'entrada') {
                    totalEntradas += t.valor;
                    fluxoMensal[mesIndex].entradas += t.valor;
                } else if (t.tipo === 'saida') {
                    totalSaidas += t.valor;
                    fluxoMensal[mesIndex].saidas += t.valor;

                    // Agrupar Categoria
                    const catNome = t.categoria || 'Sem Categoria';
                    categoriasSaida[catNome] = (categoriasSaida[catNome] || 0) + t.valor;

                    // Agrupar Cartão vs Vista
                    if (t.cartao && mapaCartoesCredito[t.cartao]) {
                        gastoCartao += t.valor;
                    } else {
                        gastoVista += t.valor;
                    }
                }
            });
        }
    });

    // 3. Atualizar Cards de Resumo
    const saldoRetido = totalEntradas - totalSaidas;
    const mesAtualObj = new Date();
    const mesesCorridos = (anoVisualizado === mesAtualObj.getFullYear()) ? (mesAtualObj.getMonth() + 1) : 12;
    const mediaMensal = totalSaidas / (mesesCorridos || 1);
    const eficiencia = totalEntradas > 0 ? ((saldoRetido / totalEntradas) * 100).toFixed(1) : 0;

    elTotEntradas.innerText = `R$ ${formatMoeda(totalEntradas)}`;
    elTotSaidas.innerText = `R$ ${formatMoeda(totalSaidas)}`;
    elSaldoRetido.innerText = `R$ ${formatMoeda(saldoRetido)}`;
    elSaldoRetido.style.color = saldoRetido >= 0 ? 'var(--success)' : 'var(--danger)';
    elMediaGasto.innerText = `R$ ${formatMoeda(mediaMensal)}`;
    elEficiencia.innerText = `${eficiencia}%`;
    elEficiencia.style.color = eficiencia >= 20 ? 'var(--success)' : (eficiencia > 0 ? 'var(--warning)' : 'var(--danger)');

    // 4. Desenhar Gráfico de Fluxo de Caixa (Puro CSS)
    let maxValorGrafico = 0;
    fluxoMensal.forEach(m => {
        if (m.entradas > maxValorGrafico) maxValorGrafico = m.entradas;
        if (m.saidas > maxValorGrafico) maxValorGrafico = m.saidas;
    });

    elGraficoCaixa.innerHTML = '';
    fluxoMensal.forEach((m, i) => {
        const pctEntrada = maxValorGrafico > 0 ? (m.entradas / maxValorGrafico) * 100 : 0;
        const pctSaida = maxValorGrafico > 0 ? (m.saidas / maxValorGrafico) * 100 : 0;
        
        elGraficoCaixa.innerHTML += `
            <div class="mes-coluna">
                <div class="barra-dupla">
                    <div class="barra-grafico barra-entrada" style="height: ${pctEntrada}%;" title="Entradas: R$ ${formatMoeda(m.entradas)}"></div>
                    <div class="barra-grafico barra-saida" style="height: ${pctSaida}%;" title="Saídas: R$ ${formatMoeda(m.saidas)}"></div>
                </div>
                <span class="mes-label">${mesesSiglas[i]}</span>
            </div>
        `;
    });

    // 5. Renderizar Raio-X de Categorias
    const catOrdenadas = Object.entries(categoriasSaida)
        .map(([nome, valor]) => ({ nome, valor }))
        .sort((a, b) => b.valor - a.valor);

    elListaCategorias.innerHTML = '';
    if (catOrdenadas.length === 0) {
        elListaCategorias.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem; text-align: center; margin-top: 2rem;">Nenhum gasto registrado neste ano.</p>';
    } else {
        catOrdenadas.forEach(c => {
            const pct = ((c.valor / totalSaidas) * 100).toFixed(1);
            elListaCategorias.innerHTML += `
                <div class="cat-ranqueada-item">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <strong style="font-size: 0.9rem; color: var(--text-main);">${c.nome}</strong>
                        <span style="font-size: 0.75rem; color: var(--text-muted);">${pct}% do orçamento</span>
                    </div>
                    <strong style="color: var(--danger); font-size: 0.9rem;">R$ ${formatMoeda(c.valor)}</strong>
                </div>
            `;
        });
    }

    // 6. Peso do Cartão
    const totalGastoConhecido = gastoCartao + gastoVista;
    const pctCartao = totalGastoConhecido > 0 ? Math.round((gastoCartao / totalGastoConhecido) * 100) : 0;
    const pctVista = totalGastoConhecido > 0 ? Math.round((gastoVista / totalGastoConhecido) * 100) : 0;

    elPctCartao.innerText = `${pctCartao}%`;
    elBarraCartao.style.width = `${pctCartao}%`;
    elPctVista.innerText = `${pctVista}%`;
    elBarraVista.style.width = `${pctVista}%`;

    // 7. Projeção Fim de Ano (Bola de Cristal)
    calcularProjecaoFimDeAno(saldoRetido);
}

async function calcularProjecaoFimDeAno(saldoRealAtualDoAno) {
    // Puxa o saldo do painel principal (que engloba a vida toda, não só esse ano)
    const elSaldoPrincipal = document.getElementById('saldo-atual');
    let saldoBase = 0;
    if (elSaldoPrincipal && elSaldoPrincipal.innerText) {
        saldoBase = parseFloat(elSaldoPrincipal.innerText.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0;
    }

    const mesAtualNum = new Date().getMonth() + 1;
    const anoAtualNum = new Date().getFullYear();
    
    // Se o usuário estiver vendo um ano passado, a projeção não faz sentido
    if (anoVisualizado < anoAtualNum) {
        elProjecaoFinal.innerText = "Calculado apenas para o ano vigente.";
        elProjecaoFinal.style.fontSize = "1rem";
        return;
    }
    elProjecaoFinal.style.fontSize = "2rem";

    const qEntFixas = query(collection(window.db, "entradasFixas"), where("userId", "==", userIdLogadoAno));
    const qSaiFixas = query(collection(window.db, "gastosFixos"), where("userId", "==", userIdLogadoAno));
    
    const [snapEnt, snapSai] = await Promise.all([getDocs(qEntFixas), getDocs(qSaiFixas)]);
    
    let futuroEntradas = 0;
    let futuroSaidas = 0;

    const processarFixoFuturo = (snap, acumulador) => {
        let total = 0;
        snap.forEach(d => {
            const fixo = d.data();
            for (let m = mesAtualNum + 1; m <= 12; m++) {
                const mesVerificacao = `${anoVisualizado}-${String(m).padStart(2, '0')}`;
                if (fixo.inicio <= mesVerificacao && (!fixo.fim || fixo.fim >= mesVerificacao)) {
                    total += parseFloat(fixo.valor);
                }
            }
        });
        return total;
    };

    futuroEntradas = processarFixoFuturo(snapEnt, futuroEntradas);
    futuroSaidas = processarFixoFuturo(snapSai, futuroSaidas);

    const projecaoDezembro = saldoBase + futuroEntradas - futuroSaidas;

    elProjecaoFinal.innerText = `R$ ${formatMoeda(projecaoDezembro)}`;
    elProjecaoFinal.style.color = projecaoDezembro >= 0 ? 'var(--success)' : 'var(--danger)';
}