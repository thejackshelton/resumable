import {
  defineMdastPlugin,
  mdxToJs,
  mdxToMdast,
  type Frontmatter,
  type MdastNode,
  type MdastPluginDefinition
} from "satteri";
import type { Plugin } from "vite";
import { extname } from "pathe";
import { decodePath, parseURL } from "ufo";

const COMPOSED_MDX_DELIMITER = "--- content";
const CONTENT_SLOT_NAME = "Content";

export function mdxTransformPlugin(): Plugin {
  return {
    name: "resumable:mdx",
    enforce: "pre",
    transform: {
      order: "pre",
      async handler(code, id) {
        if (!isMdxFile(id)) {
          return;
        }

        return {
          code: await transformMdxRoute(code, id),
          map: null
        };
      }
    }
  };
}

export async function transformMdxRoute(source: string, id: string) {
  const normalized = normalizeComposedMdx(source, id);
  const result = await Promise.resolve(
    mdxToJs(normalized.source, {
      filename: id,
      jsxImportSource: "@qwik.dev/core",
      elementAttributeNameCase: "html",
      mdastPlugins: normalized.mdastPlugins
    })
  );

  normalized.verify?.();
  assertNoLayoutFrontmatter(result.frontmatter, id);

  return result.code;
}

function normalizeComposedMdx(source: string, id: string) {
  const delimiterLines = delimiterLineIndexes(source);
  if (delimiterLines.length === 0) {
    return { source };
  }

  if (delimiterLines.length > 1) {
    throw new Error(
      `Composed MDX must contain exactly one ${COMPOSED_MDX_DELIMITER} delimiter: ${id}`
    );
  }

  const lines = source.split(/\r?\n/);
  const delimiterLine = delimiterLines[0]!;
  const componentTree = lines.slice(0, delimiterLine).join("\n");
  const contentBody = lines.slice(delimiterLine + 1).join("\n");

  assertNoContentBinding(componentTree, id);
  assertNoContentBodyEsm(contentBody, id);

  let slotCount = 0;
  const contentSlotPlugin = defineMdastPlugin({
    name: "resumable-composed-mdx-content-slot",
    mdxJsxFlowElement(node) {
      if (node.name !== CONTENT_SLOT_NAME) {
        return;
      }

      slotCount += 1;
      return { raw: contentBody };
    },
    mdxJsxTextElement(node) {
      if (node.name !== CONTENT_SLOT_NAME) {
        return;
      }

      slotCount += 1;
      return { raw: contentBody };
    }
  } satisfies MdastPluginDefinition);

  return {
    source: componentTree,
    mdastPlugins: [contentSlotPlugin],
    verify() {
      if (slotCount !== 1) {
        throw new Error(
          `Composed MDX must contain exactly one visible <Content /> slot: ${id}`
        );
      }
    }
  };
}

function delimiterLineIndexes(source: string) {
  return source.split(/\r?\n/).flatMap((line, index) =>
    line === COMPOSED_MDX_DELIMITER ? [index] : []
  );
}

function assertNoContentBinding(source: string, id: string) {
  if (hasContentImport(source) || hasContentDefinition(source)) {
    throw new Error(
      `Composed MDX reserves <Content /> for the content slot. Do not import or define Content: ${id}`
    );
  }
}

function hasContentImport(source: string) {
  for (const statement of source.matchAll(/^\s*import\s+[^;]+;?/gm)) {
    const code = statement[0];
    if (
      /^\s*import\s+(?:type\s+)?Content\b/.test(code) ||
      /^\s*import\s+(?:type\s+)?\*\s+as\s+Content\b/.test(code) ||
      /^\s*import\s+(?:type\s+)?{[^}]*\bas\s+Content\b[^}]*}/.test(code) ||
      /^\s*import\s+(?:type\s+)?{[^}]*\bContent\s*(?:,|})/.test(code)
    ) {
      return true;
    }
  }

  return false;
}

function hasContentDefinition(source: string) {
  return /^\s*(?:export\s+)?(?:const|let|var|function|class|interface|type|enum)\s+Content\b/m.test(
    source
  );
}

function assertNoContentBodyEsm(source: string, id: string) {
  const tree = mdxToMdast(source);
  const esm = findNode(tree, "mdxjsEsm");
  if (esm) {
    throw new Error(
      `ESM imports and exports must appear above ${COMPOSED_MDX_DELIMITER}: ${id}`
    );
  }
}

function assertNoLayoutFrontmatter(frontmatter: Frontmatter | null, id: string) {
  if (frontmatter && /^layout\s*:/m.test(frontmatter.value)) {
    throw new Error(`MDX frontmatter layout is not supported in Resumable v0: ${id}`);
  }
}

function findNode(node: MdastNode, type: string): MdastNode | undefined {
  if (node.type === type) {
    return node;
  }

  if ("children" in node && Array.isArray(node.children)) {
    for (const child of node.children) {
      const match = findNode(child as MdastNode, type);
      if (match) {
        return match;
      }
    }
  }
}

function isMdxFile(id: string) {
  return extname(decodePath(parseURL(id).pathname)) === ".mdx";
}
