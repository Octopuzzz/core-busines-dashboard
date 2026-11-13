export type JqlTokenKind =
  "keyword" | "function" | "string" | "number" | "operator" | "field" | "value" | "punct" | "space";

export interface JqlToken {
  kind: JqlTokenKind;
  text: string;
}

const KEYWORDS = new Set([
  "AND",
  "OR",
  "NOT",
  "IN",
  "IS",
  "EMPTY",
  "NULL",
  "WAS",
  "CHANGED",
  "ORDER",
  "BY",
  "ASC",
  "DESC",
  "FROM",
  "TO",
  "AFTER",
  "BEFORE",
  "ON",
  "DURING",
]);
const VALUE_KEYWORDS = new Set([
  "IN",
  "IS",
  "WAS",
  "NOT",
  "FROM",
  "TO",
  "AFTER",
  "BEFORE",
  "ON",
  "DURING",
]);
const OPERATORS = ["!=", "!~", ">=", "<=", "=", "~", ">", "<"];
const NUMBER = /^-?\d+(\.\d+)?[a-z]?$/i;
const WORD = /^[^\s"'(),=!~<>]+/;

export function tokenizeJql(source: string): JqlToken[] {
  const tokens: JqlToken[] = [];
  const valueLists: boolean[] = [];
  let expectValue = false;
  let i = 0;

  const inValueList = () => valueLists[valueLists.length - 1] === true;
  const valueTaken = () => {
    if (!inValueList()) expectValue = false;
  };

  while (i < source.length) {
    const rest = source.slice(i);
    const char = source[i];

    const space = rest.match(/^\s+/);
    if (space) {
      tokens.push({ kind: "space", text: space[0] });
      i += space[0].length;
      continue;
    }

    if (char === '"' || char === "'") {
      let end = i + 1;
      while (end < source.length && source[end] !== char) end += source[end] === "\\" ? 2 : 1;
      const text = source.slice(i, Math.min(end + 1, source.length));
      tokens.push({ kind: "string", text });
      i += text.length;
      valueTaken();
      continue;
    }

    const operator = OPERATORS.find((op) => rest.startsWith(op));
    if (operator) {
      tokens.push({ kind: "operator", text: operator });
      i += operator.length;
      expectValue = true;
      continue;
    }

    if (char === "(" || char === ")" || char === ",") {
      tokens.push({ kind: "punct", text: char });
      i += 1;
      if (char === "(") valueLists.push(expectValue || inValueList());
      if (char === ")") {
        valueLists.pop();
        expectValue = inValueList();
      }
      continue;
    }

    const word = rest.match(WORD)?.[0] ?? char;
    const upper = word.toUpperCase();
    let kind: JqlTokenKind;
    if (KEYWORDS.has(upper)) {
      kind = "keyword";
      if (upper === "EMPTY" || upper === "NULL") valueTaken();
      else if (upper === "AND" || upper === "OR") expectValue = false;
      else expectValue = VALUE_KEYWORDS.has(upper);
    } else if (/^\s*\(/.test(source.slice(i + word.length))) {
      kind = "function";
      expectValue = true;
    } else if (expectValue) {
      kind = NUMBER.test(word) ? "number" : "value";
      valueTaken();
    } else {
      kind = "field";
    }
    tokens.push({ kind, text: word });
    i += word.length;
  }
  return tokens;
}

export function formatJql(source: string): string {
  const tokens = tokenizeJql(source).filter((token) => token.kind !== "space");
  let out = "";
  let depth = 0;

  tokens.forEach((token, index) => {
    const previous = tokens[index - 1];
    const upper = token.text.toUpperCase();
    const text = token.kind === "keyword" ? upper : token.text;

    let separator = " ";
    if (!previous) separator = "";
    else if (previous.text === "(" || token.text === ")" || token.text === ",") separator = "";
    else if (token.text === "(" && previous.kind === "function") separator = "";
    else if (token.kind === "keyword" && depth === 0 && ["AND", "OR", "ORDER"].includes(upper))
      separator = "\n";
    else if (token.kind === "keyword" && depth > 0 && ["AND", "OR"].includes(upper))
      separator = "\n" + "  ".repeat(depth + 1);

    if (token.text === "(") depth++;
    if (token.text === ")") depth = Math.max(0, depth - 1);
    out += separator + text;
  });
  return out;
}
