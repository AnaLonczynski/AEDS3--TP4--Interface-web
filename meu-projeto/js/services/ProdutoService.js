import { Produto } from '../models/Produto.js';

/* ==========================================================================
    CONSTANTES DE BANCO DE DADOS
    --------------------------------------------------------------------------
    Funcionam como "nomes de arquivos" no seu LocalStorage.
============================================================================= */
export const DB_KEY = 'aeds3_crud_db';          // Onde ficam os dados dos produtos (Registros)
export const DB_HEADER_KEY = 'aeds3_header_db'; // Onde ficam os metadados (Cabeçalho)

class ProdutoService {
    
    /**
     * Construtor: Garante que o banco esteja pronto ao iniciar o serviço.
     */
    constructor() {
        this.inicializarHeader();
    }

    /* ==========================================================================
        GERENCIAMENTO DO CABEÇALHO (HEADER)
        Objetivo: Manter controle de metadados globais, como o Auto-Increment do ID.
    ============================================================================= */

    /**
     * Verifica se o cabeçalho existe. Se não, cria um zerado.
     * @description Garante que nunca tentaremos ler um ID null na primeira execução.
     */
    inicializarHeader() {
        if (!localStorage.getItem(DB_HEADER_KEY)) {
            this.salvarHeader({ lastId: 0 });
        }
    }

    /**
     * Lê o cabeçalho atual.
     * @returns {Object} Objeto contendo { lastId: number }.
     */
    getHeader() {
        const header = localStorage.getItem(DB_HEADER_KEY);
        if (!header) {
            // Fallback de segurança: se foi apagado manualmente, recria.
            const novoHeader = { lastId: 0 };
            this.salvarHeader(novoHeader);
            return novoHeader;
        }
        return JSON.parse(header);
    }

    /**
     * Grava o cabeçalho no LocalStorage.
     * @param {Object} header - O objeto de cabeçalho para salvar.
     */
    salvarHeader(header) {
        localStorage.setItem(DB_HEADER_KEY, JSON.stringify(header));
    }

    /* ==========================================================================
        CRUD DE PRODUTOS (LEITURA E ESCRITA)
    ============================================================================= */

    /**
     * Lê todos os produtos e reconstrói as instâncias da classe Produto.
     * @returns {Produto[]} Array de objetos Produto.
     * @description O JSON.parse retorna objetos genéricos. O .map() é essencial aqui
     * para transformar esses objetos genéricos de volta em instâncias da classe "Produto",
     * reativando o cálculo de tamanho (this.tamanho) definido no construtor do Model.
     */
    lerProdutos() {
        const db = localStorage.getItem(DB_KEY);
        if (!db) return []; // Se vazio, retorna array vazio
        
        return JSON.parse(db).map(p => {
            // Recria a instância para recuperar métodos e propriedades calculadas
            const prod = new Produto(p.nome, p.gtin, p.descricao, p.id, p.ativo);
            
            // Importante: O tamanho pode ter sido salvo, mas o construtor recalcula.
            // Aqui garantimos que estamos usando o dado persistido ou recalculado.
            prod.tamanho = p.tamanho;
            return prod;
        });
    }

    /**
     * Salva o array de produtos no LocalStorage com um delay artificial.
     * @param {Produto[]} produtos - Lista completa de produtos.
     * @description O 'setTimeout' de 300ms existe apenas para simular latência de disco
     * ou rede, permitindo que o usuário veja o ícone de "Salvando..." na interface.
     */
    async salvarProdutos(produtos) {
        await new Promise(resolve => setTimeout(resolve, 300)); // Delay fake
        localStorage.setItem(DB_KEY, JSON.stringify(produtos));
    }

    /**
     * Busca um produto específico pelo ID.
     * @param {number} id - ID do produto.
     * @returns {Produto|undefined} O produto encontrado ou undefined.
     * @description Apenas retorna se o produto estiver ATIVO. Registros excluídos logicamente são ignorados.
     */
    buscarProdutoPorId(id) {
        // "== id" permite comparar string "1" com number 1
        return this.lerProdutos().find(p => p.id == id && p.ativo);
    }

    /**
     * Cria um novo produto (Create).
     * @param {Produto} produto - Objeto produto sem ID.
     * @description
     * 1. Lê o header para pegar o último ID.
     * 2. Incrementa o ID (Auto-Increment).
     * 3. Salva o novo ID no produto e atualiza o header.
     * 4. Adiciona ao final do arquivo (push).
     */
    async criarProduto(produto) {
        const produtos = this.lerProdutos();
        const header = this.getHeader();
        
        // Lógica de Auto-Incremento simulado
        if (produto.id === null) {
            header.lastId += 1;
            produto.id = header.lastId;
            this.salvarHeader(header); // Atualiza o metadado de último ID
        }
        
        produtos.push(produto); // Escreve no final do "arquivo"
        await this.salvarProdutos(produtos);
    }

    /**
     * Exclusão Lógica (Delete).
     * @param {number} id - ID do produto a ser removido.
     * @description Em arquivos sequenciais, não removemos o dado fisicamente para não
     * ter que reescrever o arquivo todo (shift). Apenas marcamos uma flag (Lápide) como false.
     */
    async excluirProduto(id) {
        const produtos = this.lerProdutos();
        const produto = produtos.find(p => p.id == id && p.ativo);
        
        if (produto) {
            produto.ativo = false; // A "Lápide" é marcada aqui
        }
        
        await this.salvarProdutos(produtos);
    }

    /**
     * Atualização de Produto (Update).
     * @param {Produto} produtoAtualizado - Objeto com os novos dados.
     * @description
     * AVISO: Lógica de Arquivos Sequenciais!
     * Se alterarmos o nome "Pão" para "Pão de Queijo", o tamanho aumenta.
     * Não cabe no espaço original sem sobrescrever o vizinho.
     * * Solução adotada:
     * 1. Exclusão lógica do registro antigo (ativo = false).
     * 2. Criação de um registro novo no final do arquivo com os dados novos (Append).
     * O ID é mantido o mesmo, mas fisicamente ele muda de lugar na memória.
     */
    async atualizarProduto(produtoAtualizado) {
        const produtos = this.lerProdutos();
        
        // 1. Encontra o índice do registro antigo
        const indiceAntigo = produtos.findIndex(p => p.id == produtoAtualizado.id && p.ativo);
        
        // 2. "Mata" o registro antigo (cria a lápide 0x2A)
        if (indiceAntigo !== -1) {
            produtos[indiceAntigo].ativo = false;
        }

        // Salva o estado com o antigo deletado
        await this.salvarProdutos(produtos);
        
        // 3. Reativa o objeto novo e insere como se fosse novo (no fim da lista)
        // Nota: Ao chamar criarProduto, ele vai para o fim do array (append)
        produtoAtualizado.ativo = true;
        
        // Como o ID já existe (não é null), o criarProduto não vai gerar novo ID,
        // apenas vai adicionar o objeto ao array.
        await this.criarProduto(produtoAtualizado);
    }
}

// Exporta uma instância única (Singleton) para ser usada em todo o app
export const produtoService = new ProdutoService();