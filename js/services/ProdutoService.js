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
    ============================================================================= */

    /**
     * Verifica se o cabeçalho existe. Se não, cria um zerado.
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
     */
    lerProdutos() {
        const db = localStorage.getItem(DB_KEY);
        if (!db) return []; 
        
        return JSON.parse(db).map(p => {
            const prod = new Produto(p.nome, p.gtin, p.descricao, p.id, p.ativo);
            prod.tamanho = p.tamanho;
            return prod;
        });
    }

    /**
     * Salva o array de produtos no LocalStorage com um delay artificial.
     * @param {Produto[]} produtos - Lista completa de produtos.
     */
    async salvarProdutos(produtos) {
        await new Promise(resolve => setTimeout(resolve, 300)); // Delay fake
        localStorage.setItem(DB_KEY, JSON.stringify(produtos));
    }

    /**
     * Busca um produto específico pelo ID.
     */
    buscarProdutoPorId(id) {
        return this.lerProdutos().find(p => p.id == id && p.ativo);
    }

    /**
     * Encontra o índice do registro excluído logicamente (lápide=false)
     * que melhor se ajusta ao tamanho do novo produto (**Best-Fit**).
     * @param {number} tamanhoNecessario - O tamanho (em bytes) do produto a ser inserido.
     * @returns {{index: number, tamanho: number}|null} Objeto com o índice e tamanho do bloco livre, ou null.
     */
    encontrarMelhorBlocoLivre(tamanhoNecessario) {
        const produtos = this.lerProdutos();
        let melhorBloco = null;

        produtos.forEach((p, index) => {
            // 1. Deve ser um registro inativo (lápide)
            if (p.ativo === false) {
                const tamanhoLivre = p.tamanho;
                
                // 2. O produto NOVO deve caber no bloco livre
                if (tamanhoNecessario <= tamanhoLivre) {
                    
                    // 3. Critério Best-Fit: Encontrar o menor bloco livre que atende ao requisito
                    if (melhorBloco === null || tamanhoLivre < melhorBloco.tamanho) {
                        melhorBloco = { index: index, tamanho: tamanhoLivre };
                    }
                }
            }
        });

        return melhorBloco;
    }

    /**
     * Cria um novo produto (Create).
     * @param {Produto} produto - Objeto produto.
     * @description Implementa a estratégia de sobrescrita Best-Fit.
     */
    async criarProduto(produto) {
        const produtos = this.lerProdutos();
        const header = this.getHeader();

        // 1. Tenta encontrar um espaço livre (Best-Fit)
        const melhorBloco = this.encontrarMelhorBlocoLivre(produto.tamanho);
        
        // Se encontramos um bloco para sobrescrever (tamanho novo <= tamanho antigo)
        if (melhorBloco) {
            
            // Gerar o ID, se necessário (novo produto)
            if (produto.id === null) {
                header.lastId += 1;
                produto.id = header.lastId;
                this.salvarHeader(header);
            }
            
            // O novo produto herda o tamanho do bloco que ele está ocupando (para manter o espaço)
            produto.tamanho = melhorBloco.tamanho; 
            
            // Sobrescreve o registro na posição do bloco livre
            produtos[melhorBloco.index] = produto;
            
        } else {
            // Se não encontrou espaço, ou o novo produto é maior: APPEND (adicionar ao final)
            if (produto.id === null) {
                header.lastId += 1;
                produto.id = header.lastId;
                this.salvarHeader(header); 
            }
            
            // Usa o tamanho real do novo produto
            
            produtos.push(produto); // Escreve no final do "arquivo"
        }
        
        await this.salvarProdutos(produtos);
    }

    /**
     * Exclusão Lógica (Delete).
     */
    async excluirProduto(id) {
        const produtos = this.lerProdutos();
        // Nota: O find precisa achar apenas o produto ativo para evitar matar lápides.
        const produto = produtos.find(p => p.id == id && p.ativo);
        
        if (produto) {
            produto.ativo = false; // A "Lápide" é marcada aqui
        }
        
        await this.salvarProdutos(produtos);
    }

    /**
     * Atualização de Produto (Update).
     * @description Implementa sobrescrita no local original se o tamanho não aumentar,
     * ou usa a lógica de Best-Fit/Append se o tamanho aumentar.
     */
    async atualizarProduto(produtoAtualizado) {
        const produtos = this.lerProdutos();
        
        // 1. Encontra o índice e o objeto antigo
        const indiceAntigo = produtos.findIndex(p => p.id == produtoAtualizado.id);
        
        if (indiceAntigo === -1) {
            throw new Error(`Produto com ID ${produtoAtualizado.id} não encontrado.`);
        }
        
        const produtoAntigo = produtos[indiceAntigo];
        
        // SE o novo produto couber no espaço alocado original (tamanho novo <= tamanho antigo)
        if (produtoAtualizado.tamanho <= produtoAntigo.tamanho) {
            
            // 2. Sobrescreve no LOCAL ORIGINAL (Update In Place)
            // O novo produto herda o tamanho alocado do registro antigo.
            produtoAtualizado.tamanho = produtoAntigo.tamanho;
            produtoAtualizado.ativo = true;
            produtos[indiceAntigo] = produtoAtualizado;
            
            await this.salvarProdutos(produtos);
            
        } else {
            // 3. SE o novo produto é MAIOR, precisamos de um novo local (Delete and Append)
            
            // "Mata" o registro antigo (cria a lápide 0x2A)
            produtoAntigo.ativo = false;
            
            // Salva o estado com o antigo deletado (adiciona o espaço ao pool de blocos livres)
            await this.salvarProdutos(produtos);
            
            // Insere o produto atualizado usando a lógica de criação (Best-Fit ou Append)
            // Como o ID já existe, ele será usado para identificar a atualização.
            await this.criarProduto(produtoAtualizado);
        }
    }
}

// Exporta uma instância única (Singleton) para ser usada em todo o app
export const produtoService = new ProdutoService();