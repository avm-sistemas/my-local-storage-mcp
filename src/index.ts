#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import path from "path";
import os from "os";

// Define o caminho do banco na pasta do usuário para evitar problemas de permissão
const dbPath = path.join(os.homedir(), ".local_mcp_learning.db");

let db: Database;

async function initDb() {
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Criação da tabela com o campo keywords e os devidos índices
  await db.exec(`
    CREATE TABLE IF NOT EXISTS local_learning (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic TEXT NOT NULL,
      keywords TEXT NOT NULL,
      fact TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_learning_lookup 
    ON local_learning(topic, keywords);
  `);
}

const server = new Server(
  { name: "my-local-storage-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// 1. Definição do Contrato das Ferramentas
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "remember_fact",
        description: "Armazena um aprendizado, insight, decisão arquitetural ou preferência técnica de forma persistente.",
        inputSchema: {
          type: "object",
          properties: {
            topic: { 
              type: "string", 
              description: "O assunto/contexto macro (ex: 'dotnet', 'infraestrutura', 'java-legacy')" 
            },
            keywords: { 
              type: "string", 
              description: "Palavras-chave relevantes para indexação, separadas por vírgula (ex: 'dapper, performance, mpc, garbage-collector')" 
            },
            fact: { 
              type: "string", 
              description: "O fato objetivo, código, regra ou decisão que precisa ser memorizada." 
            }
          },
          required: ["topic", "keywords", "fact"]
        }
      },
      {
        name: "recall_facts",
        description: "Busca na memória local por fatos aprendidos anteriormente com base em termos de busca.",
        inputSchema: {
          type: "object",
          properties: {
            query: { 
              type: "string", 
              description: "O termo, palavra-chave ou conceito que deseja resgatar da memória." 
            }
          },
          required: ["query"]
        }
      }
    ]
  };
});

// 2. Orquestração das Chamadas
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "remember_fact") {
      const { topic, keywords, fact } = args as { topic: string; keywords: string; fact: string };
      
      // Sanitização básica das strings para busca padronizada posterior
      const sanitizedKeywords = keywords.toLowerCase().trim();
      const sanitizedTopic = topic.toLowerCase().trim();

      await db.run(
        "INSERT INTO local_learning (topic, keywords, fact) VALUES (?, ?, ?)",
        [sanitizedTopic, sanitizedKeywords, fact]
      );

      return {
        content: [{ type: "text", text: `[Memória Local]: Fato indexado com sucesso sob o tópico '${sanitizedTopic}'.` }]
      };
    }

    if (name === "recall_facts") {
      const { query } = args as { query: string };
      const searchPattern = `%${query.toLowerCase().trim()}%`;

      // Varre tópico, palavras-chave e o corpo do fato de forma performática via índice
      const rows = await db.all(
        `SELECT topic, keywords, fact, created_at 
         FROM local_learning 
         WHERE topic LIKE ? OR keywords LIKE ? OR fact LIKE ?
         ORDER BY created_at DESC`,
        [searchPattern, searchPattern, searchPattern]
      );

      if (rows.length === 0) {
        return { content: [{ type: "text", text: "Nenhum aprendizado local correspondente foi encontrado." }] };
      }

      const formattedResult = rows.map(r => 
        `--- \n• Tópico: ${r.topic}\n• Tags: ${r.keywords}\n• Data: ${r.created_at}\n• Fato: ${r.fact}`
      ).join("\n\n");

      return { content: [{ type: "text", text: formattedResult }] };
    }

    throw new Error(`Tool interna '${name}' não implementada.`);
  } catch (error: any) {
    // IMPORTANTE: Captura o erro sem cuspir sujeira no stdout que quebraria o protocolo JSON-RPC
    return {
      isError: true,
      content: [{ type: "text", text: `Erro interno no servidor MCP: ${error.message}` }]
    };
  }
});

// Inicialização segura
async function main() {
  await initDb();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  // Logs de erro fatais direcionados estritamente para o stderr
  console.error("Falha crítica ao iniciar o servidor MCP:", err);
  process.exit(1);
});
