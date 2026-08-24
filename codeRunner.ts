export interface CodeRunnerResult {
  stdout: string;
  result: string;
  error: string | null;
  filesChanged: string[];
  updatedVfs: Record<string, string>;
}

export function runJavaScriptInWorker(
  code: string,
  initialVfs: Record<string, string>,
  timeoutMs = 5000
): Promise<CodeRunnerResult> {
  return new Promise((resolve) => {
    const workerCode = `
      // Strict Sandbox: Block network and storage escape APIs
      try {
        self.fetch = () => Promise.reject(new Error("Network access is blocked in this browser sandbox."));
        self.XMLHttpRequest = function() { throw new Error("Network access is blocked in this browser sandbox."); };
        self.WebSocket = function() { throw new Error("Network access is blocked in this browser sandbox."); };
        self.importScripts = function() { throw new Error("Script loading is blocked in this browser sandbox."); };
        if (typeof indexedDB !== 'undefined') { Object.defineProperty(self, 'indexedDB', { get: () => null }); }
      } catch (_) {}

      let stdoutLogs = [];
      const customConsole = {
        log: (...args) => stdoutLogs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
        info: (...args) => stdoutLogs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
        warn: (...args) => stdoutLogs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
        error: (...args) => stdoutLogs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '))
      };

      self.onmessage = async (e) => {
        const { codeToRun, vfs } = e.data;
        const localVfs = { ...vfs };
        const filesChangedSet = new Set();

        const writeFile = (filePath, content) => {
          const strContent = typeof content === 'object' ? JSON.stringify(content, null, 2) : String(content);
          localVfs[filePath] = strContent;
          filesChangedSet.add(filePath);
          return true;
        };

        const readFile = (filePath) => {
          if (localVfs[filePath] !== undefined) {
            return localVfs[filePath];
          }
          throw new Error("File not found: " + filePath);
        };

        const listFiles = (filterPath) => {
          const keys = Object.keys(localVfs);
          if (!filterPath) return keys;
          return keys.filter(k => k.startsWith(filterPath));
        };

        const appendFile = (filePath, content) => {
          const strContent = typeof content === 'object' ? JSON.stringify(content, null, 2) : String(content);
          const current = localVfs[filePath] || "";
          localVfs[filePath] = current + strContent;
          filesChangedSet.add(filePath);
          return true;
        };

        const fsMock = {
          writeFileSync: (file, data) => writeFile(file, data),
          writeFile: (file, data, cb) => { 
            writeFile(file, data); 
            if (typeof cb === 'function') cb(null); 
          },
          readFileSync: (file, enc) => readFile(file),
          readFile: (file, enc, cb) => {
            try {
              const res = readFile(file);
              if (typeof enc === 'function') enc(null, res);
              else if (typeof cb === 'function') cb(null, res);
            } catch(e) {
              if (typeof enc === 'function') enc(e);
              else if (typeof cb === 'function') cb(e);
            }
          },
          appendFileSync: (file, data) => appendFile(file, data),
          readdirSync: (dir) => listFiles(dir),
          existsSync: (file) => localVfs[file] !== undefined,
          unlinkSync: (file) => { 
            delete localVfs[file]; 
            filesChangedSet.add(file); 
          }
        };

        const requireMock = (mod) => {
          if (mod === 'fs' || mod === 'node:fs') return fsMock;
          if (mod === 'path' || mod === 'node:path') return {
            join: (...parts) => parts.join('/').replace(/\\/+/g, '/'),
            resolve: (...parts) => parts.join('/').replace(/\\/+/g, '/'),
            basename: (p) => p.split('/').pop() || '',
            dirname: (p) => p.split('/').slice(0, -1).join('/') || '.'
          };
          return {};
        };

        try {
          const fn = new Function(
            'console',
            'writeFile',
            'readFile',
            'listFiles',
            'appendFile',
            'require',
            'fs',
            'vfs',
            \`
            return (async () => {
              \${codeToRun}
            })();
            \`
          );

          const evalResult = await fn(
            customConsole,
            writeFile,
            readFile,
            listFiles,
            appendFile,
            requireMock,
            fsMock,
            localVfs
          );

          let resStr = "";
          if (evalResult !== undefined && evalResult !== null) {
            resStr = typeof evalResult === 'object' ? JSON.stringify(evalResult, null, 2) : String(evalResult);
          }

          self.postMessage({
            stdout: stdoutLogs.join('\\n'),
            result: resStr,
            error: null,
            filesChanged: Array.from(filesChangedSet),
            updatedVfs: localVfs
          });
        } catch (err) {
          self.postMessage({
            stdout: stdoutLogs.join('\\n'),
            result: "",
            error: err && err.message ? err.message : String(err),
            filesChanged: Array.from(filesChangedSet),
            updatedVfs: localVfs
          });
        }
      };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    let worker: Worker | null = null;
    let isSettled = false;

    const cleanup = () => {
      if (worker) {
        worker.terminate();
        worker = null;
      }
      URL.revokeObjectURL(workerUrl);
    };

    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        cleanup();
        resolve({
          stdout: "",
          result: "",
          error: "Execution timed out (exceeded 5s limit)",
          filesChanged: [],
          updatedVfs: initialVfs
        });
      }
    }, timeoutMs);

    try {
      worker = new Worker(workerUrl);
      worker.onmessage = (e) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          cleanup();
          resolve(e.data);
        }
      };

      worker.onerror = (e) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          cleanup();
          resolve({
            stdout: "",
            result: "",
            error: e.message || "Runtime error in worker script",
            filesChanged: [],
            updatedVfs: initialVfs
          });
        }
      };

      worker.postMessage({ codeToRun: code, vfs: initialVfs });
    } catch (err: any) {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        cleanup();
        resolve({
          stdout: "",
          result: "",
          error: err.message || "Failed to initialize Web Worker",
          filesChanged: [],
          updatedVfs: initialVfs
        });
      }
    }
  });
}
