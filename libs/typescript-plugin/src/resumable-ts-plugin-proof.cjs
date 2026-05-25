const { existsSync, readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const ts = require("typescript");
const init = require("../lib/index.js");

const repoRoot = resolve(__dirname, "../../..");
const fixtureRoot = resolve(repoRoot, "fixtures/minimal");
const pagesDir = resolve(fixtureRoot, "pages");
const blogPagePath = resolve(pagesDir, "blog/[slug].tsx");
const newBlogPagePath = resolve(pagesDir, "blog/[new].tsx");
const aboutPagePath = resolve(pagesDir, "about.tsx");
const statusPagePath = resolve(pagesDir, "500.tsx");
const sectionPagePath = resolve(pagesDir, "[section].tsx");
const documentPath = resolve(fixtureRoot, "document.tsx");
const srcDocumentPath = resolve(fixtureRoot, "src/document.tsx");
const srcPagesBlogPagePath = resolve(fixtureRoot, "src/pages/blog/[slug].tsx");

const files = new Map();
const versions = new Map();

const host = {
  getCompilationSettings() {
    return {
      target: ts.ScriptTarget.ES2023,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      jsxImportSource: "@qwik.dev/core",
      strict: true,
      skipLibCheck: true,
      allowImportingTsExtensions: true,
      noEmit: true
    };
  },
  getScriptFileNames() {
    return Array.from(files.keys());
  },
  getScriptVersion(fileName) {
    return String(versions.get(fileName) ?? 0);
  },
  getScriptSnapshot(fileName) {
    const text = files.get(fileName) ?? readExistingFile(fileName);
    return typeof text === "string" ? ts.ScriptSnapshot.fromString(text) : undefined;
  },
  getCurrentDirectory() {
    return fixtureRoot;
  },
  getDefaultLibFileName(options) {
    return ts.getDefaultLibFilePath(options);
  },
  fileExists(fileName) {
    return files.has(fileName) || ts.sys.fileExists(fileName);
  },
  readFile(fileName) {
    return files.get(fileName) ?? ts.sys.readFile(fileName);
  },
  readDirectory: ts.sys.readDirectory,
  directoryExists(directory) {
    return ts.sys.directoryExists?.(directory) ?? existsSync(directory);
  },
  getDirectories: ts.sys.getDirectories,
  realpath: ts.sys.realpath
};

const languageService = ts.createLanguageService(host);
const plugin = init({ typescript: ts }).create({
  project: {
    getCurrentDirectory() {
      return fixtureRoot;
    },
    projectService: {
      logger: {
        info() {}
      }
    }
  },
  languageService,
  languageServiceHost: host,
  serverHost: ts.sys,
  config: {
    pagesDir: "./pages"
  }
});

const defaultPageDiagnosticSource = `import { component$ } from "@qwik.dev/core";

export default component$((props) => {
  const slug = props.params.slug;
  const href = props.url.href;
  const status = props.status;
  return <article>{slug}{href}{status}</article>;
});
`;

openDocument(blogPagePath, defaultPageDiagnosticSource);
const blogPropsCompletion = completionAtText(
  blogPagePath,
  defaultPageDiagnosticSource,
  "props."
);
const blogParamsCompletion = completionAtText(
  blogPagePath,
  defaultPageDiagnosticSource,
  "props.params."
);
const blogUrlCompletion = completionAtText(
  blogPagePath,
  defaultPageDiagnosticSource,
  "props.url."
);

changeDocument(blogPagePath, defaultPageDiagnosticSource);
const defaultPageDiagnostic = plugin.getSemanticDiagnostics(blogPagePath);
const defaultPagePropsQuickInfo = quickInfoAtText(
  blogPagePath,
  defaultPageDiagnosticSource,
  "props.params.slug",
  "props"
);
const defaultPageSlugQuickInfo = quickInfoAtText(
  blogPagePath,
  defaultPageDiagnosticSource,
  "props.params.slug",
  "slug"
);
const defaultPageUrlQuickInfo = quickInfoAtText(
  blogPagePath,
  defaultPageDiagnosticSource,
  "props.url.href",
  "url"
);
const defaultPageHrefQuickInfo = quickInfoAtText(
  blogPagePath,
  defaultPageDiagnosticSource,
  "props.url.href",
  "href"
);
const defaultPageStatusQuickInfo = quickInfoAtText(
  blogPagePath,
  defaultPageDiagnosticSource,
  "props.status",
  "status"
);

const defaultPageSyntaxErrorSource = `import { component$ } from "@qwik.dev/core";

export default component$((props) => {
  const href = props.url.href;
  const broken = ;
  return <article>{href}</article>;
});
`;
changeDocument(blogPagePath, defaultPageSyntaxErrorSource);
const defaultPageSyntaxDiagnostic = plugin.getSyntacticDiagnostics(blogPagePath);

const nativeHints = `const rounded = Math.
`;

changeDocument(blogPagePath, nativeHints);
const nativeMathCompletion = completionAtText(blogPagePath, nativeHints, "Math.");

const routeHrefSource = `import { component$ } from "@qwik.dev/core";

export default component$((props) => {
  const pathname = props.url.pathname;
  return <a href="">{pathname}</a>;
});
`;

openDocument(statusPagePath, routeHrefSource);
const routeHrefCompletion = completionAtText(
  statusPagePath,
  routeHrefSource,
  'href="',
  {}
);

const anchorPropSource = `import { component$ } from "@qwik.dev/core";

export default component$((props) => {
  const pathname = props.url.pathname;
  return <a href="/about" on>{pathname}</a>;
});
`;

changeDocument(statusPagePath, anchorPropSource);
const anchorPropCompletion = completionAtText(statusPagePath, anchorPropSource, " on");

const namedDefault = `import { component$ } from "@qwik.dev/core";

const Page = component$((props) => {
  props.
});

export default Page;
`;

changeDocument(blogPagePath, namedDefault);
const namedDefaultCompletion = completionAtText(blogPagePath, namedDefault, "  props.");

const notDefault = `import { component$ } from "@qwik.dev/core";

export const Page = component$((props) => {
  props.
});
`;

changeDocument(blogPagePath, notDefault);
const notDefaultCompletion = completionAtText(blogPagePath, notDefault, "  props.");

const notDefaultDiagnosticSource = `import { component$ } from "@qwik.dev/core";

export const Page = component$((props) => {
  const slug = props.params.slug;
  return <article>{slug}</article>;
});
`;

changeDocument(blogPagePath, notDefaultDiagnosticSource);
const notDefaultDiagnostic = plugin.getSemanticDiagnostics(blogPagePath);

const incrementalDefaultPageSource = notDefaultDiagnosticSource.replace(
  "export const Page = ",
  "export default "
);

changeDocument(blogPagePath, incrementalDefaultPageSource);
const incrementalDefaultPageDiagnostic = plugin.getSemanticDiagnostics(blogPagePath);
const incrementalDefaultPageCompletion = completionAtText(
  blogPagePath,
  incrementalDefaultPageSource,
  "props.params."
);

openDocument(srcPagesBlogPagePath, defaultPageDiagnosticSource);
const srcPagesDefaultDiagnostic = plugin.getSemanticDiagnostics(srcPagesBlogPagePath);
const srcPagesCompletion = completionAtText(
  srcPagesBlogPagePath,
  defaultPageDiagnosticSource,
  "props.params."
);

openDocument(aboutPagePath, defaultPageDiagnosticSource);
const aboutCompletion = completionAtText(
  aboutPagePath,
  defaultPageDiagnosticSource,
  "props.params."
);

openDocument(sectionPagePath, defaultPageDiagnosticSource);
openDocument(newBlogPagePath, defaultPageDiagnosticSource);

const documentDiagnosticSource = `import { component$, Slot } from "@qwik.dev/core";

export default component$((props) => {
  const status = props.status;
  const href = props.url.href;
  const keywordParam = props.params.new;
  const section = props.params.section;
  const slug = props.params.slug;
  return <Slot />;
});
`;

openDocument(documentPath, documentDiagnosticSource);
const documentPropsCompletion = completionAtText(
  documentPath,
  documentDiagnosticSource,
  "props."
);
const documentParamsCompletion = completionAtText(
  documentPath,
  documentDiagnosticSource,
  "props.params."
);
changeDocument(documentPath, documentDiagnosticSource);
const documentDiagnostic = plugin.getSemanticDiagnostics(documentPath);
const documentPropsQuickInfo = quickInfoAtText(
  documentPath,
  documentDiagnosticSource,
  "props.status",
  "props"
);
const documentSectionQuickInfo = quickInfoAtText(
  documentPath,
  documentDiagnosticSource,
  "props.params.section",
  "section"
);
const documentNewQuickInfo = quickInfoAtText(
  documentPath,
  documentDiagnosticSource,
  "props.params.new",
  "new"
);
const documentHrefQuickInfo = quickInfoAtText(
  documentPath,
  documentDiagnosticSource,
  "props.url.href",
  "href"
);

openDocument(srcDocumentPath, documentDiagnosticSource);
const srcDocumentDiagnostic = plugin.getSemanticDiagnostics(srcDocumentPath);
const srcDocumentCompletion = completionAtText(
  srcDocumentPath,
  documentDiagnosticSource,
  "props."
);

const result = {
  tsserverPluginStarted: true,
  sourceOfTruth: "TypeScript 6 language service plugin plus pages file path",
  inlineDefaultPageProps: summarizeCompletion(blogPropsCompletion),
  inlineDefaultPageParams: summarizeCompletion(blogParamsCompletion),
  inlineDefaultPageUrl: summarizeCompletion(blogUrlCompletion),
  defaultPageDiagnostic: summarizeDiagnostic(defaultPageDiagnostic),
  defaultPagePropsQuickInfo: summarizeQuickInfo(defaultPagePropsQuickInfo),
  defaultPageSlugQuickInfo: summarizeQuickInfo(defaultPageSlugQuickInfo),
  defaultPageUrlQuickInfo: summarizeQuickInfo(defaultPageUrlQuickInfo),
  defaultPageHrefQuickInfo: summarizeQuickInfo(defaultPageHrefQuickInfo),
  defaultPageStatusQuickInfo: summarizeQuickInfo(defaultPageStatusQuickInfo),
  defaultPageSyntaxDiagnostic: summarizeDiagnostic(defaultPageSyntaxDiagnostic),
  nativeTypeScriptCompletion: summarizeCompletion(nativeMathCompletion),
  nativeAnchorHrefCompletion: summarizeCompletion(routeHrefCompletion),
  nativeAnchorPropCompletion: summarizeCompletion(anchorPropCompletion),
  namedDefaultPageProps: summarizeCompletion(namedDefaultCompletion),
  staticAboutPageParamsControl: summarizeCompletion(aboutCompletion),
  notDefaultExportControl: summarizeCompletion(notDefaultCompletion),
  notDefaultDiagnostic: summarizeDiagnostic(notDefaultDiagnostic),
  incrementalDefaultPageDiagnostic: summarizeDiagnostic(incrementalDefaultPageDiagnostic),
  incrementalDefaultPageParams: summarizeCompletion(incrementalDefaultPageCompletion),
  srcPagesDefaultDiagnostic: summarizeDiagnostic(srcPagesDefaultDiagnostic),
  srcPagesCompletion: summarizeCompletion(srcPagesCompletion),
  documentPropsCompletion: summarizeCompletion(documentPropsCompletion),
  documentParamsCompletion: summarizeCompletion(documentParamsCompletion),
  documentDiagnostic: summarizeDiagnostic(documentDiagnostic),
  documentPropsQuickInfo: summarizeQuickInfo(documentPropsQuickInfo),
  documentSectionQuickInfo: summarizeQuickInfo(documentSectionQuickInfo),
  documentNewQuickInfo: summarizeQuickInfo(documentNewQuickInfo),
  documentHrefQuickInfo: summarizeQuickInfo(documentHrefQuickInfo),
  srcDocumentDiagnostic: summarizeDiagnostic(srcDocumentDiagnostic),
  srcDocumentCompletion: summarizeCompletion(srcDocumentCompletion)
};

console.log(JSON.stringify(result, null, 2));
assertProof(result);

function openDocument(fileName, text) {
  files.set(fileName, text);
  versions.set(fileName, 1);
}

function changeDocument(fileName, text) {
  files.set(fileName, text);
  versions.set(fileName, (versions.get(fileName) ?? 0) + 1);
}

function completionAtText(fileName, source, marker) {
  const offset = source.indexOf(marker);
  if (offset === -1) {
    throw new Error(`marker not found: ${marker}`);
  }

  return plugin.getCompletionsAtPosition(fileName, offset + marker.length, {
    triggerKind: ts.CompletionTriggerKind.TriggerCharacter,
    triggerCharacter: "."
  });
}

function quickInfoAtText(fileName, source, marker, token) {
  const markerOffset = source.indexOf(marker);
  if (markerOffset === -1) {
    throw new Error(`marker not found: ${marker}`);
  }

  const tokenOffset = source.indexOf(token, markerOffset);
  if (tokenOffset === -1) {
    throw new Error(`token not found after marker: ${token}`);
  }

  return plugin.getQuickInfoAtPosition(fileName, tokenOffset);
}

function summarizeCompletion(response) {
  const entries = response?.entries ?? [];
  const labels = entries.map((entry) => entry.name).filter(Boolean);

  return {
    itemCount: labels.length,
    hasAbs: labels.includes("abs"),
    hasSlug: labels.includes("slug"),
    hasNew: labels.includes("new"),
    hasSection: labels.includes("section"),
    hasParams: labels.includes("params"),
    hasUrl: labels.includes("url"),
    hasStatus: labels.includes("status"),
    hasHref: labels.includes("href"),
    hasPathname: labels.includes("pathname"),
    hasSearch: labels.includes("search"),
    hasHomeHref: labels.includes("/"),
    hasAboutHref: labels.includes("/about"),
    hasBlogTestHref: labels.includes("/blog/test"),
    hasBlogPattern: labels.includes("/blog/[slug]"),
    hasDocsPattern: labels.includes("/docs/[...slug]"),
    hasBlogPatternReplacementSpan: entries.some(
      (entry) => entry.name === "/blog/[slug]" && entry.replacementSpan
    ),
    hasOnClick: labels.includes("onClick$"),
    hasOnInput: labels.includes("onInput$"),
    hasRel: labels.includes("rel"),
    hasTarget: labels.includes("target"),
    hasOnClickReplacementSpan: entries.some(
      (entry) => entry.name === "onClick$" && entry.replacementSpan
    ),
    hasTargetReplacementSpan: entries.some(
      (entry) => entry.name === "target" && entry.replacementSpan
    ),
    firstLabels: labels.slice(0, 12),
    items: entries.slice(0, 12).map((entry) => ({
      name: entry.name,
      kind: entry.kind,
      replacementSpan: entry.replacementSpan,
      sourceDisplay: entry.sourceDisplay?.map((part) => part.text).join("")
    }))
  };
}

function summarizeDiagnostic(items) {
  return {
    itemCount: items.length,
    hasUnknownProps: items.some(
      (item) =>
        item.code === 18046 &&
        ts.flattenDiagnosticMessageText(item.messageText, "\n").includes("props")
    ),
    items: items.map((item) => ({
      code: item.code,
      source: item.source,
      message: ts.flattenDiagnosticMessageText(item.messageText, "\n")
    }))
  };
}

function summarizeQuickInfo(info) {
  return {
    text: info?.displayParts?.map((part) => part.text).join("") ?? "",
    documentation: info?.documentation?.map((part) => part.text).join("") ?? ""
  };
}

function assertProof(proofResult) {
  if (
    !proofResult.inlineDefaultPageProps.hasParams ||
    !proofResult.inlineDefaultPageProps.hasUrl ||
    !proofResult.inlineDefaultPageProps.hasStatus
  ) {
    throw new Error("TS plugin did not provide route-aware page prop completions.");
  }

  if (!proofResult.inlineDefaultPageParams.hasSlug) {
    throw new Error("TS plugin did not provide route param completions.");
  }

  if (proofResult.defaultPageDiagnostic.hasUnknownProps) {
    throw new Error(
      "Default page props should not report TypeScript unknown diagnostics."
    );
  }

  if (
    !proofResult.defaultPagePropsQuickInfo.text.includes("PageProps") ||
    !proofResult.defaultPagePropsQuickInfo.text.includes("readonly slug: string")
  ) {
    throw new Error("TS plugin did not provide route-aware props hover.");
  }

  if (!proofResult.defaultPageSlugQuickInfo.text.includes("slug: string")) {
    throw new Error("TS plugin did not provide route param hover.");
  }

  if (
    !proofResult.defaultPageUrlQuickInfo.text.includes("href") ||
    !proofResult.defaultPageUrlQuickInfo.text.includes("pathname") ||
    !proofResult.defaultPageUrlQuickInfo.text.includes("search")
  ) {
    throw new Error("TS plugin did not provide a real typed props.url hover.");
  }

  if (!proofResult.defaultPageHrefQuickInfo.text.includes("href: string")) {
    throw new Error("TS plugin did not provide a real typed props.url.href hover.");
  }

  if (!proofResult.defaultPageStatusQuickInfo.text.includes("status: number")) {
    throw new Error("TS plugin did not provide a real typed props.status hover.");
  }

  if (proofResult.defaultPageSyntaxDiagnostic.itemCount === 0) {
    throw new Error("TS plugin should preserve syntax diagnostics.");
  }

  if (
    !proofResult.inlineDefaultPageUrl.hasHref ||
    !proofResult.inlineDefaultPageUrl.hasPathname ||
    !proofResult.inlineDefaultPageUrl.hasSearch
  ) {
    throw new Error("TS plugin did not provide url completions.");
  }

  if (!proofResult.nativeTypeScriptCompletion.hasAbs) {
    throw new Error("TS plugin did not preserve native TypeScript Math completions.");
  }

  if (
    !proofResult.nativeAnchorHrefCompletion.hasBlogPattern ||
    !proofResult.nativeAnchorHrefCompletion.hasDocsPattern ||
    !proofResult.nativeAnchorHrefCompletion.hasHomeHref ||
    !proofResult.nativeAnchorHrefCompletion.hasAboutHref ||
    !proofResult.nativeAnchorHrefCompletion.hasBlogTestHref ||
    !proofResult.nativeAnchorHrefCompletion.hasBlogPatternReplacementSpan
  ) {
    throw new Error(
      "TS plugin did not provide dynamic route pattern completions for native anchor href."
    );
  }

  if (
    !proofResult.nativeAnchorPropCompletion.hasOnClick ||
    !proofResult.nativeAnchorPropCompletion.hasOnInput ||
    !proofResult.nativeAnchorPropCompletion.hasRel ||
    !proofResult.nativeAnchorPropCompletion.hasTarget
  ) {
    throw new Error("TS plugin did not preserve native Qwik anchor prop completions.");
  }

  if (
    !proofResult.nativeAnchorPropCompletion.hasOnClickReplacementSpan ||
    !proofResult.nativeAnchorPropCompletion.hasTargetReplacementSpan
  ) {
    throw new Error(
      "Native anchor prop completions should include replacement spans for editors."
    );
  }

  if (proofResult.staticAboutPageParamsControl.hasSlug) {
    throw new Error("Static routes should not receive dynamic slug completions.");
  }

  if (proofResult.notDefaultExportControl.hasParams) {
    throw new Error(
      "Non-default page components should not receive page prop completions."
    );
  }

  if (!proofResult.notDefaultDiagnostic.hasUnknownProps) {
    throw new Error(
      "Non-default page props should still report TypeScript unknown diagnostics."
    );
  }

  if (proofResult.incrementalDefaultPageDiagnostic.hasUnknownProps) {
    throw new Error("Default page props should recover after edits without restarting.");
  }

  if (!proofResult.incrementalDefaultPageParams.hasSlug) {
    throw new Error("Route param completions should recover after edits.");
  }

  if (!proofResult.srcPagesDefaultDiagnostic.hasUnknownProps) {
    throw new Error(
      "Default components outside the configured top-level pages folder should keep TypeScript unknown diagnostics."
    );
  }

  if (proofResult.srcPagesCompletion.hasSlug) {
    throw new Error(
      "Files outside the configured top-level pages folder should not receive route completions."
    );
  }

  if (
    !proofResult.documentPropsCompletion.hasParams ||
    !proofResult.documentPropsCompletion.hasUrl ||
    !proofResult.documentPropsCompletion.hasStatus
  ) {
    throw new Error("Top-level document.tsx should receive page prop completions.");
  }

  if (
    !proofResult.documentParamsCompletion.hasSlug ||
    !proofResult.documentParamsCompletion.hasNew ||
    !proofResult.documentParamsCompletion.hasSection
  ) {
    throw new Error("document.tsx should collect route param completions from pages.");
  }

  if (proofResult.documentDiagnostic.hasUnknownProps) {
    throw new Error("Top-level document.tsx should suppress unknown props diagnostics.");
  }

  if (
    !proofResult.documentPropsQuickInfo.text.includes("PageProps") ||
    !proofResult.documentPropsQuickInfo.text.includes("readonly new?: string") ||
    !proofResult.documentPropsQuickInfo.text.includes("readonly section?: string") ||
    !proofResult.documentPropsQuickInfo.text.includes("readonly slug?: string")
  ) {
    throw new Error("Top-level document.tsx should receive page prop hover.");
  }

  if (!proofResult.documentSectionQuickInfo.text.includes("section?: string")) {
    throw new Error("document.tsx should expose collected params as optional.");
  }

  if (!proofResult.documentNewQuickInfo.text.includes("new?: string")) {
    throw new Error("document.tsx should expose keyword-like params as optional.");
  }

  if (!proofResult.documentHrefQuickInfo.text.includes("href: string")) {
    throw new Error("document.tsx should expose typed url fields.");
  }

  if (!proofResult.srcDocumentDiagnostic.hasUnknownProps) {
    throw new Error("src/document.tsx should keep native unknown props diagnostics.");
  }

  if (proofResult.srcDocumentCompletion.hasParams) {
    throw new Error("src/document.tsx should not receive page prop completions.");
  }
}

function readExistingFile(fileName) {
  if (!existsSync(fileName)) {
    return undefined;
  }

  if (
    fileName.includes(`${fixtureRoot}/src/pages/`) ||
    fileName === resolve(fixtureRoot, "src/document.tsx")
  ) {
    return undefined;
  }

  return readFileSync(fileName, "utf-8");
}
