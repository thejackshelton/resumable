const { mkdtempSync, readFileSync, symlinkSync, writeFileSync } = require("node:fs");
const { mkdir } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { resolve } = require("node:path");
const { spawn } = require("node:child_process");

const here = __dirname;
const packageRoot = resolve(here, "..");
const repoRoot = resolve(packageRoot, "../..");
const projectRoot = mkdtempSync(resolve(tmpdir(), "resumable-tsserver-plugin-"));
const tsserverPath = resolve(repoRoot, "node_modules/typescript/lib/tsserver.js");
const logPath = resolve(projectRoot, "tsserver.log");
const documentPath = resolve(projectRoot, "document.tsx");
const pagePath = resolve(projectRoot, "pages/blog/[slug].tsx");
const srcDocumentPath = resolve(projectRoot, "src/document.tsx");
const srcPagesPath = resolve(projectRoot, "src/pages/blog/[slug].tsx");

void main();

async function main() {
  await writeProject();
  await runProof();
}

async function writeProject() {
  await mkdir(resolve(projectRoot, "pages/blog"), { recursive: true });
  await mkdir(resolve(projectRoot, "src"), { recursive: true });
  await mkdir(resolve(projectRoot, "src/pages/blog"), { recursive: true });
  await mkdir(resolve(projectRoot, "node_modules/@resumable.dev"), { recursive: true });
  await mkdir(resolve(projectRoot, "node_modules/@qwik.dev/core"), { recursive: true });

  symlinkSync(
    packageRoot,
    resolve(projectRoot, "node_modules/@resumable.dev/typescript-plugin")
  );

  writeFileSync(
    resolve(projectRoot, "package.json"),
    JSON.stringify(
      {
        name: "resumable-tsserver-plugin-proof",
        private: true,
        type: "module",
        devDependencies: {
          "@resumable.dev/typescript-plugin": "workspace:*"
        }
      },
      null,
      2
    )
  );

  writeFileSync(
    resolve(projectRoot, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2023",
          module: "ESNext",
          moduleResolution: "Bundler",
          jsx: "react-jsx",
          jsxImportSource: "@qwik.dev/core",
          strict: true,
          plugins: [
            {
              name: "@resumable.dev/typescript-plugin",
              pagesDir: "./pages"
            }
          ]
        },
        include: ["document.tsx", "pages", "src"]
      },
      null,
      2
    )
  );

  writeFileSync(
    resolve(projectRoot, "node_modules/@qwik.dev/core/package.json"),
    JSON.stringify({
      name: "@qwik.dev/core",
      version: "0.0.0",
      types: "index.d.ts"
    })
  );

  writeFileSync(
    resolve(projectRoot, "node_modules/@qwik.dev/core/index.d.ts"),
    "export declare function component$<Props = unknown>(component: (props: Props) => unknown): unknown;\n"
  );

  writeFileSync(documentPath, defaultPageSource());
  writeFileSync(pagePath, defaultPageSource());
  writeFileSync(srcDocumentPath, defaultPageSource());
  writeFileSync(srcPagesPath, defaultPageSource());
}

async function runProof() {
  const server = spawn(
    process.execPath,
    [tsserverPath, "--logVerbosity", "verbose", "--logFile", logPath],
    {
      cwd: projectRoot,
      stdio: ["pipe", "pipe", "pipe"]
    }
  );

  const client = createTsserverClient(server);

  try {
    notify(client, "open", {
      file: pagePath,
      fileContent: defaultPageSource(),
      projectRootPath: projectRoot,
      scriptKindName: "TSX"
    });

    await request(client, "projectInfo", {
      file: pagePath,
      needFileNameList: false
    });

    const propsCompletion = await completionAtText(
      client,
      pagePath,
      defaultPageSource(),
      "  props."
    );
    const paramsCompletion = await completionAtText(
      client,
      pagePath,
      defaultPageSource(),
      "props.params."
    );
    const diagnostics = await request(client, "semanticDiagnosticsSync", {
      file: pagePath,
      includeLinePosition: true
    });

    notify(client, "open", {
      file: documentPath,
      fileContent: defaultPageSource(),
      projectRootPath: projectRoot,
      scriptKindName: "TSX"
    });

    const documentPropsCompletion = await completionAtText(
      client,
      documentPath,
      defaultPageSource(),
      "  props."
    );
    const documentParamsCompletion = await completionAtText(
      client,
      documentPath,
      defaultPageSource(),
      "props.params."
    );
    const documentDiagnostics = await request(client, "semanticDiagnosticsSync", {
      file: documentPath,
      includeLinePosition: true
    });

    notify(client, "open", {
      file: srcPagesPath,
      fileContent: defaultPageSource(),
      projectRootPath: projectRoot,
      scriptKindName: "TSX"
    });

    const srcPagesCompletion = await completionAtText(
      client,
      srcPagesPath,
      defaultPageSource(),
      "props.params."
    );
    const srcPagesDiagnostics = await request(client, "semanticDiagnosticsSync", {
      file: srcPagesPath,
      includeLinePosition: true
    });

    notify(client, "open", {
      file: srcDocumentPath,
      fileContent: defaultPageSource(),
      projectRootPath: projectRoot,
      scriptKindName: "TSX"
    });

    const srcDocumentCompletion = await completionAtText(
      client,
      srcDocumentPath,
      defaultPageSource(),
      "  props."
    );
    const srcDocumentDiagnostics = await request(client, "semanticDiagnosticsSync", {
      file: srcDocumentPath,
      includeLinePosition: true
    });

    const log = readFileSync(logPath, "utf-8");
    const result = {
      tsserverLoadedPlugin:
        log.includes("Plugin validation succeeded") &&
        log.includes("[resumable] TypeScript plugin loaded"),
      projectRoot,
      propsCompletion: summarizeCompletion(propsCompletion.body),
      paramsCompletion: summarizeCompletion(paramsCompletion.body),
      diagnostics: summarizeDiagnostics(diagnostics.body ?? []),
      documentPropsCompletion: summarizeCompletion(documentPropsCompletion.body),
      documentParamsCompletion: summarizeCompletion(documentParamsCompletion.body),
      documentDiagnostics: summarizeDiagnostics(documentDiagnostics.body ?? []),
      srcPagesCompletion: summarizeCompletion(srcPagesCompletion.body),
      srcPagesDiagnostics: summarizeDiagnostics(srcPagesDiagnostics.body ?? []),
      srcDocumentCompletion: summarizeCompletion(srcDocumentCompletion.body),
      srcDocumentDiagnostics: summarizeDiagnostics(srcDocumentDiagnostics.body ?? [])
    };

    console.log(JSON.stringify({ tsserverPluginProof: result }, null, 2));
    assertProof(result, logPath);
  } finally {
    notify(client, "exit", {});
    server.kill();
  }
}

function createTsserverClient(server) {
  const client = {
    server,
    nextSeq: 1,
    output: Buffer.alloc(0),
    pending: new Map(),
    stderr: []
  };

  server.stdout.on("data", (chunk) => {
    client.output = Buffer.concat([client.output, chunk]);
    readMessages(client);
  });

  server.stderr.on("data", (chunk) => {
    client.stderr.push(chunk.toString("utf-8"));
  });

  server.on("exit", (code, signal) => {
    for (const { reject } of client.pending.values()) {
      reject(new Error(`tsserver exited before response: ${code ?? signal}`));
    }
    client.pending.clear();
  });

  return client;
}

function notify(client, command, args) {
  writeRequest(client, command, args);
}

function request(client, command, args) {
  const seq = writeRequest(client, command, args);

  return new Promise((resolvePromise, reject) => {
    const timer = setTimeout(() => {
      client.pending.delete(seq);
      reject(new Error(`Timed out waiting for tsserver ${command}`));
    }, 30000);

    client.pending.set(seq, {
      resolve(value) {
        clearTimeout(timer);
        resolvePromise(value);
      },
      reject(error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  });
}

function writeRequest(client, command, args) {
  const seq = client.nextSeq++;
  const message = {
    seq,
    type: "request",
    command,
    arguments: args
  };

  serverWrite(client, message);
  return seq;
}

function serverWrite(client, message) {
  const body = JSON.stringify(message);
  client.server.stdin.write(`${body}\n`);
}

function readMessages(client) {
  while (true) {
    const headerEnd = client.output.indexOf("\r\n\r\n");
    if (headerEnd === -1) {
      return;
    }

    const header = client.output.slice(0, headerEnd).toString("utf-8");
    const match = /^Content-Length: (\d+)$/im.exec(header);
    if (!match) {
      throw new Error(`invalid tsserver header: ${header}`);
    }

    const length = Number(match[1]);
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + length;
    if (client.output.length < bodyEnd) {
      return;
    }

    const body = client.output.slice(bodyStart, bodyEnd).toString("utf-8").trim();
    client.output = client.output.slice(bodyEnd);
    handleMessage(client, JSON.parse(body));
  }
}

function handleMessage(client, message) {
  if (message.type !== "response") {
    return;
  }

  const pending = client.pending.get(message.request_seq);
  if (!pending) {
    return;
  }

  client.pending.delete(message.request_seq);
  if (message.success === false) {
    pending.reject(new Error(message.message ?? `tsserver ${message.command} failed`));
  } else {
    pending.resolve(message);
  }
}

async function completionAtText(client, fileName, source, marker) {
  const offset = source.indexOf(marker);
  if (offset === -1) {
    throw new Error(`marker not found: ${marker}`);
  }

  return request(client, "completionInfo", {
    file: fileName,
    ...lineOffsetAt(source, offset + marker.length),
    triggerCharacter: "."
  }).catch((error) => {
    if (error.message === "No content available.") {
      return { body: { entries: [] } };
    }

    throw error;
  });
}

function summarizeCompletion(body) {
  const entries = body?.entries ?? [];
  const names = entries.map((entry) => entry.name);

  return {
    itemCount: entries.length,
    hasParams: names.includes("params"),
    hasUrl: names.includes("url"),
    hasStatus: names.includes("status"),
    hasSlug: names.includes("slug"),
    firstNames: names.slice(0, 12)
  };
}

function summarizeDiagnostics(items) {
  return {
    itemCount: items.length,
    hasUnknownProps: items.some(
      (item) => item.code === 18046 && diagnosticText(item).includes("props")
    ),
    items: items.map((item) => ({
      code: item.code,
      text: diagnosticText(item)
    }))
  };
}

function diagnosticText(item) {
  return String(item.text ?? item.message ?? "");
}

function assertProof(result, proofLogPath) {
  if (!result.tsserverLoadedPlugin) {
    throw new Error(`tsserver did not load the plugin; see ${proofLogPath}`);
  }

  if (
    !result.propsCompletion.hasParams ||
    !result.propsCompletion.hasUrl ||
    !result.propsCompletion.hasStatus
  ) {
    throw new Error("tsserver plugin did not return page prop completions.");
  }

  if (!result.paramsCompletion.hasSlug) {
    throw new Error("tsserver plugin did not return route param completions.");
  }

  if (result.diagnostics.hasUnknownProps) {
    throw new Error(
      "tsserver plugin did not filter default page unknown props diagnostics."
    );
  }

  if (result.srcPagesCompletion.hasSlug) {
    throw new Error("tsserver plugin should not complete src/pages route params.");
  }

  if (!result.srcPagesDiagnostics.hasUnknownProps) {
    throw new Error("src/pages should keep native unknown props diagnostics.");
  }

  if (
    !result.documentPropsCompletion.hasParams ||
    !result.documentPropsCompletion.hasUrl ||
    !result.documentPropsCompletion.hasStatus
  ) {
    throw new Error("tsserver plugin did not return document.tsx page prop completions.");
  }

  if (result.documentParamsCompletion.hasSlug) {
    throw new Error("document.tsx should not receive route-specific param completions.");
  }

  if (result.documentDiagnostics.hasUnknownProps) {
    throw new Error("document.tsx should suppress unknown props diagnostics.");
  }

  if (result.srcDocumentCompletion.hasParams) {
    throw new Error("src/document.tsx should not receive page prop completions.");
  }

  if (!result.srcDocumentDiagnostics.hasUnknownProps) {
    throw new Error("src/document.tsx should keep native unknown props diagnostics.");
  }
}

function defaultPageSource() {
  return `import { component$ } from "@qwik.dev/core";

export default component$((props) => {
  const slug = props.params.slug;
  props.
  props.params.
  return <article>{slug}</article>;
});
`;
}

function lineOffsetAt(source, offset) {
  const lines = source.slice(0, offset).split("\n");
  return {
    line: lines.length,
    offset: lines.at(-1).length + 1
  };
}
