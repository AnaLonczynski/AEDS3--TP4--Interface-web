import { Produto } from '../models/Produto.js';
import { produtoService, DB_KEY } from '../services/ProdutoService.js';

/* ==========================================================================
    SEÇÃO 1: FUNÇÕES AUXILIARES (CONVERSÃO DE DADOS)
    Objetivo: Simular como os dados seriam gravados em um arquivo binário.
============================================================================= */

/**
 * Converte um número Inteiro (Number) para um array de bytes em Hexadecimal.
 * * @param {number} num - O número a ser convertido.
 * @param {number} byteCount - Quantos bytes esse número deve ocupar (ex: 2, 4, 8).
 * @returns {string[]} Array de strings hex (ex: ["00", "00", "00", "0A"]).
 * @description Lida com preenchimento de zeros (padding) à esquerda.
 */
function intToHexBytes(num, byteCount) {
    // Se for negativo, aplica lógica básica para representação (complemento)
    if (num < 0) num = Math.pow(2, byteCount * 8) + num;
    
    // Converte para hex e garante que tenha o tamanho certo preenchendo com zeros
    let hex = num.toString(16).padStart(byteCount * 2, '0');
    
    // Garante que não exceda o tamanho (corta o excesso à esquerda se houver)
    hex = hex.slice(-byteCount * 2);
    
    // Fatia a string hex em pares de 2 caracteres (cada par é 1 byte)
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
        bytes.push(hex.slice(i, i + 2));
    }
    return bytes;
}

/**
 * Converte um número muito grande (BigInt) para Hexadecimal.
 * * @param {BigInt|number} num - O número (geralmente IDs ou timestamps).
 * @param {number} byteCount - Quantidade de bytes.
 * @returns {string[]} Array de bytes hex.
 * @description Necessário para IDs que superam o limite do Integer padrão do JS.
 */
function bigIntToHexBytes(num, byteCount) {
    let hex = BigInt(num).toString(16).padStart(byteCount * 2, '0');
    hex = hex.slice(-byteCount * 2);
    
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
        bytes.push(hex.slice(i, i + 2));
    }
    return bytes;
}

/**
 * Converte uma String de texto para bytes Hexadecimais (Codificação UTF-8).
 * * @param {string} str - O texto a ser convertido.
 * @returns {string[]} Array de bytes hex representando o texto.
 */
function stringToHexBytes(str) {
    const encoder = new TextEncoder(); // Utilitário nativo do JS para encoding
    const encoded = encoder.encode(str);
    const bytes = [];
    for (let i = 0; i < encoded.length; i++) {
        // Converte cada char code para hex e garante 2 dígitos
        bytes.push(encoded[i].toString(16).padStart(2, '0'));
    }
    return bytes;
}

/**
 * Tenta converter bytes Hexadecimais de volta para texto ASCII legível.
 * * @param {string[]} hexBytes - Array de bytes hex.
 * @returns {string} String com caracteres legíveis ou '.' para não imprimíveis.
 * @description Usada na coluna da direita do visualizador ("| Decodificado").
 */
function hexBytesToAscii(hexBytes) {
    let ascii = "";
    for (const hexByte of hexBytes) {
        const byteVal = parseInt(hexByte, 16);
        // Verifica se é um caractere imprimível (faixa ASCII padrão)
        if (byteVal >= 0x20 && byteVal <= 0x7E) {
            ascii += String.fromCharCode(byteVal);
        } else {
            // Se for controle ou especial, exibe ponto para não quebrar o layout
            ascii += '.';
        }
    }
    return ascii;
}

/* ==========================================================================
    SEÇÃO 2: CONTROLADOR PRINCIPAL (CLASSE)
    Objetivo: Gerenciar a lógica da página, eventos do usuário e renderização.
============================================================================= */
export class ProdutoController {
    
    /**
     * Construtor: Inicializa referências do DOM e Event Listeners.
     * @description Executado automaticamente quando "new ProdutoController()" é chamado.
     */
    constructor() {
        // --- Captura de Elementos do HTML ---
        this.form = document.getElementById('produtoForm');
        this.formTitulo = document.getElementById('form-titulo');
        this.produtoIdInput = document.getElementById('produtoId'); // Campo oculto para ID
        this.nomeInput = document.getElementById('nome');
        this.gtinInput = document.getElementById('gtin');
        this.descricaoInput = document.getElementById('descricao');
        this.btnCancelar = document.getElementById('btnCancelar');
        
        // Elementos da Lista/Tabela
        this.listaProdutos = document.getElementById('listaProdutos'); // Tbody
        this.listaVazia = document.getElementById('listaVazia');       // Msg "Nenhum produto"
        this.buscaInput = document.getElementById('busca');
        
        // Elementos do Visualizador Hex
        this.localStorageView = document.getElementById('localStorageView');
        
        // Elementos de Feedback (Toast/Loading)
        this.feedback = document.getElementById('feedback');
        this.savingIndicator = document.getElementById('saving-indicator');

        this.bytesPerLine = 16; // Padrão inicial, mas será recalculado

        // --- Definição dos Eventos (Bindings) ---
        // .bind(this) garante que o 'this' dentro da função refira-se à Classe, não ao botão
        this.form.addEventListener('submit', this.salvar.bind(this));
        this.btnCancelar.addEventListener('click', this.resetarForm.bind(this));
        this.buscaInput.addEventListener('input', this.exibirProdutos.bind(this));
        
        // Delegação de evento: clica na tabela, verifica se foi botão editar/excluir
        this.listaProdutos.addEventListener('click', this.handleAcoesTabela.bind(this));
        
        // Auto-resize para o campo de descrição (textarea)
        this.descricaoInput.addEventListener('input', () => {
            this.descricaoInput.style.height = 'auto';
            this.descricaoInput.style.height = (this.descricaoInput.scrollHeight) + 'px';
        });
    }

    /**
     * Inicializa o controlador.
     * @description Chama a renderização inicial e configura o observador de redimensionamento.
     */
    init() {
        this.exibirProdutos();
        
        // ResizeObserver: Observa se o tamanho da div pai mudou (ex: redimensionar janela)
        // para recalcular quantos bytes cabem numa linha do Hex Editor.
        const resizeObserver = new ResizeObserver(() => {
            this.calcularBytesPorLinha();
            this.atualizarVisualizacao();
        });
        if (this.localStorageView.parentElement) {
            resizeObserver.observe(this.localStorageView.parentElement);
        }
    }

    /**
     * Calcula responsivamente quantos bytes cabem em uma linha do visualizador.
     * @description Baseado na largura da tela, ajusta entre 8 e 32 bytes por linha.
     */
    calcularBytesPorLinha() {
        const containerWidth = this.localStorageView.parentElement.clientWidth;
        const availableWidth = containerWidth - 140; // Subtrai espaço do endereço e margens
        let calculatedBytes = Math.floor(availableWidth / 45); // 45px é a largura aprox de cada byte visual

        // Limites de segurança (mínimo 8 bytes, máximo 32 bytes)
        if (calculatedBytes < 8) calculatedBytes = 8;
        if (calculatedBytes > 32) calculatedBytes = 32;

        this.bytesPerLine = calculatedBytes;
    }

    /**
     * Renderiza a tabela HTML com a lista de produtos.
     * @description Lê do serviço, filtra (busca) e cria as linhas <tr>.
     */
    exibirProdutos() {
        const termoBusca = this.buscaInput.value.toLowerCase();
        const produtos = produtoService.lerProdutos();
        const produtosAtivos = produtos.filter(p => p.ativo === true); // Apenas não deletados
        
        let produtosFiltrados = produtosAtivos;
        if (termoBusca) {
            produtosFiltrados = produtosAtivos.filter(p => p.nome.toLowerCase().includes(termoBusca));
        }

        this.listaProdutos.innerHTML = ''; // Limpa tabela atual
        
        if (produtosFiltrados.length === 0) {
            this.listaVazia.classList.remove('hidden');
        } else {
            this.listaVazia.classList.add('hidden');
            produtosFiltrados.forEach(produto => {
                // Criação dinâmica da linha da tabela com Template String
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-gray-50 transition-colors';
                tr.innerHTML = `
                    <td class="px-4 py-3 text-sm font-semibold text-gray-900 align-top whitespace-normal break-words">
                        ${produto.nome}
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600 font-mono align-top">
                        ${produto.gtin}
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-600 whitespace-normal break-words align-top">
                        ${produto.descricao}
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-right text-sm font-medium align-top">
                        <button data-id="${produto.id}" class="btn-editar text-[#6E473B] hover:text-[#291C0E] mr-3 font-bold transition-colors">Editar</button>
                        <button data-id="${produto.id}" class="btn-excluir text-red-600 hover:text-red-800 font-bold transition-colors">Excluir</button>
                    </td>
                `;
                this.listaProdutos.appendChild(tr);
            });
        }
    }

    /**
     * Processa o envio do formulário (Create ou Update).
     * @param {Event} e - Evento de submit do formulário.
     */
    async salvar(e) {
        e.preventDefault(); // Impede recarregamento da página
        
        // Coleta valores
        const id = this.produtoIdInput.value;
        const nome = this.nomeInput.value.trim();
        const gtin = this.gtinInput.value.trim();
        const descricao = this.descricaoInput.value.trim();

        // verificação de campos obrigatórios
        if (!nome || !gtin) {
            this.mostrarFeedback('Preencha os campos obrigatórios.', 'erro');
            return;
        }

        // Verificação do tamanho do GTIN
        if (gtin.length !== 13) {
            this.mostrarFeedback('O GTIN deve ter exatamente 13 caracteres.', 'erro');
            return;
        }

        // Verificação do GTIN ser único
        const produtos = produtoService.lerProdutos();
        const produtoDuplicado = produtos.find(p => p.gtin === gtin && p.ativo);
        if (produtoDuplicado) {
            if (!id || produtoDuplicado.id != id) {
                this.mostrarFeedback(`Erro: O GTIN informado já pertence ao produto "${produtoDuplicado.nome}".`, 'erro');
                this.gtinInput.focus();
                this.gtinInput.classList.add('ring-2', 'ring-red-500');
                setTimeout(() => this.gtinInput.classList.remove('ring-2', 'ring-red-500'), 2000);
                return; 
            }
        }

        this.savingIndicator.classList.remove('hidden');

        try {
            if (id) {
                // --- EDIÇÃO ---
                const produtoOriginal = produtoService.buscarProdutoPorId(id);
                // Mantém o status ativo original, atualiza o resto
                const produtoAtualizado = new Produto(nome, gtin, descricao, id, produtoOriginal.ativo);
                await produtoService.atualizarProduto(produtoAtualizado);
                this.mostrarFeedback('Atualizado com sucesso!', 'sucesso');
            } else {
                // --- CRIAÇÃO ---
                const novoProduto = new Produto(nome, gtin, descricao);
                await produtoService.criarProduto(novoProduto);
                this.mostrarFeedback('Cadastrado com sucesso!', 'sucesso');
            }
            
            // Limpeza e Atualização da UI
            this.buscaInput.value = '';
            this.resetarForm();
            this.exibirProdutos();
            this.atualizarVisualizacao(); // Atualiza o Hex Dump

        } catch (error) {
            this.mostrarFeedback('Erro ao salvar.', 'erro');
            console.error(error);
        } finally {
            this.savingIndicator.classList.add('hidden');
        }
    }

    /**
     * Exclui logicamente um produto.
     * @param {string|number} id - ID do produto.
     */
    async excluir(id) {
        this.savingIndicator.classList.remove('hidden');
        try {
            await produtoService.excluirProduto(id); // Serviço marca 'ativo' como false
        } catch (error) {
            this.mostrarFeedback('Erro ao excluir.', 'erro');
        }
        this.savingIndicator.classList.add('hidden');
        this.mostrarFeedback('Excluído com sucesso.', 'sucesso');
        
        this.exibirProdutos();
        this.atualizarVisualizacao(); // Importante: Mostra a "lápide" (byte 2A) no visualizador
        this.resetarForm();
    }

    /**
     * Exibe mensagens flutuantes de sucesso ou erro (Toast).
     */
    mostrarFeedback(mensagem, tipo = 'sucesso') {
        this.feedback.textContent = mensagem;
        // Remove classes antigas para evitar conflito
        this.feedback.classList.remove('hidden', 'bg-green-100', 'text-green-700', 'bg-red-100', 'text-red-700');
        
        if (tipo === 'sucesso') {
            this.feedback.classList.add('bg-green-100', 'text-green-800', 'border', 'border-green-200');
        } else {
            this.feedback.classList.add('bg-red-100', 'text-red-800', 'border', 'border-red-200');
        }
        
        this.feedback.classList.remove('hidden');
        
        // Esconde automaticamente após 3 segundos
        setTimeout(() => {
            this.feedback.classList.add('hidden');
            this.feedback.className = "mt-4 text-center p-3 rounded-md hidden text-sm font-semibold"; 
        }, 3000);
    }

    /**
     * Limpa o formulário e volta ao estado de "Novo Produto".
     */
    resetarForm() {
        this.form.reset();
        this.produtoIdInput.value = '';
        this.formTitulo.textContent = 'Adicionar Produto';
        this.btnCancelar.classList.add('hidden');
        this.descricaoInput.style.height = 'auto';
    }

    /**
     * Preenche o formulário com os dados de um produto para edição.
     * @param {string|number} id - ID do produto selecionado.
     */
    prepararEdicao(id) {
        const produto = produtoService.buscarProdutoPorId(id);
        if (produto) {
            this.formTitulo.textContent = 'Editar Produto';
            this.produtoIdInput.value = produto.id;
            this.nomeInput.value = produto.nome;
            this.gtinInput.value = produto.gtin;
            this.descricaoInput.value = produto.descricao;
            
            this.btnCancelar.classList.remove('hidden');
            
            // Ajuste visual da altura do textarea
            this.descricaoInput.style.height = 'auto';
            this.descricaoInput.style.height = (this.descricaoInput.scrollHeight) + 'px';
            
            this.nomeInput.focus();
            window.scrollTo(0, 0);
        }
    }

    /**
     * Gerenciador de cliques na tabela (Delegação).
     * @description Verifica se clicou em Editar ou Excluir.
     */
    handleAcoesTabela(e) {
        if (e.target.classList.contains('btn-editar')) {
            const id = e.target.dataset.id;
            this.prepararEdicao(id);
        }
        if (e.target.classList.contains('btn-excluir')) {
            const id = e.target.dataset.id;
            this.excluir(id);
        }
    }

    /* ==========================================================================
        SEÇÃO 3: VISUALIZADOR HEXADECIMAL (ENGINE GRÁFICA)
        Objetivo: Construir a representação visual byte a byte da memória.
    ============================================================================= */
    
    /**
     * Reconstrói toda a área de visualização Hexadecimal.
     * @description Converte todos os produtos e o cabeçalho para bytes, organiza em linhas
     * e adiciona os eventos de interação (hover).
     */
    atualizarVisualizacao() {
        const BYTES_PER_LINE = this.bytesPerLine;
        const TAMANHO_ID = 8; // IDs são Long (8 bytes)

        // Arrays para armazenar a "memória virtual"
        const allBytes = [];    // Lista sequencial de strings hex ('0A', 'FF'...)
        const byteMetadata = []; // Dados extras para cada byte (qual campo pertence, endereço)
        const byteColors = [];   // Marcadores visuais (ex: deletado = vermelho)

        /**
         * Função Interna: Adiciona uma sequência de bytes à memória virtual.
         * @param {string[]} bytes - Array de bytes hex.
         * @param {string} tooltipBase - Texto descritivo para o tooltip.
         * @param {string} fieldName - Nome lógico do campo (ex: 'RECORD_NOME').
         * @param {number} recordIndex - Índice do registro (para agrupar visualmente).
         * @param {boolean} isDeleted - Se o registro está excluído.
         * @param {number} startAddress - Endereço de memória onde este bloco começa.
         */
        const pushBytes = (bytes, tooltipBase, fieldName, recordIndex = null, isDeleted = false, startAddress) => {
            allBytes.push(...bytes);
            for (let i = 0; i < bytes.length; i++) {
                byteMetadata.push({
                    tooltipBase: tooltipBase,
                    field: fieldName,
                    recordIndex: recordIndex,
                    address: startAddress + i // Calcula endereço único para cada byte
                });
                byteColors.push(isDeleted);
            }
        };
        
        // --- 1. Construção dos Dados (Header + Registros) ---
        const produtos = produtoService.lerProdutos();
        const header = produtoService.getHeader();
        const numAtivos = produtos.filter(p => p.ativo).length;
        
        // Escreve o Cabeçalho do Arquivo (Metadados globais)
        pushBytes(intToHexBytes(numAtivos, 4), `Tamanho: 4 bytes\nRegistros Ativos: ${numAtivos}`, 'HEADER_N_RECORDS', null, false, 0);
        pushBytes(intToHexBytes(header.lastId, 8), `Tamanho: 8 bytes\nÚltimo ID Gerado: ${header.lastId}`, 'HEADER_LAST_ID', null, false, 4);

        let byteAddress = 12; // O cabeçalho ocupa 12 bytes (4 + 8), então registros começam no 12
        
        // Escreve cada Produto
        produtos.forEach((p, index) => {
            const isDeleted = !p.ativo;
            // 0x20 = Espaço (Ativo), 0x2A = Asterisco (Deletado/Lápide)
            const statusVal = p.ativo ? 'Ativo (0x20)' : 'Deletado (0x2A)';
            const statusLixo = isDeleted ? ' (Lixo)' : ''; // Indica que dados existem mas são inválidos
            
            const nomeBytes = stringToHexBytes(p.nome);
            const descBytes = stringToHexBytes(p.descricao);
            const gtinBytes = stringToHexBytes(p.gtin);
            
            const tamanhoBlocoAlocado = p.tamanho;

            // Inserção sequencial dos campos do registro, passando o endereço correto
            // Byte 0: Lápide
            pushBytes([p.ativo ? '20' : '2A'], `Tamanho: 1 byte\nLápide: ${statusVal}`, 'RECORD_LÁPIDE', index, isDeleted, byteAddress);
            // Bytes 1-2: Tamanho do registro
            pushBytes(intToHexBytes(tamanhoBlocoAlocado, 2), `Tamanho: 2 bytes\nTamanho do Registro: ${tamanhoBlocoAlocado}`, 'RECORD_TAMANHO', index, isDeleted, byteAddress + 1);
            // Bytes 3-10: ID
            pushBytes(bigIntToHexBytes(p.id, TAMANHO_ID), `Tamanho: 8 bytes\nID: ${p.id}${statusLixo}`, 'RECORD_ID', index, isDeleted, byteAddress + 3);
            // Bytes 11-23: GTIN
            pushBytes(gtinBytes, `Tamanho: 13 bytes\nGTIN: ${p.gtin}${statusLixo}`, 'RECORD_GTIN', index, isDeleted, byteAddress + 11);
            // Bytes 24...: Nome
            pushBytes(nomeBytes, `Tamanho: ${nomeBytes.length} bytes\nNome: ${p.nome}${statusLixo}`, 'RECORD_NOME', index, isDeleted, byteAddress + 24);
            // Bytes seguintes: Descrição
            pushBytes(descBytes, `Tamanho: ${descBytes.length} bytes\nDescrição: ${p.descricao}${statusLixo}`, 'RECORD_DESC', index, isDeleted, byteAddress + 24 + nomeBytes.length);
            
            byteAddress += tamanhoBlocoAlocado; // Avança o ponteiro de endereço
        });

        // --- 2. Renderização HTML (Grid Hex Dump) ---
        const htmlOutput = [];

        // Cria a régua superior (00 01 02 ... 0F)
        let hexRuler = "";
        for (let i = 0; i < BYTES_PER_LINE; i++) {
            hexRuler += i.toString(16).toUpperCase().padStart(2, '0') + " ";
        }
        const offsetLabel = "Offset".padEnd(8, ' ');

        // Linha de cabeçalho visual
        htmlOutput.push('<div class="record-line" style="font-weight: bold; opacity: 0.8;">');
        htmlOutput.push(`<span class="record-address" style="color: #A78D78;">${offsetLabel}</span>`);
        htmlOutput.push(`<div class="record-hex" style="color: #A78D78;">${hexRuler}</div>`);
        htmlOutput.push(`<div class="record-ascii" style="color: #A78D78;">| Decodificado</div>`);
        htmlOutput.push('</div>');

        // Loop principal: Quebra o array linear `allBytes` em linhas visuais
        for (let i = 0; i < allBytes.length; i += BYTES_PER_LINE) {
            // Coluna 1: Endereço do início da linha (Offset)
            const address = i.toString(16).padStart(8, '0');
            
            // Fatias de dados para esta linha específica
            const lineBytes = allBytes.slice(i, i + BYTES_PER_LINE);
            const lineMetadata = byteMetadata.slice(i, i + BYTES_PER_LINE);
            const lineColors = byteColors.slice(i, i + BYTES_PER_LINE);

            let hexString = "";

            // Loop interno: Gera cada byte individualmente (Span)
            for (let j = 0; j < lineBytes.length; j++) {
                const byte = lineBytes[j];
                const metadata = lineMetadata[j];
                const isRed = lineColors[j]; // Registro deletado fica vermelho

                let style = '';
                // Cores base: cinza para metadados, vermelho para deletado, branco para ativo
                if (metadata.recordIndex === null) style = 'color: #9ca3af;';
                else style = isRed ? 'color: #ef4444;' : 'color: #ffffff;';
                
                // Monta o HTML do byte com todos os metadados necessários para os eventos
                hexString += `<span class="byte-span"
                                    data-tooltip-base="${metadata.tooltipBase}"
                                    data-address="${metadata.address}"
                                    data-field="${metadata.field}"
                                    data-record-index="${metadata.recordIndex}"
                                    style="${style}">${byte.toUpperCase()}</span> `;
            }

            // Coluna 3: Representação ASCII
            const ascii = hexBytesToAscii(lineBytes);
            
            // Montagem da linha completa
            htmlOutput.push('<div class="record-line">');
            htmlOutput.push(`<span class="record-address">${address}</span>`);
            htmlOutput.push(`<div class="record-hex">${hexString}</div>`);
            htmlOutput.push(`<div class="record-ascii">|${ascii.padEnd(BYTES_PER_LINE, '.')} |</div>`);
            htmlOutput.push('</div>');
        }
        
        this.localStorageView.innerHTML = htmlOutput.join('\n');
        
        // --- 3. Configuração de Eventos (Interatividade) ---
        const byteSpans = this.localStorageView.querySelectorAll('.byte-span');
        const globalTooltip = document.getElementById('global-tooltip');

        byteSpans.forEach(span => {
            span.addEventListener('mouseover', (e) => {
                // Lógica A: Realce em BLOCO
                // Se passar o mouse em um byte do "Nome", todos os bytes do "Nome" desse registro acendem
                const hoveredField = e.target.dataset.field;
                const hoveredIndex = e.target.dataset.recordIndex;
                byteSpans.forEach(otherSpan => {
                    if (otherSpan.dataset.field === hoveredField && otherSpan.dataset.recordIndex === hoveredIndex) {
                        otherSpan.classList.add('highlight-field');
                    }
                });

                // Lógica B: Tooltip INDIVIDUAL (Endereço Específico)
                // O tooltip mostra o endereço exato daquele byte único, mesmo que o bloco todo esteja aceso
                if (globalTooltip) {
                    const baseText = e.target.getAttribute('data-tooltip-base');
                    const addressDec = parseInt(e.target.getAttribute('data-address'));
                    const addressHex = '0x' + addressDec.toString(16).padStart(8, '0');
                    
                    if (baseText) {
                        globalTooltip.innerText = `Endereço: ${addressHex}\n${baseText}`;
                        globalTooltip.classList.remove('hidden');
                    }
                }
            });

            // Faz o tooltip seguir o mouse
            span.addEventListener('mousemove', (e) => {
                if (globalTooltip && !globalTooltip.classList.contains('hidden')) {
                    const x = e.clientX + 15;
                    const y = e.clientY + 15;
                    globalTooltip.style.left = `${x}px`;
                    globalTooltip.style.top = `${y}px`;
                }
            });

            // Limpa o realce e esconde tooltip ao sair
            span.addEventListener('mouseout', () => {
                byteSpans.forEach(otherSpan => {
                    otherSpan.classList.remove('highlight-field');
                });
                if (globalTooltip) globalTooltip.classList.add('hidden');
            });
        });
    }
}