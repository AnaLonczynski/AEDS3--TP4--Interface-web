/* ==========================================================================
    CLASSE: Produto
    --------------------------------------------------------------------------
    Objetivo: Servir como molde (blueprint) para criar objetos de produto.
                Além de armazenar os dados, ela calcula o tamanho físico que
                o registro ocuparia em um arquivo binário.
    Uso: const p = new Produto("Café", "789...", "Extra forte");
============================================================================= */

export class Produto {
    
    /**
     * Construtor: Inicializa um novo Produto.
     * * @param {string} nome - Nome do produto (Tamanho variável).
     * @param {string} gtin - Código de barras (Tamanho fixo: 13 caracteres).
     * @param {string} descricao - Descrição detalhada (Tamanho variável).
     * @param {number|string|null} id - Identificador único (8 bytes). Se null, será gerado depois.
     * @param {boolean} ativo - Status do registro (true = ativo, false = excluído logicamente).
     */
    constructor(nome, gtin, descricao, id = null, ativo = true) {
        // Garante que o ID seja numérico caso venha como string do HTML, ou null se novo
        this.id = id ? Number(id) : null;
        
        this.nome = nome;
        this.gtin = gtin;
        this.descricao = descricao;
        this.ativo = ativo;
        
        /* ------------------------------------------------------------------
            CÁLCULO DO TAMANHO DO REGISTRO (BYTE SIZE)
            Objetivo: Determinar o tamanho total do bloco para o Hex Dump.
            Isso simula o cabeçalho de tamanho que existe em arquivos de
            registros de tamanho variável.
           ------------------------------------------------------------------ */
        
        // TextEncoder: Transforma string em bytes UTF-8.
        // Importante: "Café" tem 4 letras, mas 5 bytes (o 'é' ocupa 2 bytes).
        // Usamos .length do array de bytes, não .length da string.
        const nomeBytes = new TextEncoder().encode(this.nome).length;
        const descBytes = new TextEncoder().encode(this.descricao).length;
        
        // Soma total dos bytes:
        // 1 byte  : Lápide (Status: Ativo/Removido)
        // 2 bytes : Indicador de Tamanho do Registro (short int)
        // 8 bytes : ID (simulando um long/bigint)
        // 13 bytes: GTIN (campo de tamanho fixo)
        // N bytes : Nome (variável)
        // M bytes : Descrição (variável)
        this.tamanho = 1 + 2 + 8 + 13 + nomeBytes + descBytes;
    }
}