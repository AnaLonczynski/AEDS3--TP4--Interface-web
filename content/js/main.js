document.getElementById("fileInput").addEventListener("change", handleFile);

function handleFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => displayHex(e.target.result);
  reader.readAsArrayBuffer(file);
}

function displayHex(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const tbody = document.querySelector("#hexTable tbody");
  tbody.innerHTML = "";

  const bytesPerRow = 16;

  // Definir regiões de bytes para cada campo
  const fields = [
    { name: "id", start: 0, end: 3, tooltip: "int32 - Identificador" },
    { name: "gtin", start: 16, end: 25, tooltip: "string - Código GTIN" },
    { name: "nome", start: 32, end: 46, tooltip: "string - Nome do produto" },
    { name: "descricao", start: 47, end: 63, tooltip: "string - Descrição" },
    { name: "ativo", start: 64, end: 64, tooltip: "boolean - Ativo/Inativo" }
  ];

  for (let i = 0; i < bytes.length; i += bytesPerRow) {
    const rowBytes = bytes.slice(i, i + bytesPerRow);
    const offset = i.toString(16).padStart(8, "0").toUpperCase();

    // Gera cada byte com classe de campo se estiver em uma região reconhecida
    const hexBytes = Array.from(rowBytes).map((b, idx) => {
      const byteIndex = i + idx;
      const field = fields.find(f => byteIndex >= f.start && byteIndex <= f.end);

      if (field) {
        return `<span class="byte ${field.name}" data-tooltip="${field.tooltip}">
                  ${b.toString(16).padStart(2, "0").toUpperCase()}
                </span>`;
      } else {
        return `<span class="byte">${b.toString(16).padStart(2, "0").toUpperCase()}</span>`;
      }
    }).join(" ");

    const text = Array.from(rowBytes)
      .map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : ".")
      .join("");

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${offset}</td>
      <td>${hexBytes}</td>
      <td>${text}</td>
    `;
    tbody.appendChild(tr);
  }
}
