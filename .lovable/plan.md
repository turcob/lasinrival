
## Formatear texto con negrita en el Asistente Virtual

El chat actualmente muestra el texto plano con `<p className="whitespace-pre-wrap">{message.content}</p>`, por lo que los `**asteriscos**` del modelo de IA se muestran literalmente en vez de como **negrita**.

### Solucion

Reemplazar la renderizacion plana por un mini-parser que convierta `**texto**` en `<strong>texto</strong>`. No es necesario instalar una libreria de markdown completa para esto.

### Cambio en `src/components/assistant/ChatAssistant.tsx`

1. Agregar una funcion auxiliar `renderFormattedText` que use una expresion regular para detectar `**...**` y envolver el contenido en `<strong>`.

2. Reemplazar:
   ```tsx
   <p className="whitespace-pre-wrap">{message.content}</p>
   ```
   por:
   ```tsx
   <p className="whitespace-pre-wrap">{renderFormattedText(message.content)}</p>
   ```

### Detalles tecnicos

La funcion dividira el texto usando `/(\*\*[^*]+\*\*)/g`, y por cada segmento que coincida con el patron `**...**`, renderizara un `<strong>`. Esto es liviano y no requiere dependencias adicionales.
