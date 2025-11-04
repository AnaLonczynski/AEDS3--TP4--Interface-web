class Produto {
    #nome;
    #id;
    #gtin;
    #descricao;
    #ativo;

    constructor(status, nome, id, gtin, descricao) {
        this.#ativo = status;
        this.#nome = nome;
        this.#id = id;
        this.#descricao = descricao;
        this.#gtin = gtin;
    }

    //GETTERS N SETTERS
    getNome() { return this.#nome; }
    setNome(nome) { this.#nome = nome; }
    getGtin() { return this.#gtin; }
    setGtin(gtin) { this.#gtin = gtin; }
    getId() { return this.#id; }
    setId(id) { this.#id = id; }
    getDescricao() { return this.#descricao; }
    setDescricao(des) { this.#descricao = des; }
    getAtivo() { return this.#ativo; }
    setAtivo(status) { this.#ativo = status; }


    toString() {
        return "ID: " + this.id +
            "\nGTIN: " + this.gtin +
            "\nNOME: " + this.nome +
            "\nDESCRICAO: " + this.descricao +
            "\nATIVO: " + this.ativo;
    }

    /**
   * Converte os atributos do objeto em uma lista de inteiros.
   * Cada caractere das strings é convertido para seu código Unicode (charCode).
   */
    toIntArray() {
        const result = [];

        // id (inteiro direto)
        result.push(this.id);

        // Função auxiliar para converter string → sequência de inteiros
        const strToIntArray = (str) => {
            const arr = [];
            for (let i = 0; i < str.length; i++) {
                arr.push(str.charCodeAt(i)); // converte cada caractere em código inteiro
            }
            return arr;
        };

        // gtin, nome e descricao (convertendo cada caractere em número)
        result.push(...strToIntArray(this.gtin));
        result.push(...strToIntArray(this.nome));
        result.push(...strToIntArray(this.descricao));

        // ativo (boolean → 1 ou 0)
        result.push(this.ativo ? 1 : 0);

        return result;
    }

    /**
     * Reconstrói o objeto a partir de uma lista de inteiros (exemplo simplificado)
     */
    static fromIntArray(arr) {
        // exemplo simples: apenas demonstra leitura dos primeiros valores
        const id = arr[0];
        // reconstrução real exigiria saber onde cada campo começa/termina
        return new Produto(id, "", "", "", false);
    }
}
