# Local Storage MCP Server
<img width="1280" height="632" alt="my-local-storage-mcp" src="https://github.com/user-attachments/assets/cfeb0571-957a-4e4c-ae75-5f0ee3a9e121" />

A pragmatic, low-overhead Model Context Protocol (MCP) server that provides Large Language Models (LLMs) with a persistent, local long-term memory. 

Built with **Node.js**, **TypeScript**, and **SQLite**, this server allows tools like Cursor, Claude Desktop, or any MCP-compatible client to autonomously catalog, index, and retrieve insights, architectural decisions, and domain knowledge directly from your local machine.

---

## Architecture & Design Principles

* **KISS (Keep It Simple, Stupid):** No over-engineered vector DB infrastructures or heavy background daemons for basic workflows. It relies on a single, lightning-fast local SQLite file.
* **Offloaded Indexing:** The server delegates the heavy lifting of metadata categorization and keyword extraction to the LLM itself via strict JSON schemas.
* **Zero Operational Cost:** Run entirely on your local hardware with millisecond response times and absolute data privacy.

---

## Database Schema

The server automatically initializes an indexed SQLite database (`.local_mcp_learning.db`) in the user's home directory to isolate write permissions and ensure persistence across server updates:

```sql
CREATE TABLE IF NOT EXISTS local_learning (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic TEXT NOT NULL,
    keywords TEXT NOT NULL,
    fact TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_learning_lookup ON local_learning(topic, keywords);
```

---

## Install & Use

```
npm install -g git+https://github.com/avm-sistemas/my-local-storage-mcp.git
```
