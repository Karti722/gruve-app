import type { ToolDefinition } from "../llm/types";
import { embedTexts } from "../rag/embeddingsClient";
import { searchSimilar } from "../rag/vectorStore";

export interface LocalTool {
  definition: ToolDefinition;
  execute: (input: Record<string, unknown>) => Promise<string>;
}

const calculatorTool: LocalTool = {
  definition: {
    name: "calculator",
    description: "Evaluates a basic arithmetic expression (+, -, *, /, %, parentheses). Use this for any math instead of estimating.",
    input_schema: {
      type: "object",
      properties: {
        expression: { type: "string", description: "e.g. '12 * 850 / 100'" },
      },
      required: ["expression"],
    },
  },
  execute: async (input) => {
    const expression = String(input.expression ?? "");
    try {
      const result = evaluateArithmetic(expression);
      return `${expression} = ${result}`;
    } catch (err) {
      return `Error evaluating "${expression}": ${(err as Error).message}`;
    }
  },
};

const knowledgeBaseTool: LocalTool = {
  definition: {
    name: "search_knowledge_base",
    description:
      "Searches the internal RAG knowledge base (docs about LLMs, RAG, agents, MCP, vector DBs and full-stack architecture) and returns the most relevant passages.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural-language search query" },
      },
      required: ["query"],
    },
  },
  execute: async (input) => {
    const query = String(input.query ?? "");
    const [embedding] = await embedTexts([query]);
    const results = await searchSimilar(embedding, 3);

    if (results.length === 0) return "No relevant passages found.";

    return results
      .map((r) => `[${r.source}] (similarity ${r.score.toFixed(2)}): ${r.text.slice(0, 300)}`)
      .join("\n\n");
  },
};

export const LOCAL_TOOLS: LocalTool[] = [calculatorTool, knowledgeBaseTool];

/** Tiny recursive-descent arithmetic evaluator: deliberately avoids
 * eval()/Function() so the "calculator" tool can't be used to run arbitrary
 * JS even though its input ultimately comes from model output. */
function evaluateArithmetic(source: string): number {
  let pos = 0;

  function peek(): string {
    return source[pos];
  }

  function consumeWhitespace() {
    while (pos < source.length && /\s/.test(source[pos])) pos++;
  }

  function parseNumber(): number {
    consumeWhitespace();
    const start = pos;
    if (peek() === "-") pos++;
    while (pos < source.length && /[\d.]/.test(source[pos])) pos++;
    const numStr = source.slice(start, pos);
    if (!numStr || Number.isNaN(Number(numStr))) {
      throw new Error(`unexpected token at position ${start}`);
    }
    return Number(numStr);
  }

  function parseFactor(): number {
    consumeWhitespace();
    if (peek() === "(") {
      pos++;
      const value = parseExpression();
      consumeWhitespace();
      if (peek() !== ")") throw new Error("expected closing parenthesis");
      pos++;
      return value;
    }
    return parseNumber();
  }

  function parseTerm(): number {
    let value = parseFactor();
    consumeWhitespace();
    while (peek() === "*" || peek() === "/" || peek() === "%") {
      const op = peek();
      pos++;
      const rhs = parseFactor();
      if (op === "*") value *= rhs;
      else if (op === "/") value /= rhs;
      else value %= rhs;
      consumeWhitespace();
    }
    return value;
  }

  function parseExpression(): number {
    let value = parseTerm();
    consumeWhitespace();
    while (peek() === "+" || peek() === "-") {
      const op = peek();
      pos++;
      const rhs = parseTerm();
      value = op === "+" ? value + rhs : value - rhs;
      consumeWhitespace();
    }
    return value;
  }

  const result = parseExpression();
  consumeWhitespace();
  if (pos !== source.length) throw new Error(`unexpected trailing input at position ${pos}`);
  return result;
}
