import express from "express";
import path from "path";
import multer from "multer";
import fs from "fs/promises";
import { GoogleGenAI, Type } from "@google/genai";
import { exec } from "child_process";
import { createServer as createViteServer } from "vite";

const WORKSPACE_DIR = path.join(process.cwd(), "workspace");

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Ensure workspace exists
  try {
    await fs.mkdir(WORKSPACE_DIR, { recursive: true });
  } catch (err) {
    console.error("Failed to create workspace directory", err);
  }

  app.use(express.json());

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, WORKSPACE_DIR);
    },
    filename: (req, file, cb) => {
      cb(null, file.originalname);
    },
  });
  const upload = multer({ storage });

  // File upload endpoint
  app.post("/api/upload", upload.array("files"), (req, res) => {
    res.json({ message: "Files uploaded successfully", files: req.files });
  });

  // Proxy endpoint for web scraping and searching without CORS
  app.post("/api/proxy", async (req, res) => {
    try {
      const { url } = req.body;
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
      });
      const htmlText = await response.text();
      res.json({ success: true, data: htmlText });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Server-side LLM Proxy to avoid browser CORS and network restrictions
  app.post("/api/llm-proxy", async (req, res) => {
    try {
      let { url, headers, payload } = req.body;
      if (!url) {
        return res.status(400).json({ error: { message: "URL is required" } });
      }

      const lowerUrl = (url || "").toLowerCase();
      let targetUrl = url.trim();
      let reqPayload = payload || {};

      // Provider-specific endpoint enforcement to prevent 404s
      if (lowerUrl.includes("generativelanguage.googleapis.com") || lowerUrl.includes("googleapis.com")) {
        targetUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
      } else if (lowerUrl.includes("groq.com")) {
        targetUrl = "https://api.groq.com/openai/v1/chat/completions";
      } else if (lowerUrl.includes("openrouter.ai")) {
        targetUrl = "https://openrouter.ai/api/v1/chat/completions";
      } else if (lowerUrl.includes("huggingface.co") || lowerUrl.includes("hf.co")) {
        if (!targetUrl.includes("/chat/completions")) {
          targetUrl = "https://api-inference.huggingface.co/v1/chat/completions";
        }
      } else if (lowerUrl.includes("api.openai.com")) {
        targetUrl = "https://api.openai.com/v1/chat/completions";
      } else if (lowerUrl.includes("anthropic.com")) {
        targetUrl = "https://api.anthropic.com/v1/messages";
      }

      const proxyHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        ...(headers || {})
      };

      const rawAuth = proxyHeaders["Authorization"] || proxyHeaders["authorization"] || "";
      const bearerKey = rawAuth.replace(/^Bearer\s+/i, "").trim();

      // Headers setup per provider
      if (targetUrl.includes("generativelanguage.googleapis.com")) {
        if (bearerKey) {
          proxyHeaders["Authorization"] = `Bearer ${bearerKey}`;
          proxyHeaders["x-goog-api-key"] = bearerKey;
        }
      } else if (targetUrl.includes("openrouter.ai")) {
        proxyHeaders["HTTP-Referer"] = "http://localhost:3000";
        proxyHeaders["X-Title"] = "Claude Code Web";
        if (bearerKey) proxyHeaders["Authorization"] = `Bearer ${bearerKey}`;
      } else if (targetUrl.includes("anthropic.com")) {
        const antKey = proxyHeaders["x-api-key"] || bearerKey;
        proxyHeaders["x-api-key"] = antKey;
        proxyHeaders["anthropic-version"] = "2023-06-01";
        delete proxyHeaders["Authorization"];

        // Format payload for Anthropic /v1/messages if needed
        if (reqPayload.messages && !reqPayload.anthropicConverted) {
          let systemPrompt = "";
          const anthropicMsgs: any[] = [];

          for (const m of reqPayload.messages) {
            if (m.role === "system") {
              if (systemPrompt) systemPrompt += "\n\n";
              systemPrompt += typeof m.content === "string" ? m.content : JSON.stringify(m.content);
            } else if (m.role === "user") {
              anthropicMsgs.push({
                role: "user",
                content: m.content || " "
              });
            } else if (m.role === "assistant") {
              if (m.tool_calls && Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
                const contentBlocks: any[] = [];
                if (m.content) {
                  contentBlocks.push({ type: "text", text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) });
                }
                for (const tc of m.tool_calls) {
                  let inputArgs = tc.function?.arguments;
                  if (typeof inputArgs === "string") {
                    try { inputArgs = JSON.parse(inputArgs); } catch (_) { inputArgs = {}; }
                  }
                  contentBlocks.push({
                    type: "tool_use",
                    id: tc.id || `toolu_${Math.random().toString(36).substring(2, 9)}`,
                    name: tc.function?.name,
                    input: inputArgs || {}
                  });
                }
                anthropicMsgs.push({
                  role: "assistant",
                  content: contentBlocks
                });
              } else {
                anthropicMsgs.push({
                  role: "assistant",
                  content: typeof m.content === "string" ? (m.content || " ") : m.content
                });
              }
            } else if (m.role === "tool") {
              let toolResultContent: any = m.content || "";
              if (typeof m.content === "string" && m.content.startsWith("data:image/")) {
                const [prefix, base64] = m.content.split(",");
                const mediaType = prefix.replace("data:", "").replace(";base64", "") || "image/png";
                toolResultContent = [
                  {
                    type: "image",
                    source: {
                      type: "base64",
                      media_type: mediaType,
                      data: base64
                    }
                  }
                ];
              } else if (Array.isArray(m.content)) {
                toolResultContent = m.content.map((item: any) => {
                  if (item.type === "image_url" && item.image_url?.url?.startsWith("data:image/")) {
                    const [prefix, base64] = item.image_url.url.split(",");
                    const mediaType = prefix.replace("data:", "").replace(";base64", "") || "image/png";
                    return {
                      type: "image",
                      source: {
                        type: "base64",
                        media_type: mediaType,
                        data: base64
                      }
                    };
                  }
                  return item;
                });
              }

              anthropicMsgs.push({
                role: "user",
                content: [
                  {
                    type: "tool_result",
                    tool_use_id: m.tool_call_id,
                    content: toolResultContent
                  }
                ]
              });
            }
          }

          // Ensure role sequence alternates and merge adjacent user/assistant messages if needed
          const merged: any[] = [];
          for (const m of anthropicMsgs) {
            if (merged.length > 0 && merged[merged.length - 1].role === m.role) {
              const last = merged[merged.length - 1];
              if (Array.isArray(last.content) && Array.isArray(m.content)) {
                last.content = [...last.content, ...m.content];
              } else if (typeof last.content === "string" && typeof m.content === "string") {
                last.content += "\n\n" + m.content;
              } else {
                const lastBlocks = Array.isArray(last.content) ? last.content : [{ type: "text", text: String(last.content) }];
                const newBlocks = Array.isArray(m.content) ? m.content : [{ type: "text", text: String(m.content) }];
                last.content = [...lastBlocks, ...newBlocks];
              }
            } else {
              merged.push(m);
            }
          }

          let modelName = reqPayload.model || "claude-code";

          let convertedTools: any[] | undefined = undefined;
          if (reqPayload.tools && Array.isArray(reqPayload.tools)) {
            convertedTools = reqPayload.tools.map((t: any) => {
              if (t.function) {
                return {
                  name: t.function.name,
                  description: t.function.description,
                  input_schema: t.function.parameters || { type: "object", properties: {} }
                };
              }
              return t;
            });
          }

          reqPayload = {
            anthropicConverted: true,
            model: modelName,
            max_tokens: reqPayload.max_tokens || 4096,
            messages: merged.length > 0 ? merged : [{ role: "user", content: "Hello" }]
          };
          if (convertedTools && convertedTools.length > 0) reqPayload.tools = convertedTools;
          if (systemPrompt) reqPayload.system = systemPrompt;
          if (payload && payload.temperature !== undefined) reqPayload.temperature = payload.temperature;
        }
      }

      const response = await fetch(targetUrl, {
        method: "POST",
        headers: proxyHeaders,
        body: JSON.stringify(reqPayload)
      });

      const responseText = await response.text();
      let responseJson: any = null;

      try {
        responseJson = JSON.parse(responseText);
      } catch (parseErr) {
        const cleanText = responseText.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        const shortSnippet = cleanText.slice(0, 150) || `HTTP ${response.status}`;
        return res.status(response.status).json({
          error: {
            message: `Provider error (${response.status}) at ${targetUrl}: ${shortSnippet}`,
            status: response.status,
            url: targetUrl
          }
        });
      }

      // If Anthropic response, translate back to OpenAI choices format
      if (targetUrl.includes("anthropic.com") && responseJson && !responseJson.choices && responseJson.content) {
        let textContent = "";
        const toolCalls: any[] = [];

        if (Array.isArray(responseJson.content)) {
          for (const block of responseJson.content) {
            if (block.type === "text" && block.text) {
              textContent += block.text;
            } else if (block.type === "tool_use") {
              toolCalls.push({
                id: block.id,
                type: "function",
                function: {
                  name: block.name,
                  arguments: typeof block.input === "string" ? block.input : JSON.stringify(block.input || {})
                }
              });
            }
          }
        } else if (typeof responseJson.content === "string") {
          textContent = responseJson.content;
        }

        const msgObj: any = {
          role: "assistant",
          content: textContent || null
        };
        if (toolCalls.length > 0) {
          msgObj.tool_calls = toolCalls;
        }

        responseJson = {
          id: responseJson.id || "msg_anthropic",
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model: responseJson.model || reqPayload.model,
          choices: [
            {
              index: 0,
              message: msgObj,
              finish_reason: toolCalls.length > 0 ? "tool_calls" : (responseJson.stop_reason || "stop")
            }
          ]
        };
      }

      return res.status(response.status).json(responseJson);
    } catch (e: any) {
      console.error("LLM Proxy Error:", e);
      return res.status(500).json({ error: { message: e.message || "Proxy connection failed" } });
    }
  });

  // Chat/Agent execution endpoint
  app.post("/api/chat", async (req, res) => {
    const { messages, settings } = req.body;
    const { apiKey, baseUrl, model, systemInstruction } = settings;

    if (!apiKey) {
      return res.status(400).json({ error: "API Key is required" });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
      });

      const tools = [
        {
          functionDeclarations: [
            {
              name: "execute_bash",
              description: "Execute a bash command in the workspace directory.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  command: {
                    type: Type.STRING,
                    description: "The bash command to run",
                  },
                },
                required: ["command"],
              },
            },
            {
              name: "read_file",
              description: "Read the contents of a file in the workspace.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  filename: {
                    type: Type.STRING,
                    description: "The name of the file to read",
                  },
                },
                required: ["filename"],
              },
            },
            {
              name: "write_file",
              description: "Write content to a file in the workspace.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  filename: {
                    type: Type.STRING,
                    description: "The name of the file to write",
                  },
                  content: {
                    type: Type.STRING,
                    description: "The content of the file",
                  },
                },
                required: ["filename", "content"],
              },
            },
          ],
        },
      ];

      const config = {
        systemInstruction,
        tools,
      };

      const aiModel = model || "gemini-2.5-flash";
      const currentMessages = [...messages];
      let finalResponseText = "";
      let isDone = false;
      let turnCount = 0;

      // Handle multi-turn tool execution
      while (!isDone && turnCount < 5) {
        turnCount++;
        const response = await ai.models.generateContent({
          model: aiModel,
          contents: currentMessages,
          config,
        });

        if (response.functionCalls && response.functionCalls.length > 0) {
          // Add the model's function call to history
          currentMessages.push({
            role: "model",
            parts: response.candidates?.[0]?.content?.parts || [],
          });

          const functionResponses = [];

          for (const call of response.functionCalls) {
            if (call.name === "execute_bash") {
              const command = String(call.args.command || "");
              try {
                const { stdout, stderr } = await new Promise<{
                  stdout: string;
                  stderr: string;
                }>((resolve) => {
                  exec(
                    command,
                    { cwd: WORKSPACE_DIR },
                    (error, stdout, stderr) => {
                      resolve({
                        stdout: stdout || "",
                        stderr: error
                          ? error.message + "\n" + (stderr || "")
                          : stderr || "",
                      });
                    }
                  );
                });
                functionResponses.push({
                  name: call.name,
                  response: {
                    output: stdout + (stderr ? `\nError: ${stderr}` : ""),
                  },
                });
              } catch (e: any) {
                functionResponses.push({
                  name: call.name,
                  response: { error: String(e) },
                });
              }
            } else if (call.name === "read_file") {
              const filename = String(call.args.filename || "");
              try {
                const content = await fs.readFile(
                  path.join(WORKSPACE_DIR, filename),
                  "utf-8"
                );
                functionResponses.push({
                  name: call.name,
                  response: { content },
                });
              } catch (e: any) {
                functionResponses.push({
                  name: call.name,
                  response: { error: String(e) },
                });
              }
            } else if (call.name === "write_file") {
              const filename = String(call.args.filename || "");
              const content = String(call.args.content || "");
              try {
                await fs.writeFile(
                  path.join(WORKSPACE_DIR, filename),
                  content,
                  "utf-8"
                );
                functionResponses.push({
                  name: call.name,
                  response: { success: true },
                });
              } catch (e: any) {
                functionResponses.push({
                  name: call.name,
                  response: { error: String(e) },
                });
              }
            }
          }

          // Add function results to history
          currentMessages.push({
            role: "user",
            parts: functionResponses.map((fr) => ({
              functionResponse: {
                name: fr.name,
                response: fr.response,
              },
            })),
          });
        } else {
          finalResponseText = response.text;
          isDone = true;
          // Add the final response to history
          currentMessages.push({
            role: "model",
            parts: [{ text: finalResponseText }],
          });
        }
      }

      res.json({ text: finalResponseText, updatedMessages: currentMessages });
    } catch (error: any) {
      console.error("Error in chat endpoint:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
