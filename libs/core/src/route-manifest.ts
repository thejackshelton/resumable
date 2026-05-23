import { extname, join, normalize, relative } from "pathe";
import {
  joinURL,
  withLeadingSlash,
  withoutLeadingSlash,
  withoutTrailingSlash
} from "ufo";

const PAGES_DIR = "pages";
const PAGE_EXTENSION = ".tsx";

export interface RouteManifestRoute {
  readonly pathname: string;
  readonly file: string;
  readonly params: readonly RouteManifestParam[];
}

export interface RouteManifestParam {
  readonly name: string;
  readonly kind: "dynamic" | "catch-all";
}

export interface RouteManifestStatusPages {
  readonly notFound?: string;
  readonly error?: string;
}

export interface RouteManifest {
  readonly routes: readonly RouteManifestRoute[];
  readonly statusPages: RouteManifestStatusPages;
}

type InternalRouteManifestRoute = RouteManifestRoute & {
  readonly identity: string;
  readonly relativeFile: string;
};

type NormalizedPage =
  | {
      readonly kind: "route";
      readonly route: InternalRouteManifestRoute;
    }
  | {
      readonly kind: "status";
      readonly status: keyof RouteManifestStatusPages;
      readonly file: string;
    };

type NormalizedRouteSegment = {
  readonly pathname: string;
  readonly identity: string;
  readonly params: readonly RouteManifestParam[];
};

export function buildRouteManifestFromFileIds(fileIds: readonly string[]): RouteManifest {
  const pages = unique(fileIds.map(normalizeRouteFileId))
    .filter(isPageModuleFile)
    .toSorted((left, right) => left.localeCompare(right))
    .map(normalizePage);
  const routes = pages.flatMap((page) => (page.kind === "route" ? [page.route] : []));

  assertNoRouteConflicts(routes);

  const statusPages: Partial<Record<keyof RouteManifestStatusPages, string>> = {};
  for (const page of pages) {
    if (page.kind === "status") {
      statusPages[page.status] = page.file;
    }
  }

  return {
    routes: routes.map(toPublicRoute).toSorted(compareRoutes),
    statusPages
  };
}

export function normalizeRequestPathname(pathname: string) {
  const normalizedPathname = withoutTrailingSlash(withLeadingSlash(pathname));
  return normalizedPathname === "" ? "/" : normalizedPathname;
}

export function normalizeRouteFileId(fileId: string) {
  return withoutLeadingSlash(normalize(fileId));
}

function isPageModuleFile(file: string) {
  const pageFile = pageRelativeFile(file);
  return pageFile !== undefined && extname(pageFile) === PAGE_EXTENSION;
}

function normalizePage(file: string): NormalizedPage {
  const relativeFile = file;
  const pageFile = pageRelativeFile(file)!;

  if (pageFile === `api${PAGE_EXTENSION}` || pageFile.startsWith("api/")) {
    throw new Error(
      `API routes inside pages/ are not supported. Use top-level api/: ${relativeFile}`
    );
  }

  const withoutExtension = pageFile.slice(0, -PAGE_EXTENSION.length);
  const routeFile = normalize(join(withoutExtension));
  const rawSegments = routeFile === "." ? [] : routeFile.split("/");

  if (rawSegments.length === 1 && rawSegments[0] === "404") {
    return { kind: "status", status: "notFound", file: relativeFile };
  }

  if (rawSegments.length === 1 && rawSegments[0] === "500") {
    return { kind: "status", status: "error", file: relativeFile };
  }

  if (rawSegments.length > 1 && ["404", "500"].includes(rawSegments.at(-1)!)) {
    throw new Error(`Nested status pages are not supported in v0: ${relativeFile}`);
  }

  if (rawSegments.at(-1) === "index") {
    rawSegments.pop();
  }

  const segments = rawSegments.map((segment, index) =>
    normalizeSegment(segment, index, rawSegments, relativeFile)
  );
  const pathnameSegments = segments.map((segment) => segment.pathname);
  const identitySegments = segments.map((segment) => segment.identity);
  const params = segments.flatMap((segment) => segment.params);

  return {
    kind: "route",
    route: {
      pathname: routePathname(pathnameSegments),
      identity: routePathname(identitySegments),
      params,
      file: relativeFile,
      relativeFile
    }
  };
}

function pageRelativeFile(file: string) {
  if (file === PAGES_DIR || !file.startsWith(`${PAGES_DIR}/`)) {
    return undefined;
  }

  return relative(PAGES_DIR, file);
}

function normalizeSegment(
  segment: string,
  index: number,
  segments: readonly string[],
  relativeFile: string
): NormalizedRouteSegment {
  const catchAll = segment.match(/^\[\.\.\.([A-Za-z_$][\w$]*)\]$/);

  if (catchAll) {
    if (index !== segments.length - 1) {
      throw new Error(`Catch-all route segments must be final: ${relativeFile}`);
    }

    return {
      pathname: "**",
      identity: "**",
      params: [{ name: catchAll[1], kind: "catch-all" as const }]
    };
  }

  const dynamic = segment.match(/^\[([A-Za-z_$][\w$]*)\]$/);

  if (dynamic) {
    return {
      pathname: `:${dynamic[1]}`,
      identity: ":param",
      params: [{ name: dynamic[1], kind: "dynamic" as const }]
    };
  }

  if (segment.includes("[") || segment.includes("]")) {
    throw new Error(`Unsupported route segment pattern: ${relativeFile}`);
  }

  return {
    pathname: segment,
    identity: segment,
    params: []
  };
}

function assertNoRouteConflicts(routes: readonly InternalRouteManifestRoute[]) {
  const routesByIdentity = new Map<string, InternalRouteManifestRoute[]>();

  for (const route of routes) {
    const existingRoutes = routesByIdentity.get(route.identity) ?? [];
    existingRoutes.push(route);
    routesByIdentity.set(route.identity, existingRoutes);
  }

  for (const [identity, conflictingRoutes] of routesByIdentity) {
    if (conflictingRoutes.length < 2) {
      continue;
    }

    const files = conflictingRoutes
      .map((route) => route.relativeFile)
      .toSorted((left, right) => left.localeCompare(right));

    throw new Error(
      [
        `Route conflict: ${identity} is defined by both:`,
        ...files.map((file) => `- ${file}`),
        "",
        "Choose one."
      ].join("\n")
    );
  }
}

function toPublicRoute(route: InternalRouteManifestRoute): RouteManifestRoute {
  return {
    pathname: route.pathname,
    params: route.params,
    file: route.file
  };
}

function compareRoutes(left: RouteManifestRoute, right: RouteManifestRoute) {
  const leftSegments = splitRoutePathname(left.pathname);
  const rightSegments = splitRoutePathname(right.pathname);
  const length = Math.max(leftSegments.length, rightSegments.length);

  for (let index = 0; index < length; index += 1) {
    const leftSegment = leftSegments[index];
    const rightSegment = rightSegments[index];

    if (leftSegment === undefined) {
      return -1;
    }

    if (rightSegment === undefined) {
      return 1;
    }

    const rankDifference = segmentRank(leftSegment) - segmentRank(rightSegment);
    if (rankDifference !== 0) {
      return rankDifference;
    }

    if (segmentRank(leftSegment) === 0 && leftSegment !== rightSegment) {
      return leftSegment.localeCompare(rightSegment);
    }
  }

  return left.pathname.localeCompare(right.pathname);
}

function splitRoutePathname(pathname: string) {
  const route = withoutLeadingSlash(pathname);
  return route === "" ? [] : route.split("/");
}

function segmentRank(segment: string) {
  if (segment === "**") {
    return 2;
  }

  if (segment.startsWith(":")) {
    return 1;
  }

  return 0;
}

function unique(values: readonly string[]) {
  return [...new Set(values)];
}

function routePathname(segments: readonly string[]) {
  if (segments.length === 0) {
    return "/";
  }

  const [base, ...rest] = segments;
  return withLeadingSlash(joinURL(base!, ...rest));
}
