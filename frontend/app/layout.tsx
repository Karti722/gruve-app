import type { Metadata } from "next";
import { NavBar } from "@/components/NavBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gruve AI Vibe Coding Demo",
  description:
    "Full-stack demo of LLMs, RAG, prompt engineering, AI agents, and MCP — built for the Gruve AI Vibe Coding Engineer role.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <NavBar />
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
