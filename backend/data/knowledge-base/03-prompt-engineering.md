# Prompt Engineering

Prompt engineering is the practice of designing the instructions given to an
LLM so it reliably produces the desired output. It sits between "just ask
the model" and formal fine-tuning, and is usually the fastest, cheapest way
to improve an AI application's behavior.

Common techniques include:

- **System prompts**: a persistent instruction block that sets persona,
  tone and hard constraints (e.g., "never fabricate citations").
- **Few-shot examples**: showing the model 2-5 example input/output pairs
  so it infers the expected format or reasoning style.
- **Chain-of-thought prompting**: asking the model to reason step by step
  before giving a final answer, which measurably improves accuracy on
  multi-step problems.
- **Structured output constraints**: instructing the model to respond in a
  specific format (JSON, XML tags, markdown) so downstream code can parse it
  reliably.
- **Grounding instructions**: for RAG systems, explicitly telling the model
  to only use the provided context and to say "I don't know" rather than
  guessing.

Well-engineered prompts are version-controlled and tested like code, because
small wording changes can meaningfully change model behavior.
