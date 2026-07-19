import { TextbookPage } from "@/components/TextbookPage";
import { CaseStudy } from "@/components/CaseStudy";
import { Sources } from "@/components/Sources";

export default function EnterprisePage() {
  return (
    <div className="space-y-10">
      <TextbookPage
        eyebrow="Chapter 8"
        title="These Concepts in the Real World"
        pageNumber="Page 8"
        prevPage={{ href: "/eval", label: "Chapter 7: Evaluating AI Outputs" }}
        nextPage={{ href: "/architecture", label: "Chapter 9: The System Behind This Tutorial" }}
      >
        <p>
          Everything covered in Chapters 2 through 4 (a conversation with a model, retrieval
          grounding an answer in real documents, an agent deciding which tool to reach for) isn't
          just a teaching device. Each one is a pattern that large organizations have already put
          into production, at a scale of millions of users and, in some cases, hundreds of millions
          of dollars in measured impact. This chapter walks through five real examples, one per
          concept, with the actual companies and the actual numbers they've published.
        </p>

        <h2 className="font-display text-lg font-bold text-paper-ink">
          <span className="text-brand-600">8.1</span> Conversational AI
        </h2>
        <p>
          The plain chat interface from Chapter 2 is the most direct route into a business:
          replacing or augmenting a support queue that would otherwise require a person for every
          single conversation. The appeal is straightforward: a model can hold thousands of
          conversations at once, doesn't get tired and can pull up a customer's history instantly.
          The harder lesson enterprises have learned is that this doesn't mean the human disappears
          entirely; it means the human's time gets reserved for the cases that actually need
          judgment.
        </p>

        <CaseStudy company="Klarna">
          <p>
            The Swedish payments company Klarna launched an AI customer service assistant in
            February 2024 built on OpenAI's models. In its first month it handled 2.3 million
            conversations (work the company estimated was equivalent to about 700 full-time
            agents), resolving issues in under two minutes on average, versus eleven minutes for a
            human agent, and cutting repeat inquiries by a quarter. By 2025 it was handling roughly
            two-thirds of all customer chats.
          </p>
          <p>
            The instructive part came next: in May 2025, Klarna's CEO publicly said the company had
            cut human support too far, and began rehiring agents after customers complained about
            generic answers on complicated, nuanced cases. The company's own conclusion was that
            full replacement was the wrong goal: the AI is best at high-volume, well-defined
            questions where it already has a customer's purchase history in context, while a human
            is still better for anything that needs real judgment.
          </p>
        </CaseStudy>

        <h2 className="font-display text-lg font-bold text-paper-ink">
          <span className="text-brand-600">8.2</span> Retrieval-Augmented Generation
        </h2>
        <p>
          RAG's enterprise appeal is almost entirely about trust and access control. A general-purpose
          model has no way to know a specific company's internal documents, and even if it could be
          retrained on them, that answer would become stale the moment those documents changed. RAG
          sidesteps both problems: the model reads current, real documents at the moment it answers,
          and, because retrieval is a separate step, an organization can restrict exactly which
          documents a given search is even allowed to touch.
        </p>

        <CaseStudy company="Morgan Stanley">
          <p>
            Morgan Stanley Wealth Management built an internal assistant, "AI @ Morgan Stanley
            Assistant," on top of GPT-4, configured to generate answers exclusively from the firm's
            own library of roughly 100,000 research reports and internal documents, the same
            grounding-in-retrieved-passages pattern from Chapter 3, just at institutional scale. The
            firm reported that the share of that library advisors could effectively search and use
            jumped from about 20% to 80%, and that queries that used to take an advisor over thirty
            minutes to research now take seconds. As of the tool's most recent reporting, over 98% of
            advisor teams were actively using it.
          </p>
        </CaseStudy>

        <h2 className="font-display text-lg font-bold text-paper-ink">
          <span className="text-brand-600">8.3</span> Vector Databases at Scale
        </h2>
        <p>
          The demo in Chapter 3 searches a few dozen chunks of text: small enough that almost any
          approach would be fast. The reason production vector databases exist at all is what
          happens when that number grows past a company's entire catalog, all its users' behavior,
          or every document it has ever produced: exact comparison against every stored vector
          stops being fast enough, and the approximate, index-based search described in Chapter 3
          becomes a hard requirement rather than an optimization.
        </p>

        <CaseStudy company="Spotify">
          <p>
            In 2023, Spotify's engineering team open-sourced Voyager, an HNSW-based nearest-neighbor
            search library (the same indexing approach from Chapter 3) built to replace their
            previous system for powering recommendation features like Discover Weekly. Spotify
            reported it runs roughly ten times faster while using about a quarter of the memory of
            what it replaced, and it's queried hundreds of millions of times a day in production.
            The exact trade-off Chapter 3 describes an approximate index making (trading a small
            amount of accuracy for a large speed gain) is the whole reason the system exists.
          </p>
        </CaseStudy>

        <h2 className="font-display text-lg font-bold text-paper-ink">
          <span className="text-brand-600">8.4</span> AI Agents and Autonomous Tool Use
        </h2>
        <p>
          Agents earn their keep wherever a task is better described as "go accomplish this" than
          "answer this one question", most visibly, so far, in software engineering itself, where
          an agent can read a codebase, make a change, run the result and iterate, the same
          think-act-observe loop from Chapter 4 applied to real production code.
        </p>

        <CaseStudy company="GitHub Copilot & Cognition's Devin">
          <p>
            GitHub Copilot, an AI coding assistant, reached roughly 20 million users by mid-2025 and
            is used at an estimated 90% of Fortune 100 companies; developers using it have reported
            coding meaningfully faster, with a large majority keeping its suggested code rather than
            discarding it.
          </p>
          <p>
            A step further up the autonomy ladder, Cognition's agent Devin doesn't just suggest code:
            it plans and executes entire coding tasks on its own. In July 2025, Goldman Sachs
            announced it was piloting Devin alongside its roughly 12,000 human developers, describing
            the goal as a "hybrid workforce" aiming for the equivalent output of about 14,400
            developers from the same headcount.
          </p>
        </CaseStudy>

        <h2 className="font-display text-lg font-bold text-paper-ink">
          <span className="text-brand-600">8.5</span> The Model Context Protocol
        </h2>
        <p>
          MCP is the youngest of these five patterns (Anthropic introduced it in November 2024)
          but it solves an old, unglamorous problem: without a shared standard, every company
          connecting an AI system to its internal tools has to build and maintain its own one-off
          integration for each pairing. A shared protocol turns that many-to-many problem into a
          one-time cost per tool, reusable by any compliant AI application.
        </p>

        <CaseStudy company="Block, Apollo GraphQL & the Linux Foundation">
          <p>
            Block (formerly Square) and Apollo GraphQL were among the first companies to partner
            with Anthropic in shaping MCP and piloting it internally. Adoption then moved quickly
            across the industry: one early-2025 industry survey found the share of Fortune 500
            companies running MCP servers in production roughly doubled in a single quarter. In
            December 2025, Anthropic handed governance of the protocol to the Linux Foundation's
            Agentic AI Foundation, backed by AWS, Google, Microsoft, OpenAI, Bloomberg and
            Cloudflare, the clearest sign yet that MCP had moved from one company's idea to shared
            infrastructure, the same trajectory USB took from one company's connector to a universal
            standard.
          </p>
        </CaseStudy>

        <p>
          Five patterns, five real deployments, one throughline: none of this is speculative
          technology. Every mechanism in Chapters 2 through 4 (the conversation, the retrieval, the
          agent loop, the shared tool protocol) is already running in production, at a scale most
          software never reaches, inside companies you almost certainly already know.
        </p>

        <Sources
          items={[
            {
              label: "Klarna, \"Klarna AI assistant handles two-thirds of customer service chats in its first month\" (official press release)",
              href: "https://www.klarna.com/international/press/klarna-ai-assistant-handles-two-thirds-of-customer-service-chats-in-its-first-month/",
            },
            {
              label: "Morgan Stanley, \"Key Milestone in Innovation Journey with OpenAI\" (official press release)",
              href: "https://www.morganstanley.com/press-releases/key-milestone-in-innovation-journey-with-openai",
            },
            {
              label: "Spotify Engineering, \"Introducing Voyager: Spotify's New Nearest-Neighbor Search Library\" (2023)",
              href: "https://engineering.atspotify.com/2023/10/introducing-voyager-spotifys-new-nearest-neighbor-search-library",
            },
            {
              label: "TechCrunch, \"GitHub Copilot crosses 20M all-time users\" (July 2025)",
              href: "https://techcrunch.com/2025/07/30/github-copilot-crosses-20-million-all-time-users/",
            },
            {
              label: "CNBC, \"Goldman Sachs autonomous coder pilot marks major AI milestone\" (July 2025)",
              href: "https://www.cnbc.com/2025/07/11/goldman-sachs-autonomous-coder-pilot-marks-major-ai-milestone.html",
            },
            {
              label: "Anthropic, \"Donating the Model Context Protocol and establishing the Agentic AI Foundation\" (December 2025)",
              href: "https://www.anthropic.com/news/donating-the-model-context-protocol-and-establishing-of-the-agentic-ai-foundation",
            },
          ]}
        />
      </TextbookPage>
    </div>
  );
}
