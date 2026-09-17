import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import dotenv from "dotenv";
dotenv.config();
const API_BASE_URL = (process.env.UTM_API_URL || "https://generador-utm-fava.vercel.app").replace(/\/$/, "");
const API_KEY = process.env.UTM_API_KEY || process.env.API_SECRET_KEY || "";
function checkConfig() {
    if (!API_KEY) {
        return {
            ok: false,
            error: "Falta configurar la variable UTM_API_KEY en el entorno del servidor MCP. Esta clave debe coincidir con la API_SECRET_KEY configurada en Vercel.",
        };
    }
    return { ok: true };
}
const server = new McpServer({
    name: "fava-utm-mcp",
    version: "1.0.0",
});
// Tool 1: Consultar taxonomías y links genéricos
server.tool("get_taxonomies_and_links", "Obtiene las campañas oficiales, fuentes, medios, tags y links genéricos guardados (como Tienda Fava) de la base de datos de Fava. Permite a la IA conocer los nombres exactos y URLs base antes de generar UTMs.", {}, async () => {
    const configCheck = checkConfig();
    if (!configCheck.ok) {
        return {
            content: [{ type: "text", text: `Error de configuración: ${configCheck.error}` }],
        };
    }
    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/taxonomy`, {
            method: "GET",
            headers: {
                "x-api-key": API_KEY,
                "Content-Type": "application/json",
            },
        });
        if (!response.ok) {
            const errorText = await response.text();
            return {
                content: [
                    {
                        type: "text",
                        text: `Error al consultar taxonomías (Status ${response.status}): ${errorText}`,
                    },
                ],
            };
        }
        const data = await response.json();
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(data, null, 2),
                },
            ],
        };
    }
    catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `Error de red al conectar con el Generador UTM: ${error?.message}`,
                },
            ],
        };
    }
});
// Tool 2: Generar y guardar enlace UTM
server.tool("generate_utm_link", "Crea un enlace con parámetros UTM oficiales, opcionalmente genera enlace corto Bitly y código QR, y lo guarda en la base de datos de Fava para que aparezca en el sistema web. Si no se provee originalUrl, busca automáticamente en los links genéricos usando linkName (ej: 'Tienda Fava').", {
    campaignName: z.string().describe("Nombre de la campaña (ej. 'Préstamos Personales', 'Lanzamiento')"),
    sourceName: z.string().describe("Nombre de la fuente de tráfico (ej. 'Instagram', 'Facebook', 'Email')"),
    mediumName: z.string().describe("Nombre del medio o formato (ej. 'feed', 'historia', 'carrusel', 'newsletter')"),
    originalUrl: z.string().optional().describe("URL original de destino. Si se omite, se buscará en los links genéricos guardados con linkName"),
    linkName: z.string().optional().describe("Nombre del enlace o del link genérico guardado (ej. 'Tienda Fava', 'Botón Solicitar')"),
    tags: z.array(z.string()).optional().describe("Lista de etiquetas temáticas asociadas al enlace (ej. ['primavera', 'descuento'])"),
    saveNewTags: z.boolean().optional().default(true).describe("Si es true, las etiquetas nuevas se guardarán permanentemente en la base de datos"),
    generateBitly: z.boolean().optional().default(true).describe("Si es true, genera un enlace acortado con Bitly"),
    generateQR: z.boolean().optional().default(false).describe("Si es true, genera un código QR (Data URL Base64)"),
    qrTarget: z.enum(["bitly", "utm"]).optional().default("bitly").describe("Si el QR debe apuntar al enlace Bitly o a la URL UTM completa"),
    monthYear: z.string().optional().describe("Mes y año contable (ej. 'Sep 2026'). Por defecto toma el mes actual"),
    allowDuplicate: z.boolean().optional().default(false).describe("Si es true, permite duplicar el link si ya existía en el mismo mes"),
}, async (params) => {
    const configCheck = checkConfig();
    if (!configCheck.ok) {
        return {
            content: [{ type: "text", text: `Error de configuración: ${configCheck.error}` }],
        };
    }
    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/links`, {
            method: "POST",
            headers: {
                "x-api-key": API_KEY,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(params),
        });
        const data = await response.json();
        if (!response.ok) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error al generar el link (Status ${response.status}): ${data.error || JSON.stringify(data)}`,
                    },
                ],
            };
        }
        const link = data.link;
        let summaryText = `### Enlace Generado y Guardado\n`;
        summaryText += `- **Campaña:** ${link.campaign?.name}\n`;
        summaryText += `- **Fuente / Medio:** ${link.source?.name} / ${link.medium?.name}\n`;
        summaryText += `- **Nombre Enlace:** ${link.linkName?.name}\n`;
        summaryText += `- **Mes:** ${link.monthYear}\n`;
        summaryText += `- **URL Original:** ${link.originalUrl}\n`;
        summaryText += `- **URL con UTM:** \`${link.utmUrl}\`\n`;
        if (link.bitlyUrl) {
            summaryText += `- **Link Bitly:** \`${link.bitlyUrl}\`\n`;
        }
        if (link.tags && link.tags.length > 0) {
            summaryText += `- **Tags:** ${link.tags.join(", ")}\n`;
        }
        if (data.isDuplicate) {
            summaryText += `\n> ⚠️ *Nota:* Este enlace ya existía previamente en la base de datos para este mes.\n`;
        }
        if (link.hasQR) {
            summaryText += `- **QR Generado:** Sí (apuntando a ${link.qrSource})\n`;
        }
        return {
            content: [
                {
                    type: "text",
                    text: summaryText,
                },
            ],
        };
    }
    catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `Error de red al crear el link: ${error?.message}`,
                },
            ],
        };
    }
});
// Tool 3: Consultar enlaces existentes
server.tool("list_utm_links", "Consulta los enlaces UTM guardados en la base de datos de Fava para verificar si ya existen o revisar campañas activas.", {
    month: z.string().optional().describe("Filtrar por mes (ej. 'Sep 2026')"),
    campaign: z.string().optional().describe("Filtrar por nombre de campaña"),
    limit: z.number().optional().default(20).describe("Cantidad máxima de enlaces a recuperar"),
}, async (params) => {
    const configCheck = checkConfig();
    if (!configCheck.ok) {
        return {
            content: [{ type: "text", text: `Error de configuración: ${configCheck.error}` }],
        };
    }
    try {
        const url = new URL(`${API_BASE_URL}/api/v1/links`);
        if (params.month)
            url.searchParams.set("month", params.month);
        if (params.campaign)
            url.searchParams.set("campaign", params.campaign);
        if (params.limit)
            url.searchParams.set("limit", params.limit.toString());
        const response = await fetch(url.toString(), {
            method: "GET",
            headers: {
                "x-api-key": API_KEY,
                "Content-Type": "application/json",
            },
        });
        if (!response.ok) {
            const errorText = await response.text();
            return {
                content: [
                    {
                        type: "text",
                        text: `Error al consultar links (Status ${response.status}): ${errorText}`,
                    },
                ],
            };
        }
        const data = await response.json();
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(data, null, 2),
                },
            ],
        };
    }
    catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `Error de red al listar links: ${error?.message}`,
                },
            ],
        };
    }
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Fava UTM MCP Server running on stdio");
}
main().catch((err) => {
    console.error("Fatal error running Fava UTM MCP Server:", err);
    process.exit(1);
});
