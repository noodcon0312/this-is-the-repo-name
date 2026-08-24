const protocolCache: Record<string, "openai-compatible" | "anthropic" | "custom"> = {};

export function getCachedProtocol(baseUrl: string): "openai-compatible" | "anthropic" | "custom" {
  return protocolCache[baseUrl] || "openai-compatible";
}

export function overrideProtocol(baseUrl: string, protocol: "openai-compatible" | "anthropic" | "custom") {
  protocolCache[baseUrl] = protocol;
}

export async function testAndDetectProtocol(baseUrl: string, apiKey: string, model: string): Promise<{ success: boolean; protocol: "openai-compatible" | "anthropic"; error?: string }> {
  // First try openai-compatible
  const urlCandidate = resolveBaseUrlCandidates(baseUrl, model)[0] || "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
  
  const headersOpenAI: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
  };
  const lowerUrl = urlCandidate.toLowerCase();
  if (lowerUrl.includes("generativelanguage.googleapis.com") || lowerUrl.includes("googleapis")) {
    headersOpenAI["x-goog-api-key"] = apiKey;
  }
  if (lowerUrl.includes("openrouter.ai") || lowerUrl.includes("openrouter")) {
    headersOpenAI["HTTP-Referer"] = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    headersOpenAI["X-Title"] = "Claude Code Web";
  }

  const payloadOpenAI = {
    model: model || "claude-code",
    messages: [{ role: "user", content: "Hello" }],
    max_tokens: 10
  };

  try {
    const res = await fetch("/api/llm-proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: urlCandidate, headers: headersOpenAI, payload: payloadOpenAI })
    });
    
    const data = await res.json().catch(() => null);

    if (res.ok && data && !data.error) {
      protocolCache[baseUrl] = "openai-compatible";
      return { success: true, protocol: "openai-compatible" };
    }

    // Check if we should fallback to anthropic
    const errStr = (data?.error || res.statusText || "").toLowerCase();
    const isAnthropicUrl = lowerUrl.includes("api.anthropic.com");
    
    const isFormatError = res.status === 400 && (
      errStr.includes("x-api-key") || 
      errStr.includes("anthropic-version") || 
      errStr.includes("messages")
    );

    if (isAnthropicUrl || isFormatError) {
      // Fallback to anthropic
      let anthropicUrl = urlCandidate;
      if (anthropicUrl.endsWith("/chat/completions")) {
        anthropicUrl = anthropicUrl.replace("/chat/completions", "/messages");
      } else if (!anthropicUrl.endsWith("/messages")) {
        anthropicUrl = anthropicUrl.replace(/\/$/, "") + "/messages";
      }

      const headersAnthropic: Record<string, string> = {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      };

      const payloadAnthropic = {
        model: model || "claude-code",
        messages: [{ role: "user", content: "Hello" }],
        max_tokens: 10
      };

      const resAnthropic = await fetch("/api/llm-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: anthropicUrl, headers: headersAnthropic, payload: payloadAnthropic })
      });

      const dataAnthropic = await resAnthropic.json().catch(() => null);
      if (resAnthropic.ok && dataAnthropic && !dataAnthropic.error) {
        protocolCache[baseUrl] = "anthropic";
        return { success: true, protocol: "anthropic" };
      }
      
      return { success: false, protocol: "anthropic", error: dataAnthropic?.error || resAnthropic.statusText };
    }

    return { success: false, protocol: "openai-compatible", error: data?.error || res.statusText };

  } catch (err: any) {
    return { success: false, protocol: "openai-compatible", error: err.message || "Network error" };
  }
}

export function resolveBaseUrlCandidates(baseUrl: string, model: string = ""): string[] {
  const urlStr = (baseUrl || "").trim();
  const lower = urlStr.toLowerCase();
  const lowerModel = (model || "").toLowerCase();

  // 1. GEMINI / GOOGLE
  if (
    lower.includes("generativelanguage.googleapis.com") ||
    lower.includes("googleapis.com") ||
    (lower.includes("google") && !lower.includes("openai.com")) ||
    (lowerModel.startsWith("gemini") && !lower.includes("openrouter") && !lower.includes("groq"))
  ) {
    return ["https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"];
  }

  // 2. GROQ
  if (
    lower.includes("groq.com") ||
    lower.includes("groq") ||
    (lowerModel.includes("mixtral") && !lower.includes("openrouter")) ||
    (lowerModel.includes("llama-3") && !lower.includes("openrouter") && !lower.includes("together")) ||
    (lowerModel.includes("llama3") && !lower.includes("openrouter"))
  ) {
    return ["https://api.groq.com/openai/v1/chat/completions"];
  }

  // 3. OPENROUTER
  if (lower.includes("openrouter.ai") || lower.includes("openrouter")) {
    return ["https://openrouter.ai/api/v1/chat/completions"];
  }

  // 4. HUGGING FACE
  if (lower.includes("huggingface.co") || lower.includes("hf.co") || lower.includes("hugging")) {
    return [
      "https://api-inference.huggingface.co/v1/chat/completions",
      "https://router.huggingface.co/hf-inference/v1/chat/completions"
    ];
  }

  // 5. ANTHROPIC / CLAUDE
  if (lower.includes("anthropic.com") || lower.includes("anthropic")) {
    return [
      "https://api.anthropic.com/v1/messages",
      "https://api.anthropic.com/v1/chat/completions"
    ];
  }

  // 6. OPENAI
  if (lower.includes("api.openai.com") || lower.includes("openai.com")) {
    return ["https://api.openai.com/v1/chat/completions"];
  }

  // 7. Fallback if empty
  if (!urlStr) {
    return ["https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"];
  }

  const cleanUrl = urlStr.replace(/\/+$/, "");
  const cleanLower = cleanUrl.toLowerCase();

  if (cleanLower.endsWith("/chat/completions") || cleanLower.endsWith("/messages")) {
    return [cleanUrl];
  }

  const candidates: string[] = [];

  if (
    cleanLower.endsWith("/v1") ||
    cleanLower.endsWith("/v1beta") ||
    cleanLower.endsWith("/openai") ||
    cleanLower.endsWith("/api/v1")
  ) {
    candidates.push(`${cleanUrl}/chat/completions`);
  } else {
    candidates.push(`${cleanUrl}/v1/chat/completions`);
    candidates.push(`${cleanUrl}/chat/completions`);
    candidates.push(`${cleanUrl}/api/v1/chat/completions`);
  }

  return Array.from(new Set(candidates));
}

export function getProviderHeaders(urlCandidate: string, apiKey: string, protocol?: "openai-compatible" | "anthropic" | "custom"): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const lowerUrl = (urlCandidate || "").toLowerCase();

  if (protocol === "anthropic" || lowerUrl.includes("api.anthropic.com") || lowerUrl.includes("anthropic")) {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
    // KHÔNG dùng Authorization: Bearer cho Anthropic
  } else if (lowerUrl.includes("generativelanguage.googleapis.com") || lowerUrl.includes("googleapis")) {
    headers["Authorization"] = `Bearer ${apiKey}`;
    headers["x-goog-api-key"] = apiKey;
  } else if (lowerUrl.includes("openrouter.ai") || lowerUrl.includes("openrouter")) {
    headers["Authorization"] = `Bearer ${apiKey}`;
    headers["HTTP-Referer"] = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    headers["X-Title"] = "Claude Code Web";
  } else {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  if (lowerUrl.includes("ngrok")) {
    headers["ngrok-skip-browser-warning"] = "true";
  }

  return headers;
}
