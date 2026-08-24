import { runJavaScriptInWorker } from "./codeRunner";
import { VFS } from "../types";

export interface TestResult {
  hasError: boolean;
  statusText: string;
  logs: string[];
  errorMessage?: string;
  errorLine?: number;
  output?: string;
  isWarning?: boolean;
  warningMessage?: string;
}

export async function runJsTest(code: string, vfs: VFS): Promise<TestResult> {
  try {
    const res = await runJavaScriptInWorker(code, vfs, 5000);
    const logs: string[] = [];
    if (res.stdout) {
      logs.push(res.stdout);
    }
    if (res.result) {
      logs.push(`[Return value]: ${res.result}`);
    }

    if (res.error) {
      // Try to extract line number from error message / stack if available
      let lineNum: number | undefined;
      const match = res.error.match(/<anonymous>:(\d+):(\d+)/) || res.error.match(/line (\d+)/i);
      if (match) {
        lineNum = parseInt(match[1], 10);
      }

      return {
        hasError: true,
        statusText: "ERROR",
        logs,
        errorMessage: res.error,
        errorLine: lineNum,
      };
    }

    return {
      hasError: false,
      statusText: "SUCCESS",
      logs,
      output: logs.join("\n"),
    };
  } catch (err: any) {
    return {
      hasError: true,
      statusText: "ERROR",
      logs: [],
      errorMessage: err?.message || String(err),
    };
  }
}

export function runHtmlTest(
  htmlContent: string,
  onResult: (result: TestResult) => void
): () => void {
  const listenerScript = `
<script>
(function() {
  var origLog = console.log;
  var origError = console.error;
  var origWarn = console.warn;

  function safeFormatArg(arg) {
    if (arg === null) return "null";
    if (arg === undefined) return "undefined";
    if (typeof arg === "string") return arg;
    if (typeof arg === "number" || typeof arg === "boolean") return String(arg);
    if (typeof arg === "function") return arg.toString();
    if (arg instanceof Error) return arg.message || String(arg);
    try {
      return JSON.stringify(arg);
    } catch (e) {
      return String(arg);
    }
  }

  console.log = function() {
    var args = Array.prototype.slice.call(arguments);
    origLog.apply(console, args);
    try {
      window.parent.postMessage({
        type: 'console',
        level: 'log',
        args: args.map(safeFormatArg)
      }, '*');
    } catch(e) {}
  };

  console.warn = function() {
    var args = Array.prototype.slice.call(arguments);
    origWarn.apply(console, args);
    try {
      window.parent.postMessage({
        type: 'console',
        level: 'warn',
        args: args.map(safeFormatArg)
      }, '*');
    } catch(e) {}
  };

  console.error = function() {
    var args = Array.prototype.slice.call(arguments);
    origError.apply(console, args);
    try {
      window.parent.postMessage({
        type: 'console',
        level: 'error',
        args: args.map(safeFormatArg)
      }, '*');
    } catch(e) {}
  };

  window.onerror = function(message, source, lineno, colno, error) {
    try {
      window.parent.postMessage({
        type: 'error',
        message: String(message),
        source: source,
        lineno: lineno || 0,
        colno: colno || 0
      }, '*');
    } catch(e) {}
  };

  window.addEventListener('unhandledrejection', function(event) {
    try {
      var reason = event.reason;
      var msg = reason ? (reason.message || String(reason)) : 'Unhandled Promise Rejection';
      window.parent.postMessage({
        type: 'error',
        message: String(msg),
        lineno: 0,
        colno: 0
      }, '*');
    } catch(e) {}
  });

  window.addEventListener('DOMContentLoaded', function() {
    try {
      window.parent.postMessage({ type: 'loaded' }, '*');
    } catch(e) {}
  });

  window.addEventListener('load', function() {
    try {
      window.parent.postMessage({ type: 'loaded' }, '*');
    } catch(e) {}
  });
})();
</script>
`;

  let preparedHtml = htmlContent;
  if (preparedHtml.toLowerCase().includes("<head>")) {
    preparedHtml = preparedHtml.replace(/<head>/i, `<head>${listenerScript}`);
  } else if (preparedHtml.toLowerCase().includes("<html>")) {
    preparedHtml = preparedHtml.replace(/<html>/i, `<html><head>${listenerScript}</head>`);
  } else {
    preparedHtml = listenerScript + preparedHtml;
  }

  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.sandbox.add("allow-scripts");
  iframe.srcdoc = preparedHtml;

  const logs: string[] = [];
  let hasError = false;
  let errorMessage: string | undefined = undefined;
  let errorLine: number | undefined = undefined;
  let settled = false;
  let loadTimeout: any = null;
  let maxTimeout: any = null;

  const emitResult = () => {
    if (settled) return;
    settled = true;
    cleanup();

    if (logs.length === 0 && !hasError) {
      logs.push("HTML document loaded and executed cleanly with 0 JS runtime errors.");
    }

    onResult({
      hasError,
      statusText: hasError ? "ERROR" : "SUCCESS",
      logs,
      errorMessage,
      errorLine,
      output: logs.join("\n"),
    });
  };

  const handleMessage = (event: MessageEvent) => {
    // Strictly match event.source with iframe.contentWindow
    if (event.source !== iframe.contentWindow) return;

    const data = event.data;
    if (!data || typeof data !== "object") return;

    if (data.type === "console") {
      const formatted = (data.args || []).join(" ");
      logs.push(`[${data.level || "log"}] ${formatted}`);
      if (data.level === "error") {
        hasError = true;
        if (!errorMessage) {
          errorMessage = formatted;
        }
      }
    } else if (data.type === "error") {
      hasError = true;
      errorMessage = data.message || "Runtime Error";
      errorLine = data.lineno || undefined;
      logs.push(`[error] ${data.message}${data.lineno ? ` (line ${data.lineno}:${data.colno || 0})` : ""}`);
    } else if (data.type === "loaded") {
      if (!loadTimeout) {
        loadTimeout = setTimeout(() => {
          emitResult();
        }, 400);
      }
    }
  };

  const cleanup = () => {
    if (loadTimeout) clearTimeout(loadTimeout);
    if (maxTimeout) clearTimeout(maxTimeout);
    window.removeEventListener("message", handleMessage);
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  };

  window.addEventListener("message", handleMessage);
  document.body.appendChild(iframe);

  maxTimeout = setTimeout(() => {
    emitResult();
  }, 2500);

  return cleanup;
}
