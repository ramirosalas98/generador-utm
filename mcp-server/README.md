# Servidor MCP para Generador UTM y Bitly Fava

Este servidor implementa el protocolo **Model Context Protocol (MCP)** para permitir que asistentes de inteligencia artificial (Antigravity, Claude Desktop, Cursor, etc.) interactúen directamente con el Generador de UTMs de Fava.

## ¿Qué permite hacer a la IA?

1. **Consultar taxonomías oficiales (`get_taxonomies_and_links`)**:
   - Conocer las campañas vigentes, fuentes (Instagram, Facebook, etc.), medios (feed, historia, carrusel, etc.) y tags existentes.
   - Conocer los **links genéricos guardados** (ej. "Tienda Fava", URLs base oficiales).
2. **Crear enlaces UTM y Bitly (`generate_utm_link`)**:
   - Genera la UTM sanitizada.
   - Si se solicita `linkName` de un genérico (ej. "Tienda Fava"), toma automáticamente la URL base guardada.
   - Acorta con la API oficial de Bitly.
   - Genera código QR (Data URL Base64) si se solicita.
   - Asigna etiquetas existentes o crea nuevas etiquetas en la base.
   - **Guarda el enlace en Firebase Firestore** en la colección `generated_links` para que aparezca en el panel web del equipo.
3. **Listar enlaces creados (`list_utm_links`)**:
   - Consultar links del mes actual o de campañas específicas para evitar duplicados o armar reportes.

---

## Configuración en Vercel (Requisito Previo)

Para que el backend de Vercel acepte las peticiones de este MCP (o de la app del Calendario):

1. Ingresá al panel de tu proyecto en [Vercel](https://vercel.com).
2. Andá a **Settings > Environment Variables**.
3. Agregá la siguiente variable:
   - **Key:** `API_SECRET_KEY`
   - **Value:** `fava_sec_89d3a7e5b2c1409f632e8b1a45709cd8` (o la clave que desees utilizar).
4. Realizá un nuevo Deploy (haciendo push de los cambios o Redeploy desde Vercel).

---

## Cómo configurar este MCP en Antigravity

Para agregar este MCP en tu proyecto de Antigravity (o en el proyecto del Asistente de Contenido):

Agregá en tu configuración de MCP (`settings.json` o la configuración de servidor MCP de Antigravity):

```json
{
  "mcpServers": {
    "fava-utm": {
      "command": "node",
      "args": [
        "c:/Users/salas.ramiro/Desktop/Generador UTM/mcp-server/dist/index.js"
      ],
      "env": {
        "UTM_API_URL": "https://generador-utm-fava.vercel.app",
        "UTM_API_KEY": "fava_sec_89d3a7e5b2c1409f632e8b1a45709cd8"
      }
    }
  }
}
```

---

## Cómo configurar en Claude Desktop

En `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "fava-utm": {
      "command": "node",
      "args": [
        "c:/Users/salas.ramiro/Desktop/Generador UTM/mcp-server/dist/index.js"
      ],
      "env": {
        "UTM_API_URL": "https://generador-utm-fava.vercel.app",
        "UTM_API_KEY": "fava_sec_89d3a7e5b2c1409f632e8b1a45709cd8"
      }
    }
  }
}
```

---

## Ejemplo de uso con la IA

Podés pedirle a la IA del Asistente de Contenido:

> *"Armame un copy para una historia de Instagram promocionando Tienda Fava con la etiqueta ofertas-marzo. Creá el link UTM con Bitly y usalo directamente en el texto."*

La IA automáticamente:
1. Buscará el link genérico de "Tienda Fava".
2. Creará la UTM con `utm_source=Instagram`, `utm_medium=historia`, `utm_campaign=Tienda Fava`.
3. Acortará el link con Bitly.
4. Creará la etiqueta `ofertas-marzo` y guardará todo en Firebase Firestore.
5. Te entregará el copy con el link de Bitly listo.
