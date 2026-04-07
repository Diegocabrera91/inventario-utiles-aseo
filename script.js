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
  const res = await fetch(API_URL, { method: 'POST', body: params });
  return res.json();
}

async function renderInventario(inventarioExistente) {
  const inventario = inventarioExistente || await cargarInventario();
  const cuerpo = document.getElementById('tablaInventario');
  cuerpo.innerHTML = '';

  inventario.forEach((articulo) => {
    const tr = document.createElement('tr');
    const estado = articulo.stockActual <= articulo.stockMinimo ? 'Reponer' : 'OK';
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

  cuerpo.querySelectorAll('.btn-editar').forEach((btn) => {
    btn.addEventListener('click', () => {
      const articulo = inventario.find((a) => a.codigo === btn.dataset.codigo);
      if (!articulo) return;
      document.getElementById('codigoEscaneado').value = articulo.codigo;
      document.getElementById('descripcion').value = articulo.descripcion;
      document.getElementById('stockMinimo').value = articulo.stockMinimo ?? 0;
      document.getElementById('descripcion').focus();
    });
  });

  cuerpo.querySelectorAll('.btn-eliminar').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm(`¿Eliminar el artículo con código ${btn.dataset.codigo}?`)) return;
      try {
        const resp = await apiPost({ accion: 'eliminarArticulo', codigo: btn.dataset.codigo });
        if (resp.ok) await renderInventario(resp.inventario);
        else alert(resp.mensaje || 'No se pudo eliminar el artículo.');
      } catch (e) {
        console.error(e);
        alert('Error al intentar eliminar el artículo.');
      }
    });
  });
}

async function manejarMovimiento(event) {
  event.preventDefault();
  const tipo = document.getElementById('tipoMovimiento').value;
  const cantidad = Number(document.getElementById('cantidadMovimiento').value || '1');
  const codigo = document.getElementById('codigoEscaneado').value.trim();
  const mensaje = document.getElementById('mensajeMovimiento');

  if (!codigo || cantidad <= 0) return;

  const resp = await apiPost({ accion: 'movimiento', tipo, cantidad, codigo });

  if (!resp.ok) {
    mensaje.textContent = `No se pudo aplicar el movimiento (${resp.mensaje || 'error'}).`;
    mensaje.className = 'mensaje error';
  } else {
    let inventarioActual = resp.inventario;

    if (resp.nuevoArticulo) {
      const descripcionForm = document.getElementById('descripcion').value.trim();
      const stockMinimoForm = Number(document.getElementById('stockMinimo').value || '0');
      try {
        const respGuardar = await apiPost({
          accion: 'guardarArticulo',
          codigo,
          descripcion: descripcionForm,
          stockMinimo: stockMinimoForm,
          stockInicial: cantidad,
        });
        if (respGuardar.ok && respGuardar.inventario) {
          inventarioActual = respGuardar.inventario;
          mensaje.textContent = descripcionForm
            ? `Se creó y guardó el artículo ${codigo} con descripción automáticamente.`
            : `Se creó el artículo ${codigo} sin descripción. Puede actualizarla con el botón Editar.`;
        } else {
          mensaje.textContent = `Se creó el artículo ${codigo}, pero no se pudo guardar los datos.`;
        }
      } catch (e) {
        console.error(e);
        mensaje.textContent = `Se creó el artículo ${codigo}, pero falló el guardado automático.`;
      }
    } else {
      mensaje.textContent = `Movimiento de ${tipo} aplicado (x${cantidad}) al código ${codigo}.`;
    }

    await renderInventario(inventarioActual);
    mensaje.className = 'mensaje ok';
  }

  document.getElementById('codigoEscaneado').value = '';
  document.getElementById('codigoEscaneado').focus();
}

async function exportarCSV() {
  const inventario = await cargarInventario();
  if (!inventario.length) return;
  const encabezados = ['codigo', 'descripcion', 'stock_actual', 'stock_minimo'];
  const filas = inventario.map((a) => [a.codigo, a.descripcion, a.stockActual, a.stockMinimo]);
  let csv = encabezados.join(';') + '\n';
  filas.forEach((fila) => { csv += fila.join(';') + '\n'; });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'inventario_utiles_aseo.csv';
  link.click();
  URL.revokeObjectURL(url);
}

// ── Modal de cámara ──────────────────────────────────────────────
let scannerActivo = false;

function abrirModal() {
  const modal = document.getElementById('scannerModal');
  modal.classList.add('activo');
}

function cerrarModal() {
  document.getElementById('scannerModal').classList.remove('activo');
  detenerEscanerCamara();
}

function iniciarEscanerCamara() {
  if (scannerActivo) { cerrarModal(); return; }
  if (!window.Quagga) { alert('El escáner de cámara no está disponible.'); return; }

  abrirModal();

  Quagga.init({
    inputStream: {
      type: 'LiveStream',
      target: document.getElementById('scannerContainer'),
      constraints: { facingMode: 'environment' },
    },
    decoder: {
      readers: ['code_128_reader', 'ean_reader', 'ean_8_reader', 'upc_reader'],
    },
    locate: true,
  }, (err) => {
    if (err) {
      console.error(err);
      alert('No se pudo iniciar la cámara.');
      cerrarModal();
      return;
    }
    Quagga.start();
    scannerActivo = true;

    Quagga.onDetected((result) => {
      if (!result?.codeResult?.code) return;
      const codigo = result.codeResult.code;

      document.getElementById('codigoEscaneado').value = codigo;

      const mensaje = document.getElementById('mensajeMovimiento');
      mensaje.textContent = `Código leído: ${codigo}. Complete los datos y aplique el movimiento.`;
      mensaje.className = 'mensaje ok';

      cerrarModal();

      setTimeout(() => {
        document.getElementById('descripcion').focus();
      }, 120);
    });
  });
}

function detenerEscanerCamara() {
  if (scannerActivo && window.Quagga) {
    Quagga.stop();
    Quagga.offDetected();
  }
  scannerActivo = false;
}

// ── Inicialización ───────────────────────────────────────────────
async function iniciar() {
  document.getElementById('formMovimiento').addEventListener('submit', manejarMovimiento);
  document.getElementById('btnExportar').addEventListener('click', () => { exportarCSV(); });
  document.getElementById('toggleScannerBtn').addEventListener('click', iniciarEscanerCamara);
  document.getElementById('cerrarScannerBtn').addEventListener('click', cerrarModal);

  // Cerrar modal al hacer clic en el overlay (fuera del panel)
  document.getElementById('scannerModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('scannerModal')) cerrarModal();
  });

  // Cerrar modal con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrarModal();
  });

  await renderInventario();

  const inputEscaneado = document.getElementById('codigoEscaneado');
  if (inputEscaneado) {
    window.addEventListener('click', () => {
      if (!document.getElementById('scannerModal').classList.contains('activo')) {
        inputEscaneado.focus();
      }
    });
  }
}

window.addEventListener('DOMContentLoaded', () => { iniciar(); });
