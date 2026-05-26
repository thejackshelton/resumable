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
const newPagePath = resolve(projectRoot, "pages/blog/[new].tsx");
const sectionPagePath = resolve(projectRoot, "pages/[section].tsx");
const srcDocumentPath = resolve(projectRoot, "src/document.tsx");
const srcPagesPath = resolve(projectRoot, "src/pages/blog/[slug].tsx");
const apiUserPath = resolve(projectRoot, "api/users/[id].get.ts");
const middlewarePath = resolve(projectRoot, "middleware/00.request.ts");

void main();

async function main() {
  await writeProject();
  await runProof();
}

async function writeProject() {
  await mkdir(resolve(projectRoot, "pages/blog"), { recursive: true });
  await mkdir(resolve(projectRoot, "pages/docs"), { recursive: true });
  await mkdir(resolve(projectRoot, "api/users"), { recursive: true });
  await mkdir(resolve(projectRoot, "middleware"), { recursive: true });
  await mkdir(resolve(projectRoot, "src"), { recursive: true });
  await mkdir(resolve(projectRoot, "src/pages/blog"), { recursive: true });
  await mkdir(resolve(projectRoot, "node_modules/@resumable.dev"), { recursive: true });
  await mkdir(resolve(projectRoot, "node_modules/@resumable.dev/core"), {
    recursive: true
  });
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
        include: ["document.tsx", "pages", "api", "middleware", "src"]
      },
      null,
      2
    )
  );

  writeFileSync(
    resolve(projectRoot, "node_modules/@resumable.dev/core/package.json"),
    JSON.stringify({
      name: "@resumable.dev/core",
      version: "0.0.0",
      types: "index.d.ts"
    })
  );

  writeFileSync(
    resolve(projectRoot, "node_modules/@resumable.dev/core/index.d.ts"),
    [
      "export interface PageProps<Params extends object = Readonly<Record<string, string>>> {",
      "  readonly params: Readonly<Params>;",
      "  readonly url: { readonly href: string; readonly pathname: string; readonly search: string; };",
      "  readonly status: number;",
      "}",
      "export interface AppLocals {}",
      "export interface HttpResponse {",
      "  readonly headers: Headers;",
      "  status?: number;",
      "  statusText?: string;",
      "}",
      "export interface HttpContext<Locals extends object = AppLocals> {",
      "  readonly locals: Locals;",
      "  readonly request: Request;",
      "  readonly response: HttpResponse;",
      "  readonly url: URL;",
      "}",
      "export interface EndpointHttpContext<Params extends object = Readonly<Record<string, string>>, Locals extends object = AppLocals> extends HttpContext<Locals> {",
      "  readonly params: Readonly<Params>;",
      "}",
      "export interface MiddlewareHttpContext<Locals extends object = AppLocals> extends HttpContext<Locals> {}",
      ""
    ].join("\n")
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

  writeFileSync(documentPath, documentSource());
  writeFileSync(resolve(projectRoot, "pages/index.tsx"), defaultPageSource());
  writeFileSync(resolve(projectRoot, "pages/about.tsx"), defaultPageSource());
  writeFileSync(pagePath, defaultPageSource());
  writeFileSync(newPagePath, defaultPageSource());
  writeFileSync(sectionPagePath, defaultPageSource());
  writeFileSync(resolve(projectRoot, "pages/docs/[...slug].tsx"), defaultPageSource());
  writeFileSync(apiUserPath, endpointSource());
  writeFileSync(middlewarePath, middlewareSource());
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
    const urlQuickInfo = await quickInfoAtText(
      client,
      pagePath,
      defaultPageSource(),
      "props.url.href",
      "url"
    );
    const hrefQuickInfo = await quickInfoAtText(
      client,
      pagePath,
      defaultPageSource(),
      "props.url.href",
      "href"
    );
    const statusQuickInfo = await quickInfoAtText(
      client,
      pagePath,
      defaultPageSource(),
      "props.status",
      "status"
    );
    const hrefCompletion = await completionAtText(
      client,
      pagePath,
      defaultPageSource(),
      'href="',
      {}
    );

    notify(client, "open", {
      file: apiUserPath,
      fileContent: endpointSource(),
      projectRootPath: projectRoot,
      scriptKindName: "TS"
    });

    const endpointHttpCompletion = await completionAtText(
      client,
      apiUserPath,
      endpointSource(),
      "  http."
    );
    const endpointParamsCompletion = await completionAtText(
      client,
      apiUserPath,
      endpointSource(),
      "http.params."
    );
    const endpointDiagnostics = await request(client, "semanticDiagnosticsSync", {
      file: apiUserPath,
      includeLinePosition: true
    });
    const endpointHttpQuickInfo = await quickInfoAtText(
      client,
      apiUserPath,
      endpointSource(),
      "function (http)",
      "http"
    );
    const endpointIdQuickInfo = await quickInfoAtText(
      client,
      apiUserPath,
      endpointSource(),
      "http.params.id",
      "id"
    );

    notify(client, "open", {
      file: middlewarePath,
      fileContent: middlewareSource(),
      projectRootPath: projectRoot,
      scriptKindName: "TS"
    });

    const middlewareHttpCompletion = await completionAtText(
      client,
      middlewarePath,
      middlewareSource(),
      "  http."
    );
    const middlewareDiagnostics = await request(client, "semanticDiagnosticsSync", {
      file: middlewarePath,
      includeLinePosition: true
    });
    const middlewareHttpQuickInfo = await quickInfoAtText(
      client,
      middlewarePath,
      middlewareSource(),
      "function (http)",
      "http"
    );
    const middlewareHrefQuickInfo = await quickInfoAtText(
      client,
      middlewarePath,
      middlewareSource(),
      "http.url.href",
      "href"
    );

    notify(client, "open", {
      file: documentPath,
      fileContent: documentSource(),
      projectRootPath: projectRoot,
      scriptKindName: "TSX"
    });

    const documentPropsCompletion = await completionAtText(
      client,
      documentPath,
      documentSource(),
      "  props."
    );
    const documentParamsCompletion = await completionAtText(
      client,
      documentPath,
      documentSource(),
      "props.params."
    );
    const documentDiagnostics = await request(client, "semanticDiagnosticsSync", {
      file: documentPath,
      includeLinePosition: true
    });
    const documentSectionQuickInfo = await quickInfoAtText(
      client,
      documentPath,
      documentSource(),
      "props.params.slug",
      "slug"
    );
    const documentNewQuickInfo = await quickInfoAtText(
      client,
      documentPath,
      documentSource(),
      "props.params.new",
      "new"
    );

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
      urlQuickInfo: summarizeQuickInfo(urlQuickInfo.body),
      hrefQuickInfo: summarizeQuickInfo(hrefQuickInfo.body),
      statusQuickInfo: summarizeQuickInfo(statusQuickInfo.body),
      nativeAnchorHrefCompletion: summarizeCompletion(hrefCompletion.body),
      endpointHttpCompletion: summarizeCompletion(endpointHttpCompletion.body),
      endpointParamsCompletion: summarizeCompletion(endpointParamsCompletion.body),
      endpointDiagnostics: summarizeDiagnostics(endpointDiagnostics.body ?? []),
      endpointHttpQuickInfo: summarizeQuickInfo(endpointHttpQuickInfo.body),
      endpointIdQuickInfo: summarizeQuickInfo(endpointIdQuickInfo.body),
      middlewareHttpCompletion: summarizeCompletion(middlewareHttpCompletion.body),
      middlewareDiagnostics: summarizeDiagnostics(middlewareDiagnostics.body ?? []),
      middlewareHttpQuickInfo: summarizeQuickInfo(middlewareHttpQuickInfo.body),
      middlewareHrefQuickInfo: summarizeQuickInfo(middlewareHrefQuickInfo.body),
      documentPropsCompletion: summarizeCompletion(documentPropsCompletion.body),
      documentParamsCompletion: summarizeCompletion(documentParamsCompletion.body),
      documentDiagnostics: summarizeDiagnostics(documentDiagnostics.body ?? []),
      documentSectionQuickInfo: summarizeQuickInfo(documentSectionQuickInfo.body),
      documentNewQuickInfo: summarizeQuickInfo(documentNewQuickInfo.body),
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

async function quickInfoAtText(client, fileName, source, marker, token) {
  const markerOffset = source.indexOf(marker);
  if (markerOffset === -1) {
    throw new Error(`marker not found: ${marker}`);
  }

  const tokenOffset = source.indexOf(token, markerOffset);
  if (tokenOffset === -1) {
    throw new Error(`token not found after marker: ${token}`);
  }

  return request(client, "quickinfo", {
    file: fileName,
    ...lineOffsetAt(source, tokenOffset)
  });
}

function summarizeQuickInfo(body) {
  return {
    text: body?.displayString ?? "",
    documentation: body?.documentation ?? ""
  };
}

function summarizeCompletion(body) {
  const entries = body?.entries ?? [];
  const names = entries.map((entry) => entry.name);

  return {
    itemCount: entries.length,
    hasParams: names.includes("params"),
    hasLocals: names.includes("locals"),
    hasRequest: names.includes("request"),
    hasResponse: names.includes("response"),
    hasUrl: names.includes("url"),
    hasStatus: names.includes("status"),
    hasId: names.includes("id"),
    hasHref: names.includes("href"),
    hasPathname: names.includes("pathname"),
    hasSlug: names.includes("slug"),
    hasNew: names.includes("new"),
    hasSection: names.includes("section"),
    hasHomeHref: names.includes("/"),
    hasAboutHref: names.includes("/about"),
    hasBlogPattern: names.includes("/blog/[slug]"),
    hasDocsPattern: names.includes("/docs/[...slug]"),
    hasBlogPatternReplacementSpan: entries.some(
      (entry) => entry.name === "/blog/[slug]" && entry.replacementSpan
    ),
    firstNames: names.slice(0, 12)
  };
}

function summarizeDiagnostics(items) {
  return {
    itemCount: items.length,
    hasUnknownProps: items.some(
      (item) => item.code === 18046 && diagnosticText(item).includes("props")
    ),
    hasImplicitAnyHttp: items.some(
      (item) => item.code === 7006 && diagnosticText(item).includes("http")
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

  if (
    !result.urlQuickInfo.text.includes("href") ||
    !result.urlQuickInfo.text.includes("pathname") ||
    !result.urlQuickInfo.text.includes("search")
  ) {
    throw new Error("tsserver plugin did not expose a typed props.url hover.");
  }

  if (!result.hrefQuickInfo.text.includes("href: string")) {
    throw new Error("tsserver plugin did not expose a typed props.url.href hover.");
  }

  if (!result.statusQuickInfo.text.includes("status: number")) {
    throw new Error("tsserver plugin did not expose a typed props.status hover.");
  }

  if (
    !result.endpointHttpCompletion.hasLocals ||
    !result.endpointHttpCompletion.hasParams ||
    !result.endpointHttpCompletion.hasRequest ||
    !result.endpointHttpCompletion.hasResponse ||
    !result.endpointHttpCompletion.hasUrl
  ) {
    throw new Error("tsserver plugin did not return endpoint HTTP context completions.");
  }

  if (!result.endpointParamsCompletion.hasId) {
    throw new Error("tsserver plugin did not return endpoint route param completions.");
  }

  if (result.endpointDiagnostics.hasImplicitAnyHttp) {
    throw new Error("Endpoint HTTP context parameter should not report implicit any.");
  }

  if (!result.endpointHttpQuickInfo.text.includes("EndpointHttpContext")) {
    throw new Error("tsserver plugin did not expose endpoint http as EndpointHttpContext.");
  }

  if (!result.endpointIdQuickInfo.text.includes("id: string")) {
    throw new Error("tsserver plugin did not expose endpoint route param hover.");
  }

  if (
    !result.middlewareHttpCompletion.hasLocals ||
    !result.middlewareHttpCompletion.hasRequest ||
    !result.middlewareHttpCompletion.hasResponse ||
    !result.middlewareHttpCompletion.hasUrl
  ) {
    throw new Error("tsserver plugin did not return middleware HTTP context completions.");
  }

  if (result.middlewareDiagnostics.hasImplicitAnyHttp) {
    throw new Error("Middleware HTTP context parameter should not report implicit any.");
  }

  if (!result.middlewareHttpQuickInfo.text.includes("MiddlewareHttpContext")) {
    throw new Error(
      "tsserver plugin did not expose middleware http as MiddlewareHttpContext."
    );
  }

  if (!result.middlewareHrefQuickInfo.text.includes("href: string")) {
    throw new Error("tsserver plugin did not expose middleware URL hover.");
  }

  if (
    !result.nativeAnchorHrefCompletion.hasBlogPattern ||
    !result.nativeAnchorHrefCompletion.hasHomeHref ||
    !result.nativeAnchorHrefCompletion.hasAboutHref ||
    !result.nativeAnchorHrefCompletion.hasBlogPatternReplacementSpan
  ) {
    throw new Error(
      "tsserver plugin did not return dynamic route pattern completions for native anchor href."
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

  if (
    !result.documentParamsCompletion.hasSlug ||
    !result.documentParamsCompletion.hasNew ||
    !result.documentParamsCompletion.hasSection
  ) {
    throw new Error("document.tsx should collect route param completions from pages.");
  }

  if (!result.documentSectionQuickInfo.text.includes("slug?: string")) {
    throw new Error("document.tsx should expose collected params as optional.");
  }

  if (!result.documentNewQuickInfo.text.includes("new?: string")) {
    throw new Error("document.tsx should expose keyword-like params as optional.");
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
  const href = props.url.href;
  const status = props.status;
  props.
  props.params.
  return <article><a href="" />{slug}{href}{status}</article>;
});
`;
}

function endpointSource() {
  return `export default async function (http) {
  const id = http.params.id;
  const href = http.url.href;
  http.
  http.params.
  return { id, href };
}
`;
}

function middlewareSource() {
  return `export default function (http) {
  const href = http.url.href;
  http.
  return href;
}
`;
}

function documentSource() {
  return `import { component$ } from "@qwik.dev/core";

export default component$((props) => {
  const keywordParam = props.params.new;
  const slug = props.params.slug;
  const href = props.url.href;
  const status = props.status;
  props.
  props.params.
  return <article>{keywordParam}{slug}{href}{status}</article>;
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
