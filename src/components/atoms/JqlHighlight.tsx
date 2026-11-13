import { tokenizeJql, type JqlTokenKind } from "@/lib/jira/jql";
import { cn } from "@/lib/ui/cn";

const tokenClass: Record<JqlTokenKind, string> = {
  keyword: "font-semibold text-accent",
  function: "text-done",
  string: "text-warn",
  number: "text-warn",
  operator: "font-semibold text-overdue",
  field: "text-ink",
  value: "text-ink-2",
  punct: "text-muted",
  space: "",
};

export function JqlHighlight({ jql, className }: { jql: string; className?: string }) {
  return (
    <code className={cn("font-mono break-words whitespace-pre-wrap", className)}>
      {tokenizeJql(jql).map((token, index) => (
        <span key={index} className={tokenClass[token.kind]}>
          {token.text}
        </span>
      ))}
    </code>
  );
}
