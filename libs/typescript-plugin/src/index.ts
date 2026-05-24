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

const PAGE_EXTENSIONS = new Set([".tsx", ".jsx", ".mdx"]);

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
        return languageService.getCompletionsAtPosition(
          fileName,
          generatedPosition,
          options,
          formattingSettings
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

  return {
    generatedText:
      sourceText.slice(0, props.insertTypeAt) +
      annotation +
      sourceText.slice(props.insertTypeAt),
    insertAt: props.insertTypeAt,
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
  const segments = routeFile === "." ? [] : routeFile.split("/").filter(Boolean);

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
