// =====================================
// INVENTARIO CONECTADO A GOOGLE SHEETS
// =====================================

// ==========================
// CONFIG
// ==========================
const API_URL = "https://script.google.com/macros/s/AKfycbyxDXKduKoEM9BezG7fVyB4qIkLz7Nz3SraJLQwa5kH-A27EdXB56yFUBqaP7IbW0EC/exec";

// ==========================
// ESTADO
// ==========================
let inventario = [];
let historial = [];
let scannerActivo = false;
let ultimoCodigoDetectado = null;
let ultimoScanTs = 0;

// ==========================
// ELEMENTOS
// ==========================
const formMovimiento = document.getElementById("formMovimiento");
const codigoEscaneado = document.getElementById("codigoEscaneado");
const descripcion = document.getElementById("descripcion");
const categoria = document.getElementById("categoria");
const stockMinimo = document.getElementById("stockMinimo");
const tipoMovimiento = document.getElementById("tipoMovimiento");
const cantidadMovimiento = document.getElementById("cantidadMovimiento");
const responsableMovimiento = document.getElementById("responsableMovimiento");
const observacionMovimiento = document.getElementById("observacionMovimiento");

const btnLimpiarFormulario = document.getElementById("btnLimpiarFormulario");
const mensajeMovimiento = document.getElementById("mensajeMovimiento");

const tablaInventario = document.getElementById("tablaInventario");
const tablaHistorial = document.getElementById("tablaHistorial");

const btnExportar = document.getElementById("btnExportar");
const btnExportarHistorial = document.getElementById("btnExportarHistorial");

const busquedaInventario = document.getElementById("busquedaInventario");
const filtroEstado = document.getElementById("filtroEstado");

const resumenTotalProductos = document.getElementById("resumenTotalProductos");
const resumenTotalUnidades = document.getElementById("resumenTotalUnidades");
const resumenBajoMinimo = document.getElementById("resumenBajoMinimo");
const resumenSinStock = document.getElementById("resumenSinStock");

const infoEstadoProducto = document.getElementById("infoEstadoProducto");
const infoStockActual = document.getElementById("infoStockActual");
const infoStockMinimo = document.getElementById("infoStockMinimo");
const infoUltimoMovimiento = document.getElementById("infoUltimoMovimiento");

const alertaSistema = document.getElementById("alertaSistema");
const alertaTitulo = document.getElementById("alertaTitulo");
const alertaTexto = document.getElementById("alertaTexto");

const toggleScannerBtn = document.getElementById("toggleScannerBtn");
const cerrarScannerBtn = document.getElementById("cerrarScannerBtn");
const scannerModal = document.getElementById("scannerModal");
const scannerEstado = document.getElementById("scannerEstado");

// ==========================
// INIT
// ==========================
document.addEventListener("DOMContentLoaded", async () => {
  prepararEventos();
  await cargarDatosDesdeSheets();
  autocompletarDesdeCodigo();
});

// ==========================
// EVENTOS
// ==========================
function prepararEventos() {
  formMovimiento.addEventListener("submit", manejarMovimiento);
  btnLimpiarFormulario.addEventListener("click", limpiarFormulario);

  codigoEscaneado.addEventListener("input", autocompletarDesdeCodigo);
  codigoEscaneado.addEventListener("blur", autocompletarDesdeCodigo);

  busquedaInventario.addEventListener("input", renderInventario);
  filtroEstado.addEventListener("change", renderInventario);

  btnExportar.addEventListener("click", exportarInventarioCSV);
  btnExportarHistorial.addEventListener("click", exportarHistorialCSV);

  toggleScannerBtn.addEventListener("click", abrirScanner);
  cerrarScannerBtn.addEventListener("click", cerrarScanner);

  scannerModal.addEventListener("click", (e) => {
    if (e.target === scannerModal) cerrarScanner();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && scannerActivo) cerrarScanner();
  });
}

// ==========================
// CARGA DESDE GOOGLE SHEETS
// ==========================
async function cargarDatosDesdeSheets() {
  try {
    mostrarInfo("Cargando datos", "Sincronizando inventario con Google Sheets...");

    const response = await fetch(`${API_URL}?action=getData`);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "No se pudo cargar la información");
    }

    inventario = (data.inventario || []).map(normalizarProducto);
    historial = (data.historial || []).map(normalizarHistorial);

    renderTodo();
    mostrarExito("Datos cargados", "Inventario sincronizado correctamente.");
  } catch (error) {
    console.error(error);
    mostrarError("Error de conexión", error.message || "No se pudo conectar con Google Sheets.");
  }
}

function normalizarProducto(item) {
  return {
    codigo: String(item.codigo || "").trim(),
    descripcion: String(item.descripcion || "").trim(),
    categoria: String(item.categoria || "Sin categoría").trim(),
    stockActual: Number(item.stockActual || 0),
    stockMinimo: Number(item.stockMinimo || 0),
    ultimoMovimiento: String(item.ultimoMovimiento || "Sin registros")
  };
}

function normalizarHistorial(item) {
  return {
    fecha: String(item.fecha || ""),
    codigo: String(item.codigo || ""),
    descripcion: String(item.descripcion || ""),
    categoria: String(item.categoria || ""),
    tipo: String(item.tipo || ""),
    cantidad: Number(item.cantidad || 0),
    responsable: String(item.responsable || "No informado"),
    observacion: String(item.observacion || ""),
    stockAntes: Number(item.stockAntes || 0),
    stockDespues: Number(item.stockDespues || 0)
  };
}

// ==========================
// GUARDAR MOVIMIENTO
// ==========================
async function manejarMovimiento(e) {
  e.preventDefault();

  const codigo = limpiarTexto(codigoEscaneado.value);
  const desc = limpiarTexto(descripcion.value);
  const cat = limpiarTexto(categoria.value);
  const min = parseInt(stockMinimo.value || "0", 10);
  const tipo = tipoMovimiento.value;
  const cantidad = parseInt(cantidadMovimiento.value || "0", 10);
  const responsable = limpiarTexto(responsableMovimiento.value);
  const observacion = limpiarTexto(observacionMovimiento.value);

  if (!codigo) {
    mostrarError("Código requerido", "Debe ingresar o escanear un código.");
    codigoEscaneado.focus();
    return;
  }

  if (!desc) {
    mostrarError("Descripción requerida", "Debe ingresar la descripción del artículo.");
    descripcion.focus();
    return;
  }

  if (isNaN(min) || min < 0) {
    mostrarError("Stock mínimo inválido", "El stock mínimo debe ser 0 o mayor.");
    stockMinimo.focus();
    return;
  }

  if (isNaN(cantidad) || cantidad <= 0) {
    mostrarError("Cantidad inválida", "La cantidad debe ser mayor a 0.");
    cantidadMovimiento.focus();
    return;
  }

  const producto = inventario.find((item) => item.codigo === codigo);

  if (!producto && tipo === "salida") {
    mostrarError("Producto no existe", "No puede registrar salida de un artículo inexistente.");
    return;
  }

  if (producto && tipo === "salida" && producto.stockActual < cantidad) {
    mostrarError(
      "Stock insuficiente",
      `Stock actual: ${producto.stockActual}. No puede sacar ${cantidad}.`
    );
    return;
  }

  const payload = {
    codigo,
    descripcion: desc,
    categoria: cat || "Sin categoría",
    stockMinimo: min,
    tipo,
    cantidad,
    responsable: responsable || "No informado",
    observacion: observacion || ""
  };

  try {
    mostrarInfo("Guardando movimiento", "Enviando datos a Google Sheets...");

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action: "guardarMovimiento",
        payload
      })
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || "No se pudo guardar el movimiento");
    }

    await cargarDatosDesdeSheets();

    mostrarExito("Movimiento guardado", `${capitalizar(tipo)} registrada correctamente.`);
    mensajeMovimiento.textContent = `${capitalizar(tipo)} registrada correctamente.`;

    limpiarFormulario(false);
    codigoEscaneado.focus();
  } catch (error) {
    console.error(error);
    mostrarError("Error al guardar", error.message || "No se pudo guardar el movimiento.");
  }
}

// ==========================
// AUTOCOMPLETAR PRODUCTO
// ==========================
function autocompletarDesdeCodigo() {
  const codigo = limpiarTexto(codigoEscaneado.value);

  if (!codigo) {
    actualizarInfoProducto();
    return;
  }

  const producto = inventario.find((item) => item.codigo === codigo);

  if (producto) {
    descripcion.value = producto.descripcion || "";
    categoria.value = producto.categoria || "";
    stockMinimo.value = producto.stockMinimo ?? 0;
  }

  actualizarInfoProducto();
}

function actualizarInfoProducto() {
  const codigo = limpiarTexto(codigoEscaneado.value);
  const producto = inventario.find((item) => item.codigo === codigo);

  if (!codigo) {
    infoEstadoProducto.textContent = "Sin seleccionar";
    infoStockActual.textContent = "0";
    infoStockMinimo.textContent = "0";
    infoUltimoMovimiento.textContent = "Sin registros";
    return;
  }

  if (!producto) {
    infoEstadoProducto.textContent = "Artículo nuevo / no registrado";
    infoStockActual.textContent = "0";
    infoStockMinimo.textContent = stockMinimo.value || "0";
    infoUltimoMovimiento.textContent = "Sin registros";
    return;
  }

  infoEstadoProducto.textContent = obtenerEstadoTexto(producto.stockActual, producto.stockMinimo);
  infoStockActual.textContent = producto.stockActual;
  infoStockMinimo.textContent = producto.stockMinimo;
  infoUltimoMovimiento.textContent = producto.ultimoMovimiento || "Sin registros";
}

// ==========================
// RENDER GENERAL
// ==========================
function renderTodo() {
  renderDashboard();
  renderInventario();
  renderHistorial();
  actualizarInfoProducto();
}

function renderDashboard() {
  const totalProductos = inventario.length;
  const totalUnidades = inventario.reduce((acc, item) => acc + (item.stockActual || 0), 0);
  const bajoMinimo = inventario.filter(
    (item) => item.stockActual > 0 && item.stockActual <= item.stockMinimo
  ).length;
  const sinStock = inventario.filter((item) => item.stockActual <= 0).length;

  resumenTotalProductos.textContent = totalProductos;
  resumenTotalUnidades.textContent = totalUnidades;
  resumenBajoMinimo.textContent = bajoMinimo;
  resumenSinStock.textContent = sinStock;
}

function renderInventario() {
  const texto = limpiarTexto(busquedaInventario.value).toLowerCase();
  const estadoFiltro = filtroEstado.value;

  let datos = [...inventario];

  if (texto) {
    datos = datos.filter((item) =>
      item.codigo.toLowerCase().includes(texto) ||
      item.descripcion.toLowerCase().includes(texto) ||
      (item.categoria || "").toLowerCase().includes(texto)
    );
  }

  if (estadoFiltro !== "todos") {
    datos = datos.filter((item) => {
      const estado = obtenerEstadoClave(item.stockActual, item.stockMinimo);
      return estado === estadoFiltro;
    });
  }

  datos.sort((a, b) => a.descripcion.localeCompare(b.descripcion, "es"));

  tablaInventario.innerHTML = "";

  if (datos.length === 0) {
    tablaInventario.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center;">No hay artículos para mostrar.</td>
      </tr>
    `;
    return;
  }

  datos.forEach((item) => {
    const estadoTexto = obtenerEstadoTexto(item.stockActual, item.stockMinimo);
    const estadoClase = obtenerEstadoClave(item.stockActual, item.stockMinimo);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(item.codigo)}</td>
      <td>${esc(item.descripcion)}</td>
      <td>${esc(item.categoria || "Sin categoría")}</td>
      <td>${item.stockActual}</td>
      <td>${item.stockMinimo}</td>
      <td><span class="estado estado-${estadoClase}">${estadoTexto}</span></td>
      <td>${esc(item.ultimoMovimiento || "Sin registros")}</td>
      <td>
        <button type="button" class="btn-editar" data-codigo="${esc(item.codigo)}">Editar</button>
      </td>
    `;
    tablaInventario.appendChild(tr);
  });

  document.querySelectorAll(".btn-editar").forEach((btn) => {
    btn.addEventListener("click", () => cargarProductoEnFormulario(btn.dataset.codigo));
  });
}

function renderHistorial() {
  tablaHistorial.innerHTML = "";

  if (historial.length === 0) {
    tablaHistorial.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;">No hay movimientos registrados.</td>
      </tr>
    `;
    return;
  }

  historial.forEach((mov) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(mov.fecha)}</td>
      <td>${esc(mov.codigo)}</td>
      <td>${esc(mov.descripcion)}</td>
      <td>${capitalizar(esc(mov.tipo))}</td>
      <td>${mov.tipo === "ajuste" ? mov.stockDespues : mov.cantidad}</td>
      <td>${esc(mov.responsable || "No informado")}</td>
      <td>${esc(mov.observacion || "")}</td>
    `;
    tablaHistorial.appendChild(tr);
  });
}

// ==========================
// FORMULARIO
// ==========================
function cargarProductoEnFormulario(codigo) {
  const producto = inventario.find((item) => item.codigo === codigo);
  if (!producto) return;

  codigoEscaneado.value = producto.codigo;
  descripcion.value = producto.descripcion;
  categoria.value = producto.categoria || "";
  stockMinimo.value = producto.stockMinimo ?? 0;
  cantidadMovimiento.value = 1;
  tipoMovimiento.value = "entrada";
  responsableMovimiento.value = "";
  observacionMovimiento.value = "";

  actualizarInfoProducto();
  mostrarInfo("Producto cargado", `Se cargó "${producto.descripcion}" en el formulario.`);
  codigoEscaneado.focus();
}

function limpiarFormulario(limpiarCodigo = true) {
  if (limpiarCodigo) codigoEscaneado.value = "";
  descripcion.value = "";
  categoria.value = "";
  stockMinimo.value = 0;
  tipoMovimiento.value = "entrada";
  cantidadMovimiento.value = 1;
  responsableMovimiento.value = "";
  observacionMovimiento.value = "";
  mensajeMovimiento.textContent = "";
  actualizarInfoProducto();
}

// ==========================
// ESTADOS
// ==========================
function obtenerEstadoClave(stock, minimo) {
  if (stock <= 0) return "agotado";
  if (stock <= minimo) return "bajo";
  return "normal";
}

function obtenerEstadoTexto(stock, minimo) {
  if (stock <= 0) return "Sin stock";
  if (stock <= minimo) return "Bajo mínimo";
  return "Normal";
}

// ==========================
// ALERTAS
// ==========================
function mostrarExito(titulo, texto) {
  mostrarAlerta("exito", titulo, texto);
}

function mostrarError(titulo, texto) {
  mostrarAlerta("error", titulo, texto);
}

function mostrarAdvertencia(titulo, texto) {
  mostrarAlerta("advertencia", titulo, texto);
}

function mostrarInfo(titulo, texto) {
  mostrarAlerta("info", titulo, texto);
}

function mostrarAlerta(tipo, titulo, texto) {
  alertaSistema.hidden = false;
  alertaSistema.className = `alerta-sistema alerta-${tipo}`;
  alertaTitulo.textContent = titulo;
  alertaTexto.textContent = texto;

  setTimeout(() => {
    alertaSistema.hidden = true;
  }, 4000);
}

// ==========================
// EXPORTAR CSV
// ==========================
function exportarInventarioCSV() {
  if (inventario.length === 0) {
    mostrarAdvertencia("Sin datos", "No hay inventario para exportar.");
    return;
  }

  const encabezados = [
    "Código",
    "Descripción",
    "Categoría",
    "Stock actual",
    "Stock mínimo",
    "Estado",
    "Último movimiento"
  ];

  const filas = inventario.map((item) => [
    item.codigo,
    item.descripcion,
    item.categoria || "Sin categoría",
    item.stockActual,
    item.stockMinimo,
    obtenerEstadoTexto(item.stockActual, item.stockMinimo),
    item.ultimoMovimiento || "Sin registros"
  ]);

  descargarCSV("inventario_utiles_aseo.csv", encabezados, filas);
}

function exportarHistorialCSV() {
  if (historial.length === 0) {
    mostrarAdvertencia("Sin datos", "No hay historial para exportar.");
    return;
  }

  const encabezados = [
    "Fecha",
    "Código",
    "Descripción",
    "Categoría",
    "Tipo",
    "Cantidad",
    "Responsable",
    "Observación",
    "Stock antes",
    "Stock después"
  ];

  const filas = historial.map((mov) => [
    mov.fecha,
    mov.codigo,
    mov.descripcion,
    mov.categoria,
    mov.tipo,
    mov.cantidad,
    mov.responsable,
    mov.observacion,
    mov.stockAntes,
    mov.stockDespues
  ]);

  descargarCSV("historial_movimientos.csv", encabezados, filas);
}

function descargarCSV(nombreArchivo, encabezados, filas) {
  const csv = [
    encabezados.join(";"),
    ...filas.map((fila) =>
      fila.map((valor) => `"${String(valor ?? "").replace(/"/g, '""')}"`).join(";")
    )
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = nombreArchivo;
  link.click();

  URL.revokeObjectURL(url);
}

// ==========================
// SCANNER (QUAGGA2)
// ==========================
function abrirScanner() {
  if (scannerActivo) return;

  scannerModal.style.display = "flex";
  scannerEstado.textContent = "Inicializando cámara...";

  if (!window.Quagga) {
    scannerEstado.textContent = "Quagga2 no está disponible.";
    mostrarError("Escáner no disponible", "No se pudo cargar la librería del escáner.");
    return;
  }

  Quagga.init({
    inputStream: {
      type: "LiveStream",
      target: document.querySelector("#scannerVideo")?.parentElement || document.querySelector("#scannerContainer"),
      constraints: {
        facingMode: "environment"
      }
    },
    decoder: {
      readers: [
        "ean_reader",
        "ean_8_reader",
        "code_128_reader",
        "code_39_reader",
        "upc_reader",
        "upc_e_reader"
      ]
    },
    locate: true
  }, function (err) {
    if (err) {
      console.error(err);
      scannerEstado.textContent = "No se pudo iniciar la cámara.";
      mostrarError("Error de cámara", "No se pudo iniciar el escáner.");
      return;
    }

    Quagga.start();
    scannerActivo = true;
    scannerEstado.textContent = "Cámara activa. Apunte al código.";
  });

  Quagga.offDetected(onBarcodeDetected);
  Quagga.onDetected(onBarcodeDetected);
}

function cerrarScanner() {
  scannerModal.style.display = "none";
  scannerEstado.textContent = "Escáner detenido.";

  if (window.Quagga && scannerActivo) {
    Quagga.stop();
  }

  scannerActivo = false;
}

function onBarcodeDetected(result) {
  const code = result?.codeResult?.code;
  if (!code) return;

  const now = Date.now();

  if (code === ultimoCodigoDetectado && now - ultimoScanTs < 1500) {
    return;
  }

  ultimoCodigoDetectado = code;
  ultimoScanTs = now;

  codigoEscaneado.value = code;
  autocompletarDesdeCodigo();
  cerrarScanner();
  mostrarExito("Código detectado", `Código leído: ${code}`);
  codigoEscaneado.focus();
}

// ==========================
// HELPERS
// ==========================
function limpiarTexto(valor) {
  return String(valor || "").trim();
}

function capitalizar(texto) {
  return String(texto || "").charAt(0).toUpperCase() + String(texto || "").slice(1);
}

function esc(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
