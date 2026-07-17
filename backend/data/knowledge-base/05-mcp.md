# Model Context Protocol (MCP)

The Model Context Protocol is an open standard for connecting AI
applications to external tools, data sources and systems through a single,
consistent interface, instead of writing a bespoke integration for every
tool an agent might need.

An MCP deployment has two sides:

- **MCP servers** expose capabilities: tools (callable functions),
  resources (readable data like files or database rows) and prompts
  (reusable prompt templates) over a lightweight JSON-RPC protocol.
- **MCP clients** (usually embedded inside an AI application or agent)
  connect to one or more MCP servers, discover what they offer and let the
  LLM invoke those tools as part of its reasoning loop.

Transport is commonly either **stdio** (the client spawns the server as a
child process and talks over stdin/stdout, ideal for local tools) or
**HTTP/SSE** (for remote servers). Because the protocol is standardized, the
same MCP server (say, one that searches a company's internal ticketing
system) can be reused by Claude Desktop, Claude Code, an IDE extension or
a custom agent without any code changes on the server side.

MCP is best understood as "USB-C for AI applications": a common physical and
logical interface so tools and models can be mixed and matched.
