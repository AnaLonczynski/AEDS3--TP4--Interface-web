import { ProdutoController } from './controllers/ProdutoController.js';
import { DB_KEY, DB_HEADER_KEY } from './services/ProdutoService.js';

/* ==========================================================================
    MAIN / ENTRY POINT
-----------------------------------------------------------------------------
    Objetivo: Inicializar a aplicação assim que o navegador terminar de 
        carregar a estrutura HTML.
    Comportamento Atual: MODO DE TESTE (Hard Reset a cada refresh).
============================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    
    /* ----------------------------------------------------------------------
        1. LIMPEZA DE ESTADO (HARD RESET)
    -------------------------------------------------------------------------
        ATENÇÃO: As linhas abaixo apagam o LocalStorage toda vez que a página abre.
        Objetivo: Garantir que seus testes de estrutura de dados comecem sempre
        do zero, evitando "sujeira" de testes anteriores.

        -> Se quiser persistência (manter os dados ao fechar a aba),
            comente este bloco abaixo.
    ------------------------------------------------------------------------- */
    
    // Remove o banco de dados de registros (Arquivo de dados)
    localStorage.removeItem(DB_KEY);
    // Inicializa o banco com um array vazio []
    localStorage.setItem(DB_KEY, JSON.stringify([]));
    
    // Remove o cabeçalho (Arquivo de metadados)
    localStorage.removeItem(DB_HEADER_KEY);
    // Reinicia o contador de IDs (lastId) para 0
    localStorage.setItem(DB_HEADER_KEY, JSON.stringify({ lastId: 0 }));

    /* ----------------------------------------------------------------------
        2. INICIALIZAÇÃO DO CONTROLADOR (BOOTSTRAP)
    -------------------------------------------------------------------------
        Objetivo: Instanciar a classe que gerencia a tela e ligar os eventos.
    ------------------------------------------------------------------------- */
    
    const controller = new ProdutoController();
    
    // O método init() dispara a leitura inicial e configura o ResizeObserver
    controller.init();
});