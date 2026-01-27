

## Plan: Agregar Cheque a Formas de Pago

### Problema Detectado
La tabla `formas_pago` no contiene la opción "Cheque". Las formas de pago actuales son:
- Efectivo
- Crédito
- Débito
- QR
- Transferencia

### Solucion

Agregar "Cheque" a la tabla `formas_pago` mediante una migración de base de datos.

---

### Migración SQL

```sql
INSERT INTO formas_pago (nombre, activo) 
VALUES ('Cheque', true);
```

---

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| Nueva migración SQL | Insertar "Cheque" en tabla formas_pago |

---

### Resultado Esperado

Después de aplicar esta migración:
1. "Cheque" aparecerá en el selector de forma de pago
2. Al seleccionar "Cheque", se mostrará el formulario para ingresar los datos del cheque
3. Pagos con "Cheque" o "Transferencia" quedarán en estado pendiente de imputación

---

### Nota sobre Transferencia
"Transferencia" ya existe en la base de datos y debería aparecer en el selector. Si no la ves, puede ser un tema de caché del navegador. Luego de aplicar esta migración, ambas opciones estarán disponibles.

