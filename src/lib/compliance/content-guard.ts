export type ContentGuardClassification = "allow" | "block";

export type ContentGuardResult = {
  classification: ContentGuardClassification;
  violationTypes: string[];
};

export type ContentGuardInput = {
  inputText?: string;
  toolName?: string;
  args?: unknown;
};

function collectStrings(value: unknown, out: string[]) {
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectStrings(item, out);
    }
  }
}

/** Default: allow everything (no external call). */
export async function guardAgentAction(
  input: ContentGuardInput,
): Promise<ContentGuardResult> {
  const apiKey = process.env.SUPERAGENT_API_KEY?.trim();
  if (!apiKey) {
    return { classification: "allow", violationTypes: [] };
  }

  const texts: string[] = [];
  if (input.inputText) texts.push(input.inputText);
  if (input.toolName) texts.push(input.toolName);
  collectStrings(input.args, texts);
  const joined = texts.join("\n").trim();
  if (!joined) {
    return { classification: "allow", violationTypes: [] };
  }

  try {
    const response = await fetch("https://api.superagent.sh/v1/guard", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: joined.slice(0, 8_000) }),
    });

    if (!response.ok) {
      // Fail closed only when Guard is explicitly configured and errors.
      return {
        classification: "block",
        violationTypes: ["guard_unavailable"],
      };
    }

    const data = (await response.json()) as {
      classification?: string;
      violationTypes?: string[];
      blocked?: boolean;
    };

    const blocked =
      data.blocked === true ||
      data.classification === "block" ||
      data.classification === "blocked";

    return {
      classification: blocked ? "block" : "allow",
      violationTypes: Array.isArray(data.violationTypes) ? data.violationTypes : [],
    };
  } catch {
    return {
      classification: "block",
      violationTypes: ["guard_error"],
    };
  }
}

/** Strip bearer tokens / long secrets from log metadata. Never strip IP. */
export function redactSecretsForLogs(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer [REDACTED]")
      .replace(/\bfid_live_[A-Za-z0-9]+/g, "fid_live_[REDACTED]")
      .replace(/\bsk-[A-Za-z0-9]{16,}\b/g, "[REDACTED]");
  }
  if (Array.isArray(value)) {
    return value.map(redactSecretsForLogs);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (key.toLowerCase() === "ip") {
        out[key] = nested;
        continue;
      }
      if (
        /secret|password|authorization|apikey|api_key|token/.test(key.toLowerCase())
      ) {
        out[key] = "[REDACTED]";
        continue;
      }
      out[key] = redactSecretsForLogs(nested);
    }
    return out;
  }
  return value;
}
