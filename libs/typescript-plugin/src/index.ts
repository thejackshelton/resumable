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
};

type PageContext = {
  route: PageRoute;
  propsName: string;
  sourceFile: ts.SourceFile;
};

type PageContextCacheEntry = {
  version: string;
  context: PageContext | undefined;
};

const PAGE_EXTENSIONS = new Set([".tsx", ".jsx", ".mdx"]);
const ROUTE_SOURCE_PREFIX = "Resumable route ";

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
      const pageContextCache = new Map<string, PageContextCacheEntry>();

      proxy.getCompletionsAtPosition = (
        fileName,
        position,
        options,
        formattingSettings
      ) => {
        const resumableEntries = completePageProps(
          typeScript,
          info,
          pageContextCache,
          projectRoot,
          pagesDir,
          fileName,
          position
        );
        const typeScriptCompletion = languageService.getCompletionsAtPosition(
          fileName,
          position,
          options,
          formattingSettings
        );

        if (resumableEntries.length === 0) {
          return typeScriptCompletion;
        }

        const entries = mergeCompletionEntries(
          resumableEntries,
          typeScriptCompletion?.entries ?? []
        );

        return {
          ...(typeScriptCompletion ?? {
            isGlobalCompletion: false,
            isMemberCompletion: true,
            isNewIdentifierLocation: false
          }),
          entries
        };
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
        const resumableEntry = completePageProps(
          typeScript,
          info,
          pageContextCache,
          projectRoot,
          pagesDir,
          fileName,
          position
        ).find((entry) => entry.name === entryName);

        if (resumableEntry) {
          return completionEntryDetails(typeScript, resumableEntry);
        }

        return languageService.getCompletionEntryDetails(
          fileName,
          position,
          entryName,
          formatOptions,
          source,
          preferences,
          data
        );
      };

      proxy.getQuickInfoAtPosition = (fileName, position, maximumLength) => {
        const pagePropsQuickInfo = quickInfoForPageProps(
          typeScript,
          info,
          pageContextCache,
          projectRoot,
          pagesDir,
          fileName,
          position
        );
        if (pagePropsQuickInfo) {
          return pagePropsQuickInfo;
        }

        return languageService.getQuickInfoAtPosition(fileName, position, maximumLength);
      };

      proxy.getSemanticDiagnostics = (fileName) => {
        const diagnostics = languageService.getSemanticDiagnostics(fileName);
        return filterUnknownPropsDiagnostics(
          typeScript,
          info,
          pageContextCache,
          projectRoot,
          pagesDir,
          fileName,
          diagnostics
        );
      };

      return proxy;
    }
  };
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

function completePageProps(
  typeScript: TypeScript,
  info: ts.server.PluginCreateInfo,
  cache: Map<string, PageContextCacheEntry>,
  projectRoot: string,
  pagesDir: string,
  fileName: string,
  position: number
) {
  const context = pageContext(typeScript, info, cache, projectRoot, pagesDir, fileName);
  if (!context) {
    return [];
  }

  const target = completionTargetAt(context.sourceFile.text, position);
  if (!target || target.rootName !== context.propsName) {
    return [];
  }

  if (target.path.length === 1 && target.path[0] === "params") {
    return context.route.params.map((param) =>
      completionEntry(typeScript, param, `${param}: string`, context.route)
    );
  }

  if (target.path.length === 1 && target.path[0] === "url") {
    return [
      ["href", "href: string"],
      ["pathname", "pathname: string"],
      ["search", "search: string"]
    ].map(([name, detail]) => completionEntry(typeScript, name, detail, context.route));
  }

  if (target.path.length !== 0) {
    return [];
  }

  return [
    ["params", `params: ${pageParamsType(context.route.params)}`],
    [
      "url",
      "url: { readonly href: string; readonly pathname: string; readonly search: string; }"
    ],
    ["status", "status: number"]
  ].map(([name, detail]) => completionEntry(typeScript, name, detail, context.route));
}

function completionTargetAt(source: string, position: number) {
  let cursor = position - 1;
  if (source[cursor] !== ".") {
    return undefined;
  }

  const parts: string[] = [];

  while (cursor >= 0 && source[cursor] === ".") {
    cursor -= 1;

    const end = cursor + 1;
    while (cursor >= 0 && isIdentifierChar(source[cursor])) {
      cursor -= 1;
    }

    const start = cursor + 1;
    if (start === end) {
      return undefined;
    }

    parts.unshift(source.slice(start, end));
  }

  const [rootName, ...path] = parts;
  return rootName ? { rootName, path } : undefined;
}

function completionEntry(
  typeScript: TypeScript,
  name: string,
  detail: string,
  route: PageRoute
): ts.CompletionEntry {
  return {
    name,
    kind: typeScript.ScriptElementKind.memberVariableElement,
    kindModifiers: "",
    sortText: `0_${name}`,
    labelDetails: {
      detail: detail.replace(name, "")
    },
    sourceDisplay: [{ text: `${ROUTE_SOURCE_PREFIX}${route.pattern}`, kind: "text" }]
  };
}

function completionEntryDetails(
  typeScript: TypeScript,
  completion: ts.CompletionEntry
): ts.CompletionEntryDetails {
  const route =
    completion.sourceDisplay?.[0]?.text.replace(ROUTE_SOURCE_PREFIX, "") ?? "";

  return {
    name: completion.name,
    kind: completion.kind,
    kindModifiers: completion.kindModifiers ?? "",
    displayParts: displayParts(
      `${completion.name}${completion.labelDetails?.detail ?? ""}`
    ),
    documentation: displayParts(route ? `Route: ${route}` : "Resumable page prop"),
    tags: []
  };
}

function mergeCompletionEntries(
  resumableEntries: ts.CompletionEntry[],
  typeScriptEntries: ts.CompletionEntry[]
) {
  const seen = new Set<string>();
  const entries: ts.CompletionEntry[] = [];

  for (const entry of resumableEntries) {
    entries.push(entry);
    seen.add(`${entry.name}\0${entry.kind}`);
  }

  for (const entry of typeScriptEntries) {
    const key = `${entry.name}\0${entry.kind}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    entries.push(entry);
  }

  return entries;
}

function quickInfoForPageProps(
  typeScript: TypeScript,
  info: ts.server.PluginCreateInfo,
  cache: Map<string, PageContextCacheEntry>,
  projectRoot: string,
  pagesDir: string,
  fileName: string,
  position: number
) {
  const context = pageContext(typeScript, info, cache, projectRoot, pagesDir, fileName);
  if (!context) {
    return undefined;
  }

  const identifier = identifierAtPosition(typeScript, context.sourceFile, position);
  if (!identifier) {
    return undefined;
  }

  const paramsType = pageParamsType(context.route.params);

  if (identifier.text === context.propsName) {
    return quickInfo(
      typeScript,
      identifier,
      `props: PageProps<${paramsType}>`,
      context.route
    );
  }

  if (
    identifier.text === "params" &&
    isNamedPropertyAccess(typeScript, identifier, context.propsName)
  ) {
    return quickInfo(typeScript, identifier, `params: ${paramsType}`, context.route);
  }

  if (
    context.route.params.includes(identifier.text) &&
    isRouteParamAccess(typeScript, identifier, context.propsName)
  ) {
    return quickInfo(
      typeScript,
      identifier,
      `(property) ${identifier.text}: string`,
      context.route
    );
  }

  return undefined;
}

function quickInfo(
  typeScript: TypeScript,
  identifier: ts.Identifier,
  text: string,
  route: PageRoute
): ts.QuickInfo {
  return {
    kind: typeScript.ScriptElementKind.memberVariableElement,
    kindModifiers: "",
    textSpan: { start: identifier.getStart(), length: identifier.getWidth() },
    displayParts: displayParts(text),
    documentation: displayParts(`Route: ${route.pattern}`),
    tags: []
  };
}

function filterUnknownPropsDiagnostics(
  typeScript: TypeScript,
  info: ts.server.PluginCreateInfo,
  cache: Map<string, PageContextCacheEntry>,
  projectRoot: string,
  pagesDir: string,
  fileName: string,
  diagnostics: ts.Diagnostic[]
) {
  if (!diagnostics.some((diagnostic) => diagnostic.code === 18046)) {
    return diagnostics;
  }

  const context = pageContext(typeScript, info, cache, projectRoot, pagesDir, fileName);
  if (!context) {
    return diagnostics;
  }

  return diagnostics.filter(
    (diagnostic) => !shouldSuppressUnknownPropsDiagnostic(typeScript, context, diagnostic)
  );
}

function shouldSuppressUnknownPropsDiagnostic(
  typeScript: TypeScript,
  context: PageContext,
  diagnostic: ts.Diagnostic
) {
  if (diagnostic.code !== 18046 || typeof diagnostic.start !== "number") {
    return false;
  }

  const message = typeScript.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
  if (!message.includes(`'${context.propsName}' is of type 'unknown'`)) {
    return false;
  }

  const identifier = identifierAtPosition(
    typeScript,
    context.sourceFile,
    diagnostic.start
  );
  return identifier?.text === context.propsName;
}

function pageContext(
  typeScript: TypeScript,
  info: ts.server.PluginCreateInfo,
  cache: Map<string, PageContextCacheEntry>,
  projectRoot: string,
  pagesDir: string,
  fileName: string
): PageContext | undefined {
  const version = info.languageServiceHost.getScriptVersion?.(fileName);
  const cached = version ? cache.get(fileName) : undefined;
  if (cached?.version === version) {
    return cached.context;
  }

  const context = createPageContext(typeScript, info, projectRoot, pagesDir, fileName);
  if (version) {
    cache.set(fileName, { version, context });
  }

  return context;
}

function createPageContext(
  typeScript: TypeScript,
  info: ts.server.PluginCreateInfo,
  projectRoot: string,
  pagesDir: string,
  fileName: string
): PageContext | undefined {
  const route = routeForFileName(typeScript, projectRoot, pagesDir, fileName);
  if (!route) {
    return undefined;
  }

  const sourceFile = info.languageService.getProgram()?.getSourceFile(fileName);
  if (!sourceFile) {
    return undefined;
  }

  const propsName = defaultExportPagePropsName(typeScript, sourceFile);
  if (!propsName) {
    return undefined;
  }

  return { route, propsName, sourceFile };
}

function routeForFileName(
  typeScript: TypeScript,
  projectRoot: string,
  pagesDir: string,
  fileName: string
): PageRoute | undefined {
  if (isTopLevelDocumentFile(projectRoot, fileName)) {
    return { pattern: "document.tsx", params: [] };
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
  return normalizeRouteFileId(relative(projectRoot, fileName)) === "document.tsx";
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
  return isIdentifierText(typeScript, name) ? name : undefined;
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

function defaultExportPagePropsName(typeScript: TypeScript, sourceFile: ts.SourceFile) {
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
    return componentCallPropsName(typeScript, inlineComponentCall);
  }

  if (typeScript.isIdentifier(expression)) {
    const initializer = componentInitializers.get(expression.text);
    return initializer ? componentCallPropsName(typeScript, initializer) : undefined;
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

function componentCallPropsName(typeScript: TypeScript, call: ts.CallExpression) {
  const component = call.arguments[0];
  if (
    !component ||
    (!typeScript.isArrowFunction(component) &&
      !typeScript.isFunctionExpression(component))
  ) {
    return undefined;
  }

  const [props] = component.parameters;
  return props && typeScript.isIdentifier(props.name) ? props.name.text : undefined;
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

function pageParamsType(params: readonly string[]) {
  if (params.length === 0) {
    return "{}";
  }

  const fields = params.map((param) => `readonly ${param}: string;`).join(" ");
  return `{ ${fields} }`;
}

function identifierAtPosition(
  typeScript: TypeScript,
  sourceFile: ts.SourceFile,
  position: number
): ts.Identifier | undefined {
  let match: ts.Identifier | undefined;

  function visit(node: ts.Node) {
    if (position < node.getFullStart() || position > node.getEnd()) {
      return;
    }

    if (
      typeScript.isIdentifier(node) &&
      position >= node.getStart(sourceFile) &&
      position <= node.getEnd()
    ) {
      match = node;
      return;
    }

    typeScript.forEachChild(node, visit);
  }

  visit(sourceFile);
  return match;
}

function isNamedPropertyAccess(
  typeScript: TypeScript,
  identifier: ts.Identifier,
  expressionName: string
) {
  const access = propertyAccessNamedBy(typeScript, identifier);
  return (
    access !== undefined &&
    typeScript.isIdentifier(access.expression) &&
    access.expression.text === expressionName
  );
}

function isRouteParamAccess(
  typeScript: TypeScript,
  identifier: ts.Identifier,
  propsName: string
) {
  const routeParamAccess = propertyAccessNamedBy(typeScript, identifier);
  if (
    !routeParamAccess ||
    !typeScript.isPropertyAccessExpression(routeParamAccess.expression)
  ) {
    return false;
  }

  const paramsAccess = routeParamAccess.expression;
  return (
    paramsAccess.name.text === "params" &&
    typeScript.isIdentifier(paramsAccess.expression) &&
    paramsAccess.expression.text === propsName
  );
}

function propertyAccessNamedBy(typeScript: TypeScript, identifier: ts.Identifier) {
  const parent = identifier.parent;
  return typeScript.isPropertyAccessExpression(parent) && parent.name === identifier
    ? parent
    : undefined;
}

function displayParts(text: string): ts.SymbolDisplayPart[] {
  return [{ text, kind: "text" }];
}

function isIdentifierText(typeScript: TypeScript, text: string) {
  const scanner = typeScript.createScanner(
    typeScript.ScriptTarget.Latest,
    false,
    typeScript.LanguageVariant.Standard,
    text
  );

  return (
    scanner.scan() === typeScript.SyntaxKind.Identifier &&
    scanner.getTokenText() === text &&
    scanner.scan() === typeScript.SyntaxKind.EndOfFileToken
  );
}

function isIdentifierChar(char: string | undefined) {
  return Boolean(char && /[A-Za-z0-9_$]/.test(char));
}

export = init;
