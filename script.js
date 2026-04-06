const STORAGE_KEY = 'inventarioUtilesAseo';

function cargarInventario() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

function guardarInventario(inventario) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(inventario));
}

function buscarArticulo(inventario, codigo) {
  return inventario.find((a) => a.codigo === codigo);
}

function renderInventario() {
  const inventario = cargarInventario();
  const cuerpo = document.getElementById('tablaInventario');
  cuerpo.innerHTML = '';

  inventario.forEach((articulo) => {
    const tr = document.createElement('tr');

    const estado = articulo.stockActual <= articulo.stockMinimo
      ? 'Reponer'
      : 'OK';

    tr.innerHTML = `
      <td>${articulo.codigo}</td>
      <td>${articulo.descripcion}</td>
      <td>${articulo.stockActual}</td>
      <td>${articulo.stockMinimo}</td>
      <td class="${estado === 'Reponer' ? 'reponer' : 'ok'}">${estado}</td>
    `;

    cuerpo.appendChild(tr);
  });
}

function manejarFormularioArticulo(event) {
  event.preventDefault();
  const codigo = document.getElementById('codigo').value.trim();
  const descripcion = document.getElementById('descripcion').value.trim();
  const stockMinimo = Number(document.getElementById('stockMinimo').value || '0');
  const stockInicial = Number(document.getElementById('stockInicial').value || '0');

  if (!codigo || !descripcion) return;

  const inventario = cargarInventario();
  const existente = buscarArticulo(inventario, codigo);

  if (existente) {
    existente.descripcion = descripcion;
    existente.stockMinimo = stockMinimo;
    // No tocamos el stockActual aquí para no sobreescribir movimientos
  } else {
    inventario.push({
      codigo,
      descripcion,
      stockMinimo,
      stockActual: stockInicial,
    });
  }

  guardarInventario(inventario);
  renderInventario();
  event.target.reset();
  document.getElementById('codigo').focus();
}

function manejarMovimiento(event) {
  event.preventDefault();
  const tipo = document.getElementById('tipoMovimiento').value;
  const cantidad = Number(document.getElementById('cantidadMovimiento').value || '1');
  const codigo = document.getElementById('codigoEscaneado').value.trim();
  const mensaje = document.getElementById('mensajeMovimiento');

  if (!codigo || cantidad <= 0) return;

  const inventario = cargarInventario();
  const articulo = buscarArticulo(inventario, codigo);

  if (!articulo) {
    mensaje.textContent = `El código ${codigo} no existe en el inventario. Regístrelo primero en el formulario de arriba.`;
    mensaje.className = 'mensaje error';
  } else {
    if (tipo === 'entrada') {
      articulo.stockActual += cantidad;
    } else if (tipo === 'salida') {
      articulo.stockActual -= cantidad;
      if (articulo.stockActual < 0) {
        articulo.stockActual = 0;
      }
    }

    guardarInventario(inventario);
    renderInventario();
    mensaje.textContent = `Movimiento de ${tipo} aplicado a ${articulo.descripcion} (x${cantidad}).`;
    mensaje.className = 'mensaje ok';
  }

  document.getElementById('codigoEscaneado').value = '';
  document.getElementById('codigoEscaneado').focus();
}

function exportarCSV() {
  const inventario = cargarInventario();
  if (!inventario.length) return;

  const encabezados = ['codigo', 'descripcion', 'stock_actual', 'stock_minimo'];
  const filas = inventario.map((a) => [
    a.codigo,
    a.descripcion,
    a.stockActual,
    a.stockMinimo,
  ]);

  let csv = encabezados.join(';') + '\n';
  filas.forEach((fila) => {
    csv += fila.join(';') + '\n';
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'inventario_utiles_aseo.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function iniciar() {
  document.getElementById('formArticulo').addEventListener('submit', manejarFormularioArticulo);
  document.getElementById('formMovimiento').addEventListener('submit', manejarMovimiento);
  document.getElementById('btnExportar').addEventListener('click', exportarCSV);

  renderInventario();

  // Mantener el foco en el campo de código escaneado para usar el lector como teclado
  const inputEscaneado = document.getElementById('codigoEscaneado');
  window.addEventListener('click', () => inputEscaneado.focus());
}

window.addEventListener('DOMContentLoaded', iniciar);
