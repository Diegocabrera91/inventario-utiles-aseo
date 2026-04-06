# Inventario de Útiles de Aseo

Aplicación web sencilla para gestionar el inventario de útiles de aseo usando el navegador.

## Funcionalidades principales

- Registro de artículos con código de barras, descripción, stock mínimo y stock inicial.
- Registro de entradas y salidas usando un lector de código de barras (funciona como teclado).
- Almacenamiento local en el navegador (localStorage).
- Tabla de inventario con indicador de reposición cuando el stock actual es menor o igual al mínimo.
- Exportación a archivo CSV compatible con Excel para revisar reposición de inventario.

## Cómo usar

1. Abra `index.html` en su navegador (o publíquelo con GitHub Pages).
2. Registre cada artículo en el formulario "Registrar / editar artículo".
3. Para registrar movimientos:
   - Seleccione "Entrada" o "Salida".
   - Indique la cantidad.
   - Coloque el cursor en el campo "Código escaneado".
   - Pase el código por el lector de barras (el lector escribe el código y presiona Enter).
4. Use el botón "Descargar Excel (CSV)" para obtener un archivo que puede abrir en Excel o Google Sheets.

> Nota: Al usar almacenamiento local del navegador, cada PC/navegador mantiene su propio inventario. Para uso multiusuario se requeriría un backend (API/servidor) adicional.
