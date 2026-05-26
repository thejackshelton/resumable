import { extname, isAbsolute, normalize, relative, resolve } from "pathe";
import { joinURL, withLeadingSlash, withoutLeadingSlash } from "ufo";
import type * as ts from "typescript";

type TypeScript = typeof ts;

type ResumablePluginConfig = {
  pagesDir?: string;
};

type PageRoute = {
  pattern: string;
  params: string[];
  optionalParams?: boolean;
};

type TypedSourceTransform = {
  generatedText: string;
  insertAt: number;
  insertedLength: number;
};

type TypedSourceCacheEntry = {
  version: string;
  transform: TypedSourceTransform | undefined;
};

type FunctionParameterTypeTarget = {
  insertTypeAt: number;
  hasType: boolean;
};

type RequestFileRoute = {
  kind: "api" | "middleware";
  params: string[];
};

const PAGE_EXTENSIONS = new Set([".tsx", ".jsx", ".mdx"]);
const REQUEST_FILE_EXTENSION = ".ts";
const HTTP_METHODS = new Set([
  "connect",
  "delete",
  "get",
  "head",
  "options",
  "patch",
  "post",
  "put",
  "trace"
]);

function init(modules: { typescript: TypeScript }): ts.server.PluginModule {
  const typeScript = modules.typescript;

  return {
    create(info) {
      const logger = info.project.projectService?.logger;
      logger?.info("[resumable] TypeScript plugin loaded");

      const languageService = info.languageService;
      const proxy = Object.create(null) as ts.LanguageService;

      for (const key of Object.keys(languageService) as Array<keyof ts.LanguageService>) {
        const value = languageService[key];
        (proxy as unknown as Record<string, unknown>)[key] =
          typeof value === "function" ? value.bind(languageService) : value;
      }

      const pluginConfig = (info.config ?? {}) as ResumablePluginConfig;
      const projectRoot = getProjectRoot(typeScript, info);
      const pagesDir = resolvePagesDir(projectRoot, pluginConfig);
      const typedSourceCache = new Map<string, TypedSourceCacheEntry>();
      const originalGetScriptSnapshot = info.languageServiceHost.getScriptSnapshot?.bind(
        info.languageServiceHost
      );

      if (originalGetScriptSnapshot) {
        info.languageServiceHost.getScriptSnapshot = (fileName) => {
          const snapshot = originalGetScriptSnapshot(fileName);
          if (!snapshot) {
            return snapshot;
          }

          const transform = typedSourceTransform(
            typeScript,
            info,
            typedSourceCache,
            originalGetScriptSnapshot,
            projectRoot,
            pagesDir,
            fileName
          );

          return transform
            ? typeScript.ScriptSnapshot.fromString(transform.generatedText)
            : snapshot;
        };
      }

      const transformFor = (fileName: string) =>
        originalGetScriptSnapshot
          ? typedSourceTransform(
              typeScript,
              info,
              typedSourceCache,
              originalGetScriptSnapshot,
              projectRoot,
              pagesDir,
              fileName
            )
          : undefined;

      proxy.getCompletionsAtPosition = (
        fileName,
        position,
        options,
        formattingSettings
      ) => {
        const transform = transformFor(fileName);
        const generatedPosition = toGeneratedPosition(transform, position);
        const completions = languageService.getCompletionsAtPosition(
          fileName,
          generatedPosition,
          options,
          formattingSettings
        );

        return withRouteHrefCompletions(
          typeScript,
          info,
          languageService,
          originalGetScriptSnapshot,
          pagesDir,
          fileName,
          position,
          generatedPosition,
          completions
        );
      };

      proxy.getCompletionEntryDetails = (
        fileName,
        position,
        entryName,
        formatOptions,
        source,
        preferences,
        data
      ) => {
        const transform = transformFor(fileName);
        const generatedPosition = toGeneratedPosition(transform, position);
        return languageService.getCompletionEntryDetails(
          fileName,
          generatedPosition,
          entryName,
          formatOptions,
          source,
          preferences,
          data
        );
      };

      proxy.getQuickInfoAtPosition = (fileName, position, maximumLength) => {
        const transform = transformFor(fileName);
        const generatedPosition = toGeneratedPosition(transform, position);
        const quickInfo = languageService.getQuickInfoAtPosition(
          fileName,
          generatedPosition,
          maximumLength
        );
        return quickInfo ? mapQuickInfoToOriginal(quickInfo, transform) : quickInfo;
      };

      proxy.getSemanticDiagnostics = (fileName) => {
        return mapDiagnosticsToOriginal(
          languageService.getSemanticDiagnostics(fileName),
          transformFor(fileName)
        );
      };

      proxy.getSyntacticDiagnostics = (fileName) => {
        return mapDiagnosticsToOriginal(
          languageService.getSyntacticDiagnostics(fileName),
          transformFor(fileName)
        );
      };

      proxy.getSuggestionDiagnostics = (fileName) => {
        return mapDiagnosticsToOriginal(
          languageService.getSuggestionDiagnostics(fileName),
          transformFor(fileName)
        );
      };

      return proxy;
    }
  };
}

function typedSourceTransform(
  typeScript: TypeScript,
  info: ts.server.PluginCreateInfo,
  cache: Map<string, TypedSourceCacheEntry>,
  getScriptSnapshot: (fileName: string) => ts.IScriptSnapshot | undefined,
  projectRoot: string,
  pagesDir: string,
  fileName: string
) {
  const snapshot = getScriptSnapshot(fileName);
  if (!snapshot) {
    cache.delete(fileName);
    return undefined;
  }

  const sourceText = snapshot.getText(0, snapshot.getLength());
  const scriptVersion = info.languageServiceHost.getScriptVersion?.(fileName);
  const documentFilesVersion = isTopLevelDocumentFile(projectRoot, fileName)
    ? projectFileNames(info).join("\0")
    : "";
  const version = `${scriptVersion ?? sourceText}\0${documentFilesVersion}`;
  const cached = cache.get(fileName);
  if (cached?.version === version) {
    return cached.transform;
  }

  const transform = createTypedSourceTransform(
    typeScript,
    info,
    projectRoot,
    pagesDir,
    fileName,
    sourceText
  );
  cache.set(fileName, { version, transform });
  return transform;
}

function createTypedSourceTransform(
  typeScript: TypeScript,
  info: ts.server.PluginCreateInfo,
  projectRoot: string,
  pagesDir: string,
  fileName: string,
  sourceText: string
): TypedSourceTransform | undefined {
  const pageTransform = createPageTypedSourceTransform(
    typeScript,
    info,
    projectRoot,
    pagesDir,
    fileName,
    sourceText
  );

  return (
    pageTransform ??
    createRequestFileTypedSourceTransform(typeScript, projectRoot, fileName, sourceText)
  );
}

function createPageTypedSourceTransform(
  typeScript: TypeScript,
  info: ts.server.PluginCreateInfo,
  projectRoot: string,
  pagesDir: string,
  fileName: string,
  sourceText: string
): TypedSourceTransform | undefined {
  if (extname(fileName) !== ".tsx") {
    return undefined;
  }

  const route = routeForFileName(typeScript, info, projectRoot, pagesDir, fileName);
  if (!route) {
    return undefined;
  }

  const sourceFile = typeScript.createSourceFile(
    fileName,
    sourceText,
    typeScript.ScriptTarget.Latest,
    true,
    typeScript.ScriptKind.TSX
  );
  const props = defaultExportPageProps(typeScript, sourceFile);
  if (!props || props.hasType) {
    return undefined;
  }

  const annotation = `: import("@resumable.dev/core").PageProps<${pageParamsType(
    route.params,
    route.optionalParams
  )}>`;

  return insertGeneratedType(sourceText, props.insertTypeAt, annotation);
}

function createRequestFileTypedSourceTransform(
  typeScript: TypeScript,
  projectRoot: string,
  fileName: string,
  sourceText: string
): TypedSourceTransform | undefined {
  const route = requestFileRouteForFileName(typeScript, projectRoot, fileName);
  if (!route) {
    return undefined;
  }

  const sourceFile = typeScript.createSourceFile(
    fileName,
    sourceText,
    typeScript.ScriptTarget.Latest,
    true,
    typeScript.ScriptKind.TS
  );
  const parameter = defaultExportFunctionParameter(typeScript, sourceFile);
  if (!parameter || parameter.hasType) {
    return undefined;
  }

  const annotation =
    route.kind === "api"
      ? `: import("@resumable.dev/core").EndpointHttpContext<${pageParamsType(route.params)}>`
      : `: import("@resumable.dev/core").MiddlewareHttpContext`;

  return insertGeneratedType(sourceText, parameter.insertTypeAt, annotation);
}

function insertGeneratedType(
  sourceText: string,
  insertAt: number,
  annotation: string
): TypedSourceTransform {
  return {
    generatedText:
      sourceText.slice(0, insertAt) + annotation + sourceText.slice(insertAt),
    insertAt,
    insertedLength: annotation.length
  };
}

function toGeneratedPosition(
  transform: TypedSourceTransform | undefined,
  position: number
) {
  if (!transform || position <= transform.insertAt) {
    return position;
  }

  return position + transform.insertedLength;
}

function withRouteHrefCompletions(
  typeScript: TypeScript,
  info: ts.server.PluginCreateInfo,
  languageService: ts.LanguageService,
  getScriptSnapshot: ((fileName: string) => ts.IScriptSnapshot | undefined) | undefined,
  pagesDir: string,
  fileName: string,
  position: number,
  generatedPosition: number,
  completions: ts.CompletionInfo | undefined
): ts.CompletionInfo | undefined {
  const snapshot = getScriptSnapshot?.(fileName);
  const sourceText = snapshot?.getText(0, snapshot.getLength());
  const replacementSpan = sourceText
    ? nativeAnchorHrefReplacementSpan(typeScript, fileName, sourceText, position)
    : undefined;
  if (!replacementSpan) {
    return sourceText
      ? withNativeAnchorPropCompletions(
          typeScript,
          languageService,
          fileName,
          sourceText,
          position,
          generatedPosition,
          completions
        )
      : completions;
  }

  const baseCompletions = completions ?? emptyCompletionInfo();
  const routeHrefs = routeHrefCompletions(typeScript, info, pagesDir);
  const routeHrefSet = new Set(routeHrefs);
  const routeEntries = routeHrefs.map(
    (href): ts.CompletionEntry => ({
      name: href,
      kind: typeScript.ScriptElementKind.string,
      kindModifiers: "",
      sortText: `0 ${href}`,
      replacementSpan
    })
  );

  if (routeEntries.length === 0) {
    return completions;
  }

  return {
    ...baseCompletions,
    entries: [
      ...routeEntries,
      ...baseCompletions.entries.filter((entry) => !routeHrefSet.has(entry.name))
    ]
  };
}

function withNativeAnchorPropCompletions(
  typeScript: TypeScript,
  languageService: ts.LanguageService,
  fileName: string,
  sourceText: string,
  position: number,
  generatedPosition: number,
  completions: ts.CompletionInfo | undefined
): ts.CompletionInfo | undefined {
  const replacementSpan = nativeAnchorAttributeNameReplacementSpan(
    typeScript,
    fileName,
    sourceText,
    position
  );
  if (!replacementSpan) {
    return completions;
  }

  const baseCompletions = completions ?? emptyCompletionInfo();
  const existingNames = new Set(baseCompletions.entries.map((entry) => entry.name));
  const entries = baseCompletions.entries.map((entry) =>
    entry.replacementSpan ? entry : { ...entry, replacementSpan }
  );

  const anchorProps = nativeAnchorPropEntries(
    typeScript,
    languageService,
    fileName,
    generatedPosition,
    existingNames,
    replacementSpan
  );

  return {
    ...baseCompletions,
    entries: [...entries, ...anchorProps]
  };
}

function emptyCompletionInfo(): ts.CompletionInfo {
  return {
    isGlobalCompletion: false,
    isMemberCompletion: false,
    isNewIdentifierLocation: false,
    entries: []
  };
}

function nativeAnchorHrefReplacementSpan(
  typeScript: TypeScript,
  fileName: string,
  sourceText: string,
  position: number
): ts.TextSpan | undefined {
  const extension = extname(fileName);
  if (extension !== ".tsx" && extension !== ".jsx") {
    return undefined;
  }

  const sourceFile = typeScript.createSourceFile(
    fileName,
    sourceText,
    typeScript.ScriptTarget.Latest,
    true,
    extension === ".jsx" ? typeScript.ScriptKind.JSX : typeScript.ScriptKind.TSX
  );
  let replacementSpan: ts.TextSpan | undefined;

  const visit = (node: ts.Node) => {
    if (replacementSpan || position < node.getFullStart() || position > node.getEnd()) {
      return;
    }

    if (
      typeScript.isJsxAttribute(node) &&
      typeScript.isIdentifier(node.name) &&
      node.name.text === "href" &&
      node.initializer &&
      typeScript.isStringLiteral(node.initializer) &&
      isNativeAnchorAttribute(typeScript, node)
    ) {
      const valueStart = node.initializer.getStart(sourceFile) + 1;
      const valueEnd = node.initializer.getEnd() - 1;
      if (position >= valueStart && position <= valueEnd) {
        replacementSpan = { start: valueStart, length: valueEnd - valueStart };
      }
      return;
    }

    typeScript.forEachChild(node, visit);
  };

  visit(sourceFile);
  return replacementSpan;
}

function nativeAnchorAttributeNameReplacementSpan(
  typeScript: TypeScript,
  fileName: string,
  sourceText: string,
  position: number
): ts.TextSpan | undefined {
  const sourceFile = createJsxSourceFile(typeScript, fileName, sourceText);
  if (!sourceFile) {
    return undefined;
  }

  let replacementSpan: ts.TextSpan | undefined;
  const visit = (node: ts.Node) => {
    if (replacementSpan || position < node.getFullStart() || position > node.getEnd()) {
      return;
    }

    if (isNativeAnchorElement(typeScript, node)) {
      const tagEnd = node.tagName.getEnd();
      if (position > tagEnd && position <= node.getEnd()) {
        const isAttributeNamePosition = !isInsideJsxAttributeValue(
          typeScript,
          sourceFile,
          node.attributes,
          position
        );
        if (isAttributeNamePosition) {
          const start = attributeNamePrefixStart(sourceText, tagEnd, position);
          const prefixLength = position - start;
          replacementSpan = {
            start,
            length: prefixLength === 0 && sourceText[position] === " " ? 1 : prefixLength
          };
        }
      }
      return;
    }

    typeScript.forEachChild(node, visit);
  };

  visit(sourceFile);
  return replacementSpan;
}

function attributeNamePrefixStart(sourceText: string, tagEnd: number, position: number) {
  let start = position;
  while (start > tagEnd && isJsxAttributeNameCharacter(sourceText[start - 1])) {
    start--;
  }

  return start;
}

function isJsxAttributeNameCharacter(char: string | undefined) {
  return Boolean(char && /[$\w:-]/.test(char));
}

function isInsideJsxAttributeValue(
  typeScript: TypeScript,
  sourceFile: ts.SourceFile,
  attributes: ts.JsxAttributes,
  position: number
) {
  return attributes.properties.some((property) => {
    if (!typeScript.isJsxAttribute(property) || !property.initializer) {
      return false;
    }

    return (
      position >= property.initializer.getStart(sourceFile) &&
      position <= property.initializer.getEnd()
    );
  });
}

function nativeAnchorPropEntries(
  typeScript: TypeScript,
  languageService: ts.LanguageService,
  fileName: string,
  generatedPosition: number,
  existingNames: ReadonlySet<string>,
  replacementSpan: ts.TextSpan
) {
  const program = languageService.getProgram?.();
  const sourceFile = program?.getSourceFile(fileName);
  if (!program || !sourceFile) {
    return [];
  }

  const anchor = nativeAnchorElementAtPosition(typeScript, sourceFile, generatedPosition);
  if (!anchor) {
    return [];
  }

  const checker = program.getTypeChecker();
  const anchorType = checker.getContextualType(anchor.attributes);
  if (!anchorType) {
    return [];
  }

  return anchorType
    .getProperties()
    .map((symbol): ts.CompletionEntry | undefined => {
      if (!symbol.name || symbol.name.includes("__@") || existingNames.has(symbol.name)) {
        return undefined;
      }

      return {
        name: symbol.name,
        kind: typeScript.ScriptElementKind.memberVariableElement,
        kindModifiers: "",
        sortText: "12",
        replacementSpan
      };
    })
    .filter((entry): entry is ts.CompletionEntry => Boolean(entry));
}

function nativeAnchorElementAtPosition(
  typeScript: TypeScript,
  sourceFile: ts.SourceFile,
  position: number
) {
  let anchor: ts.JsxOpeningElement | ts.JsxSelfClosingElement | undefined;

  const visit = (node: ts.Node) => {
    if (anchor || position < node.getFullStart() || position > node.getEnd()) {
      return;
    }

    if (isNativeAnchorElement(typeScript, node)) {
      anchor = node;
      return;
    }

    typeScript.forEachChild(node, visit);
  };

  visit(sourceFile);
  return anchor;
}

function isNativeAnchorAttribute(typeScript: TypeScript, attribute: ts.JsxAttribute) {
  const attributes = attribute.parent;
  const element = attributes.parent;

  return isNativeAnchorElement(typeScript, element);
}

function isNativeAnchorElement(
  typeScript: TypeScript,
  node: ts.Node
): node is ts.JsxOpeningElement | ts.JsxSelfClosingElement {
  return (
    (typeScript.isJsxOpeningElement(node) || typeScript.isJsxSelfClosingElement(node)) &&
    typeScript.isIdentifier(node.tagName) &&
    node.tagName.text === "a"
  );
}

function createJsxSourceFile(
  typeScript: TypeScript,
  fileName: string,
  sourceText: string
): ts.SourceFile | undefined {
  const extension = extname(fileName);
  if (extension !== ".tsx" && extension !== ".jsx") {
    return undefined;
  }

  return typeScript.createSourceFile(
    fileName,
    sourceText,
    typeScript.ScriptTarget.Latest,
    true,
    extension === ".jsx" ? typeScript.ScriptKind.JSX : typeScript.ScriptKind.TSX
  );
}

function routeHrefCompletions(
  typeScript: TypeScript,
  info: ts.server.PluginCreateInfo,
  pagesDir: string
) {
  const hrefs = new Set<string>();

  for (const pageFileName of routeCompletionPageFileNames(typeScript, info, pagesDir)) {
    const relativeFileId = relative(pagesDir, pageFileName);
    if (!isRelativeInsidePath(relativeFileId)) {
      continue;
    }

    const fileId = normalizeRouteFileId(relativeFileId);
    if (!PAGE_EXTENSIONS.has(extname(fileId))) {
      continue;
    }

    const href = routeHrefCompletion(typeScript, fileId);
    if (href) {
      hrefs.add(href);
    }
  }

  return Array.from(hrefs).toSorted();
}

function routeHrefCompletion(typeScript: TypeScript, fileId: string) {
  if (isReservedOrUnsupportedPage(fileId)) {
    return undefined;
  }

  return routeFromFileId(typeScript, fileId).pattern;
}

function isReservedOrUnsupportedPage(fileId: string) {
  const extension = extname(fileId);
  const withoutExtension = fileId.slice(0, -extension.length);
  const routeFile = normalize(withoutExtension);
  const segments: string[] =
    routeFile === "." ? [] : routeFile.split("/").filter(Boolean);

  return (
    segments[0] === "api" ||
    (segments.length === 1 && (segments[0] === "404" || segments[0] === "500"))
  );
}

function routeCompletionPageFileNames(
  typeScript: TypeScript,
  info: ts.server.PluginCreateInfo,
  pagesDir: string
) {
  const fileNames = new Set(projectFileNames(info));

  for (const fileName of readPageFileNames(typeScript, pagesDir)) {
    fileNames.add(fileName);
  }

  return fileNames;
}

function readPageFileNames(typeScript: TypeScript, pagesDir: string) {
  if (typeScript.sys.directoryExists && !typeScript.sys.directoryExists(pagesDir)) {
    return [];
  }

  try {
    return typeScript.sys.readDirectory(
      pagesDir,
      Array.from(PAGE_EXTENSIONS),
      undefined,
      undefined
    );
  } catch {
    return [];
  }
}

function toOriginalPosition(
  transform: TypedSourceTransform | undefined,
  position: number
) {
  if (!transform || position <= transform.insertAt) {
    return position;
  }

  const insertedEnd = transform.insertAt + transform.insertedLength;
  if (position <= insertedEnd) {
    return transform.insertAt;
  }

  return position - transform.insertedLength;
}

function mapQuickInfoToOriginal(
  quickInfo: ts.QuickInfo,
  transform: TypedSourceTransform | undefined
): ts.QuickInfo {
  return {
    ...quickInfo,
    textSpan: mapTextSpanToOriginal(quickInfo.textSpan, transform)
  };
}

function mapDiagnosticsToOriginal<T extends ts.Diagnostic>(
  diagnostics: T[],
  transform: TypedSourceTransform | undefined
): T[] {
  if (!transform) {
    return diagnostics;
  }

  return diagnostics
    .filter((diagnostic) => !isGeneratedOnlyDiagnostic(diagnostic, transform))
    .map((diagnostic) => ({
      ...diagnostic,
      start:
        typeof diagnostic.start === "number"
          ? toOriginalPosition(transform, diagnostic.start)
          : diagnostic.start,
      length:
        typeof diagnostic.start === "number" && typeof diagnostic.length === "number"
          ? mapTextSpanToOriginal(
              { start: diagnostic.start, length: diagnostic.length },
              transform
            ).length
          : diagnostic.length
    }));
}

function isGeneratedOnlyDiagnostic(
  diagnostic: ts.Diagnostic,
  transform: TypedSourceTransform
) {
  if (typeof diagnostic.start !== "number") {
    return false;
  }

  const insertedEnd = transform.insertAt + transform.insertedLength;
  return diagnostic.start >= transform.insertAt && diagnostic.start <= insertedEnd;
}

function mapTextSpanToOriginal(
  textSpan: ts.TextSpan,
  transform: TypedSourceTransform | undefined
): ts.TextSpan {
  if (!transform) {
    return textSpan;
  }

  const start = toOriginalPosition(transform, textSpan.start);
  const end = toOriginalPosition(transform, textSpan.start + textSpan.length);
  return { start, length: Math.max(0, end - start) };
}

function getProjectRoot(typeScript: TypeScript, info: ts.server.PluginCreateInfo) {
  return (
    info.project.getCurrentDirectory() ??
    info.languageServiceHost.getCurrentDirectory?.() ??
    typeScript.sys.getCurrentDirectory()
  );
}

function resolvePagesDir(projectRoot: string, config: ResumablePluginConfig) {
  const configured = config.pagesDir ?? "pages";
  return isAbsolute(configured) ? configured : resolve(projectRoot, configured);
}

function routeForFileName(
  typeScript: TypeScript,
  info: ts.server.PluginCreateInfo,
  projectRoot: string,
  pagesDir: string,
  fileName: string
): PageRoute | undefined {
  if (isTopLevelDocumentFile(projectRoot, fileName)) {
    return routeForDocument(typeScript, info, pagesDir, fileName);
  }

  const relativeFileId = relative(pagesDir, fileName);
  if (!isRelativeInsidePath(relativeFileId)) {
    return undefined;
  }

  const fileId = normalizeRouteFileId(relativeFileId);
  if (!PAGE_EXTENSIONS.has(extname(fileId))) {
    return undefined;
  }

  return routeFromFileId(typeScript, fileId);
}

function normalizeRouteFileId(fileId: string) {
  return withoutLeadingSlash(normalize(fileId));
}

function isTopLevelDocumentFile(projectRoot: string, fileName: string) {
  const fileId = normalizeRouteFileId(relative(projectRoot, fileName));
  return fileId === "document.tsx" || fileId === "document.jsx";
}

function routeForDocument(
  typeScript: TypeScript,
  info: ts.server.PluginCreateInfo,
  pagesDir: string,
  fileName: string
): PageRoute {
  const params = new Set<string>();

  for (const pageFileName of projectFileNames(info)) {
    if (pageFileName === fileName) {
      continue;
    }

    const relativeFileId = relative(pagesDir, pageFileName);
    if (!isRelativeInsidePath(relativeFileId)) {
      continue;
    }

    const fileId = normalizeRouteFileId(relativeFileId);
    if (!PAGE_EXTENSIONS.has(extname(fileId))) {
      continue;
    }

    for (const param of routeFromFileId(typeScript, fileId).params) {
      params.add(param);
    }
  }

  return {
    pattern: normalizeRouteFileId(fileName).endsWith("document.jsx")
      ? "document.jsx"
      : "document.tsx",
    params: Array.from(params).toSorted(),
    optionalParams: true
  };
}

function projectFileNames(info: ts.server.PluginCreateInfo) {
  return info.languageServiceHost.getScriptFileNames?.() ?? [];
}

function routeFromFileId(typeScript: TypeScript, fileId: string) {
  const extension = extname(fileId);
  const withoutExtension = fileId.slice(0, -extension.length);
  const routeFile = normalize(withoutExtension);
  const segments: string[] =
    routeFile === "." ? [] : routeFile.split("/").filter(Boolean);

  if (segments.at(-1) === "index") {
    segments.pop();
  }

  const params: string[] = [];
  const routeSegments: string[] = [];

  for (const segment of segments) {
    const catchAllName = bracketParamName(typeScript, segment, "[...");
    if (catchAllName) {
      routeSegments.push(`[...${catchAllName}]`);
      params.push(catchAllName);
      continue;
    }

    const dynamicName = bracketParamName(typeScript, segment, "[");
    if (dynamicName) {
      routeSegments.push(`[${dynamicName}]`);
      params.push(dynamicName);
      continue;
    }

    routeSegments.push(segment);
  }

  return {
    pattern: routePathname(routeSegments),
    params
  };
}

function requestFileRouteForFileName(
  typeScript: TypeScript,
  projectRoot: string,
  fileName: string
): RequestFileRoute | undefined {
  const relativeFileId = relative(projectRoot, fileName);
  if (!isRelativeInsidePath(relativeFileId)) {
    return undefined;
  }

  const fileId = normalizeRouteFileId(relativeFileId);
  if (extname(fileId) !== REQUEST_FILE_EXTENSION) {
    return undefined;
  }

  if (fileId.startsWith("api/")) {
    return {
      kind: "api",
      params: apiRouteParamsFromFileId(typeScript, fileId)
    };
  }

  return fileId.startsWith("middleware/")
    ? {
        kind: "middleware",
        params: []
      }
    : undefined;
}

function apiRouteParamsFromFileId(typeScript: TypeScript, fileId: string) {
  const apiFile = relative("api", fileId);
  const withoutExtension = apiFile.slice(0, -REQUEST_FILE_EXTENSION.length);
  const routeFile = normalize(withoutExtension);
  const segments: string[] =
    routeFile === "." ? [] : routeFile.split("/").filter(Boolean);
  const finalSegment = segments.at(-1);
  const method = finalSegment ? methodSuffix(finalSegment) : undefined;

  if (finalSegment && method) {
    segments[segments.length - 1] = finalSegment.slice(0, -(method.length + 1));
  }

  if (segments.at(-1) === "index") {
    segments.pop();
  }

  return segments.flatMap((segment) => {
    const catchAllName = bracketParamName(typeScript, segment, "[...");
    if (catchAllName) {
      return [catchAllName];
    }

    const dynamicName = bracketParamName(typeScript, segment, "[");
    return dynamicName ? [dynamicName] : [];
  });
}

function methodSuffix(finalSegment: string) {
  const suffix = finalSegment.split(".").at(-1);
  return suffix && HTTP_METHODS.has(suffix) ? suffix : undefined;
}

function bracketParamName(
  typeScript: TypeScript,
  segment: string,
  opening: "[" | "[..."
) {
  if (!segment.startsWith(opening) || !segment.endsWith("]")) {
    return undefined;
  }

  const name = segment.slice(opening.length, -1);
  return isIdentifierNameText(typeScript, name) ? name : undefined;
}

function routePathname(segments: readonly string[]) {
  if (segments.length === 0) {
    return "/";
  }

  const [base, ...rest] = segments;
  return withLeadingSlash(joinURL(base!, ...rest));
}

function isRelativeInsidePath(path: string) {
  return path !== "" && path !== ".." && !path.startsWith("../") && !isAbsolute(path);
}

function defaultExportFunctionParameter(
  typeScript: TypeScript,
  sourceFile: ts.SourceFile
): FunctionParameterTypeTarget | undefined {
  const functionBindings = new Map<
    string,
    ts.ArrowFunction | ts.FunctionDeclaration | ts.FunctionExpression
  >();
  let defaultExpression: ts.Expression | undefined;

  for (const statement of sourceFile.statements) {
    if (typeScript.isFunctionDeclaration(statement)) {
      if (isDefaultExportDeclaration(typeScript, statement)) {
        return functionParameterTypeTarget(typeScript, statement);
      }

      if (statement.name) {
        functionBindings.set(statement.name.text, statement);
      }
      continue;
    }

    if (typeScript.isExportAssignment(statement) && !statement.isExportEquals) {
      defaultExpression = statement.expression;
      continue;
    }

    if (!typeScript.isVariableStatement(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (!typeScript.isIdentifier(declaration.name) || !declaration.initializer) {
        continue;
      }

      const initializer = skipOuterExpressions(typeScript, declaration.initializer);
      if (
        typeScript.isArrowFunction(initializer) ||
        typeScript.isFunctionExpression(initializer)
      ) {
        functionBindings.set(declaration.name.text, initializer);
      }
    }
  }

  if (!defaultExpression) {
    return undefined;
  }

  const expression = skipOuterExpressions(typeScript, defaultExpression);
  if (
    typeScript.isArrowFunction(expression) ||
    typeScript.isFunctionExpression(expression)
  ) {
    return functionParameterTypeTarget(typeScript, expression);
  }

  if (typeScript.isIdentifier(expression)) {
    const functionBinding = functionBindings.get(expression.text);
    return functionBinding
      ? functionParameterTypeTarget(typeScript, functionBinding)
      : undefined;
  }

  return undefined;
}

function functionParameterTypeTarget(
  typeScript: TypeScript,
  fn: ts.ArrowFunction | ts.FunctionDeclaration | ts.FunctionExpression
): FunctionParameterTypeTarget | undefined {
  const [parameter] = fn.parameters;
  if (!parameter || !typeScript.isIdentifier(parameter.name)) {
    return undefined;
  }

  return {
    insertTypeAt: parameter.name.getEnd(),
    hasType: parameter.type !== undefined
  };
}

function isDefaultExportDeclaration(typeScript: TypeScript, node: ts.Node) {
  return (
    hasModifier(node, typeScript.SyntaxKind.ExportKeyword) &&
    hasModifier(node, typeScript.SyntaxKind.DefaultKeyword)
  );
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind) {
  const modifiers = (node as { modifiers?: readonly { kind: ts.SyntaxKind }[] })
    .modifiers;
  return modifiers?.some((modifier) => modifier.kind === kind) ?? false;
}

function defaultExportPageProps(typeScript: TypeScript, sourceFile: ts.SourceFile) {
  const componentInitializers = new Map<string, ts.CallExpression>();
  let defaultExpression: ts.Expression | undefined;

  for (const statement of sourceFile.statements) {
    if (typeScript.isExportAssignment(statement) && !statement.isExportEquals) {
      defaultExpression = statement.expression;
      continue;
    }

    if (!typeScript.isVariableStatement(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      const componentCall = declaration.initializer
        ? componentCallExpression(typeScript, declaration.initializer)
        : undefined;
      if (typeScript.isIdentifier(declaration.name) && componentCall) {
        componentInitializers.set(declaration.name.text, componentCall);
      }
    }
  }

  if (!defaultExpression) {
    return undefined;
  }

  const expression = skipOuterExpressions(typeScript, defaultExpression);
  const inlineComponentCall = componentCallExpression(typeScript, expression);
  if (inlineComponentCall) {
    return componentCallProps(typeScript, sourceFile, inlineComponentCall);
  }

  if (typeScript.isIdentifier(expression)) {
    const initializer = componentInitializers.get(expression.text);
    return initializer
      ? componentCallProps(typeScript, sourceFile, initializer)
      : undefined;
  }

  return undefined;
}

function componentCallExpression(
  typeScript: TypeScript,
  expression: ts.Expression
): ts.CallExpression | undefined {
  const unwrapped = skipOuterExpressions(typeScript, expression);
  if (!typeScript.isCallExpression(unwrapped)) {
    return undefined;
  }

  const callee = skipOuterExpressions(typeScript, unwrapped.expression);
  return typeScript.isIdentifier(callee) && callee.text === "component$"
    ? unwrapped
    : undefined;
}

function componentCallProps(
  typeScript: TypeScript,
  sourceFile: ts.SourceFile,
  call: ts.CallExpression
) {
  const component = call.arguments[0];
  if (
    !component ||
    (!typeScript.isArrowFunction(component) &&
      !typeScript.isFunctionExpression(component))
  ) {
    return undefined;
  }

  const [props] = component.parameters;
  return props && typeScript.isIdentifier(props.name)
    ? {
        name: props.name.text,
        insertTypeAt: props.name.getEnd(),
        hasType: props.type !== undefined
      }
    : undefined;
}

function skipOuterExpressions(typeScript: TypeScript, expression: ts.Expression) {
  let current = expression;

  while (true) {
    if (typeScript.isParenthesizedExpression(current)) {
      current = current.expression;
      continue;
    }

    if (
      typeScript.isAsExpression(current) ||
      typeScript.isTypeAssertionExpression(current)
    ) {
      current = current.expression;
      continue;
    }

    if (typeScript.isSatisfiesExpression(current)) {
      current = current.expression;
      continue;
    }

    if (typeScript.isNonNullExpression(current)) {
      current = current.expression;
      continue;
    }

    return current;
  }
}

function pageParamsType(params: readonly string[], optional = false) {
  if (params.length === 0) {
    return "{}";
  }

  const fields = params
    .map((param) => `readonly ${param}${optional ? "?" : ""}: string;`)
    .join(" ");
  return `{ ${fields} }`;
}

function isIdentifierNameText(typeScript: TypeScript, text: string) {
  const scanner = typeScript.createScanner(
    typeScript.ScriptTarget.Latest,
    false,
    typeScript.LanguageVariant.Standard,
    text
  );
  const token = scanner.scan();

  if (scanner.getTokenText() !== text) {
    return false;
  }

  const isIdentifierName =
    token === typeScript.SyntaxKind.Identifier ||
    (token >= typeScript.SyntaxKind.FirstKeyword &&
      token <= typeScript.SyntaxKind.LastKeyword);

  return isIdentifierName && scanner.scan() === typeScript.SyntaxKind.EndOfFileToken;
}

export = init;
