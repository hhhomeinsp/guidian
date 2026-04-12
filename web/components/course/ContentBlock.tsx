"use client";

import * as React from "react";
import { MDXRemote, type MDXRemoteSerializeResult } from "next-mdx-remote";
import { Callout } from "./Callout";
import { cn } from "@/lib/utils";

/**
 * ContentBlock renders lesson MDX. Two modes:
 * 1. `source` — a pre-serialized MDXRemoteSerializeResult (recommended; serialize server-side)
 * 2. `markdown` — a raw string, rendered as sanitized markdown (fallback for dev/fixtures)
 *
 * Syntax highlighting is wired via shiki at serialization time (see docs/web.md).
 * The sandbox uses the markdown fallback to avoid a server round-trip.
 */
export interface ContentBlockProps {
  source?: MDXRemoteSerializeResult;
  markdown?: string;
  className?: string;
}

const mdxComponents = {
  Callout,
  h1: (p: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className="mt-6 text-3xl font-bold tracking-tight" {...p} />
  ),
  h2: (p: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="mt-6 text-2xl font-semibold tracking-tight" {...p} />
  ),
  h3: (p: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="mt-4 text-xl font-semibold" {...p} />
  ),
  p: (p: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="leading-7 [&:not(:first-child)]:mt-4" {...p} />
  ),
  ul: (p: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="my-4 ml-6 list-disc [&>li]:mt-1" {...p} />
  ),
  ol: (p: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="my-4 ml-6 list-decimal [&>li]:mt-1" {...p} />
  ),
  blockquote: (p: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className="mt-4 border-l-2 border-border pl-6 italic text-muted-foreground"
      {...p}
    />
  ),
  code: (p: React.HTMLAttributes<HTMLElement>) => (
    <code
      className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm"
      {...p}
    />
  ),
  pre: (p: React.HTMLAttributes<HTMLPreElement>) => (
    <pre
      className="my-4 overflow-x-auto rounded-lg border border-border bg-muted p-4 text-sm"
      {...p}
    />
  ),
};

export function ContentBlock({ source, markdown, className }: ContentBlockProps) {
  return (
    <div
      className={cn(
        "prose max-w-none dark:prose-invert text-foreground",
        className,
      )}
    >
      {source ? (
        <MDXRemote {...source} components={mdxComponents} />
      ) : (
        <SimpleMarkdown text={markdown ?? ""} />
      )}
    </div>
  );
}

/**
 * Minimal markdown renderer for the dev sandbox when we don't want to round-trip
 * through next-mdx-remote serialization. NOT a full markdown parser — supports
 * headings, bold, italic, code, lists, blockquotes, and paragraphs.
 */
function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let i = 0;

  const inline = (s: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let key = 0;
    while ((m = re.exec(s))) {
      if (m.index > last) parts.push(s.slice(last, m.index));
      const tok = m[0];
      if (tok.startsWith("**")) parts.push(<strong key={key++}>{tok.slice(2, -2)}</strong>);
      else if (tok.startsWith("`"))
        parts.push(
          <code key={key++} className="rounded bg-muted px-1 py-0.5 font-mono text-sm">
            {tok.slice(1, -1)}
          </code>,
        );
      else parts.push(<em key={key++}>{tok.slice(1, -1)}</em>);
      last = m.index + tok.length;
    }
    if (last < s.length) parts.push(s.slice(last));
    return parts;
  };

  while (i < lines.length) {
    const line = lines[i];
    if (/^#\s/.test(line)) {
      out.push(
        <h1 key={i} className="mt-6 text-3xl font-bold tracking-tight">
          {inline(line.replace(/^#\s/, ""))}
        </h1>,
      );
    } else if (/^##\s/.test(line)) {
      out.push(
        <h2 key={i} className="mt-6 text-2xl font-semibold tracking-tight">
          {inline(line.replace(/^##\s/, ""))}
        </h2>,
      );
    } else if (/^>\s/.test(line)) {
      out.push(
        <blockquote
          key={i}
          className="mt-4 border-l-2 border-border pl-6 italic text-muted-foreground"
        >
          {inline(line.replace(/^>\s/, ""))}
        </blockquote>,
      );
    } else if (/^-\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^-\s/.test(lines[i])) {
        items.push(lines[i].replace(/^-\s/, ""));
        i++;
      }
      out.push(
        <ul key={`ul${i}`} className="my-4 ml-6 list-disc [&>li]:mt-1">
          {items.map((it, j) => (
            <li key={j}>{inline(it)}</li>
          ))}
        </ul>,
      );
      continue;
    } else if (line.trim() === "") {
      // skip blank
    } else {
      out.push(
        <p key={i} className="leading-7 [&:not(:first-child)]:mt-4">
          {inline(line)}
        </p>,
      );
    }
    i++;
  }
  return <>{out}</>;
}
