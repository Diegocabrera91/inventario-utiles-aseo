const API_URL = 'https://script.google.com/macros/s/AKfycbyRgEyrVx9dreA-sIRypubIBMukJEb46JKFB3aOo2ja1SjndzpS9Ge5vLdR8Y7KpAgV/exec';

async function cargarInventario() {
  const res = await fetch(API_URL);
  const data = await res.json();
  return data.inventario || [];
}

async function apiPost(payload) {
  const params = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => {
    params.append(key, value);
  });

  const res = await fetch(API_URL, {
    method: 'POST',
    body: params,
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
      <td>
        <button type="button" class="btn-editar" data-codigo="${articulo.codigo}">Editar</button>
        <button type="button" class="btn-eliminar" data-codigo="${articulo.codigo}">Eliminar</button>
      </td>
    `;

    cuerpo.appendChild(tr);
  });

  const botonesEditar = cuerpo.querySelectorAll('.btn-editar');
  botonesEditar.forEach((btn) => {
    btn.addEventListener('click', () => {
      const codigo = btn.dataset.codigo;
      const articulo = inventario.find((a) => a.codigo === codigo);
      if (!articulo) return;

      const codigoInput = document.getElementById('codigo');
      const descripcionInput = document.getElementById('descripcion');
      const stockMinimoInput = document.getElementById('stockMinimo');
      const stockInicialInput = document.getElementById('stockInicial');

      if (codigoInput) codigoInput.value = articulo.codigo;
      if (descripcionInput) descripcionInput.value = articulo.descripcion;
      if (stockMinimoInput) stockMinimoInput.value = articulo.stockMinimo ?? 0;
      if (stockInicialInput) stockInicialInput.value = articulo.stockActual ?? 0;

      if (descripcionInput) descripcionInput.focus();
    });
  });

  const botonesEliminar = cuerpo.querySelectorAll('.btn-eliminar');
  botonesEliminar.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const codigo = btn.dataset.codigo;
      if (!confirm(`¿Eliminar el artículo con código ${codigo}?`)) return;

      try {
        const resp = await apiPost({
          accion: 'eliminarArticulo',
          codigo,
        });

        if (resp.ok) {
          await renderInventario(resp.inventario);
        } else {
          alert(resp.mensaje || 'No se pudo eliminar el artículo.');
        }
      } catch (e) {
        console.error(e);
        alert('Error al intentar eliminar el artículo.');
      }
    });
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

  // Copiar siempre el código usado al formulario de artículo para facilitar el alta
  const campoArticuloCodigo = document.getElementById('codigo');
  if (campoArticuloCodigo) {
    campoArticuloCodigo.value = codigo;
  }

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

    if (resp.nuevoArticulo) {
      mensaje.textContent = `Se creó un nuevo artículo con código ${codigo}. Complete descripción y stock mínimo arriba y guarde el artículo.`;
    } else {
      mensaje.textContent = `Movimiento de ${tipo} aplicado (x${cantidad}) al código ${codigo}.`;
    }

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

let scannerActivo = false;

function iniciarEscanerCamara() {
  const scannerContainer = document.getElementById('scannerContainer');
  const toggleBtn = document.getElementById('toggleScannerBtn');

  if (scannerActivo) {
    detenerEscanerCamara();
    return;
  }

  if (!window.Quagga) {
    alert('El escáner de cámara no está disponible.');
    return;
  }

  scannerContainer.style.display = 'block';
  toggleBtn.textContent = 'Detener cámara';

  Quagga.init({
    inputStream: {
      type: 'LiveStream',
      target: scannerContainer,
      constraints: {
        facingMode: 'environment',
      },
    },
    decoder: {
      readers: ['code_128_reader', 'ean_reader', 'ean_8_reader', 'upc_reader'],
    },
    locate: true,
  }, (err) => {
    if (err) {
      console.error(err);
      alert('No se pudo iniciar la cámara.');
      scannerContainer.style.display = 'none';
      toggleBtn.textContent = 'Usar cámara del teléfono';
      scannerActivo = false;
      return;
    }

    Quagga.start();
    scannerActivo = true;

    Quagga.onDetected((result) => {
      if (!result || !result.codeResult || !result.codeResult.code) return;
      const codigo = result.codeResult.code;
      const inputCodigo = document.getElementById('codigoEscaneado');
      inputCodigo.value = codigo;

      // Copiar también al formulario de artículo (arriba)
      const campoArticuloCodigoInner = document.getElementById('codigo');
      if (campoArticuloCodigoInner) {
        campoArticuloCodigoInner.value = codigo;
      }

      document.getElementById('mensajeMovimiento').textContent = `Código leído: ${codigo}`;
      document.getElementById('mensajeMovimiento').className = 'mensaje ok';

      // Aplicar movimiento automáticamente
      const form = document.getElementById('formMovimiento');
      form.requestSubmit();

      // Esperar un poco y luego permitir escanear otro
      setTimeout(() => {
        document.getElementById('codigoEscaneado').value = '';
        document.getElementById('codigoEscaneado').focus();
      }, 500);
    });
  });
}

function detenerEscanerCamara() {
  const scannerContainer = document.getElementById('scannerContainer');
  const toggleBtn = document.getElementById('toggleScannerBtn');

  if (scannerActivo && window.Quagga) {
    Quagga.stop();
    Quagga.offDetected();
  }

  scannerContainer.style.display = 'none';
  toggleBtn.textContent = 'Usar cámara del teléfono';
  scannerActivo = false;
}

async function iniciar() {
  document.getElementById('formArticulo').addEventListener('submit', manejarFormularioArticulo);
  document.getElementById('formMovimiento').addEventListener('submit', manejarMovimiento);
  document.getElementById('btnExportar').addEventListener('click', () => { exportarCSV(); });

  const toggleScannerBtn = document.getElementById('toggleScannerBtn');
  if (toggleScannerBtn) {
    toggleScannerBtn.addEventListener('click', iniciarEscanerCamara);
  }

  await renderInventario();

  // Mantener el foco en el campo de código escaneado para usar el lector como teclado
  const inputEscaneado = document.getElementById('codigoEscaneado');
  window.addEventListener('click', () => inputEscaneado.focus());
}

window.addEventListener('DOMContentLoaded', () => { iniciar(); });
