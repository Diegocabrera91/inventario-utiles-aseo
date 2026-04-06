const API_URL = 'https://script.google.com/macros/s/AKfycbw4NCW8_rQceDX2A-MtC8pUaTAip-VHxF9-97UrOIuE4pJZK43VuWWqLoDSvNpJlg2t/exec';

async function cargarInventario() {
  const res = await fetch(API_URL);
  const data = await res.json();
  return data.inventario || [];
}

async function apiPost(payload) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function renderInventario(inventarioExistente) {
  const inventario = inventarioExistente || await cargarInventario();
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

async function manejarFormularioArticulo(event) {
  event.preventDefault();
  const codigo = document.getElementById('codigo').value.trim();
  const descripcion = document.getElementById('descripcion').value.trim();
  const stockMinimo = Number(document.getElementById('stockMinimo').value || '0');
  const stockInicial = Number(document.getElementById('stockInicial').value || '0');

  if (!codigo || !descripcion) return;

  await apiPost({
    accion: 'guardarArticulo',
    codigo,
    descripcion,
    stockMinimo,
    stockInicial,
  });

  await renderInventario();
  event.target.reset();
  document.getElementById('codigo').focus();
}

async function manejarMovimiento(event) {
  event.preventDefault();
  const tipo = document.getElementById('tipoMovimiento').value;
  const cantidad = Number(document.getElementById('cantidadMovimiento').value || '1');
  const codigo = document.getElementById('codigoEscaneado').value.trim();
  const mensaje = document.getElementById('mensajeMovimiento');

  if (!codigo || cantidad <= 0) return;

  const resp = await apiPost({
    accion: 'movimiento',
    tipo,
    cantidad,
    codigo,
  });

  if (!resp.ok) {
    mensaje.textContent = `No se pudo aplicar el movimiento (${resp.mensaje || 'error'}).`;
    mensaje.className = 'mensaje error';
  } else {
    await renderInventario(resp.inventario);
    mensaje.textContent = `Movimiento de ${tipo} aplicado (x${cantidad}) al código ${codigo}.`;
    mensaje.className = 'mensaje ok';
  }

  document.getElementById('codigoEscaneado').value = '';
  document.getElementById('codigoEscaneado').focus();
}

async function exportarCSV() {
  const inventario = await cargarInventario();
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

async function iniciar() {
  document.getElementById('formArticulo').addEventListener('submit', manejarFormularioArticulo);
  document.getElementById('formMovimiento').addEventListener('submit', manejarMovimiento);
  document.getElementById('btnExportar').addEventListener('click', () => { exportarCSV(); });

  await renderInventario();

  // Mantener el foco en el campo de código escaneado para usar el lector como teclado
  const inputEscaneado = document.getElementById('codigoEscaneado');
  window.addEventListener('click', () => inputEscaneado.focus());
}

window.addEventListener('DOMContentLoaded', () => { iniciar(); });
