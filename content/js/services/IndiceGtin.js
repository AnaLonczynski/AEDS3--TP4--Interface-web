export class IndiceGtin {
  constructor() {
    this.indice = JSON.parse(localStorage.getItem("indiceGtin") || "{}");
  }

  salvar(gtin, id) {
    this.indice[gtin] = id;
    localStorage.setItem("indiceGtin", JSON.stringify(this.indice));
  }

  buscar(gtin) {
    return this.indice[gtin] ?? null;
  }

  remover(gtin) {
    delete this.indice[gtin];
    localStorage.setItem("indiceGtin", JSON.stringify(this.indice));
  }
}
