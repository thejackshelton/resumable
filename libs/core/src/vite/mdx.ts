import { defineMdastPlugin, mdxToJs, type MdastPluginInput } from "satteri";
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
          map: null,
        };
      },
    },
  };
}

export async function transformMdxRoute(source: string, id: string) {
  const normalized = await normalizeComposedMdx(source, id);
  const result = await compileMdx(
    normalized.source,
    id,
    normalized.mdastPlugins,
  );

  normalized.verify?.();

  return result.code;
}

async function compileMdx(
  source: string,
  id: string,
  mdastPlugins: MdastPluginInput[] = [],
) {
  return await Promise.resolve(
    mdxToJs(source, {
      filename: id,
      jsxImportSource: "@qwik.dev/core",
      elementAttributeNameCase: "html",
      mdastPlugins,
    }),
  );
}

async function normalizeComposedMdx(source: string, id: string) {
  const delimiterLines = delimiterLineIndexes(source);
  if (delimiterLines.length === 0) {
    return { source };
  }

  if (delimiterLines.length > 1) {
    throw new Error(
      `Composed MDX must contain exactly one ${COMPOSED_MDX_DELIMITER} delimiter: ${id}`,
    );
  }

  const lines = source.split(/\r?\n/);
  const delimiterLine = delimiterLines[0]!;
  const componentTree = lines.slice(0, delimiterLine).join("\n");
  const contentBody = lines.slice(delimiterLine + 1).join("\n");

  await compileMdx(contentBody, id, [rejectContentBodyEsm(id)]);

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
    },
  });

  return {
    source: componentTree,
    mdastPlugins: [contentSlotPlugin],
    verify() {
      if (slotCount !== 1) {
        throw new Error(
          `Composed MDX must contain exactly one visible <Content /> slot: ${id}`,
        );
      }
    },
  };
}

function delimiterLineIndexes(source: string) {
  return source
    .split(/\r?\n/)
    .flatMap((line, index) => (line === COMPOSED_MDX_DELIMITER ? [index] : []));
}

function rejectContentBodyEsm(id: string) {
  return defineMdastPlugin({
    name: "resumable-composed-mdx-content-body",
    mdxjsEsm() {
      throw new Error(
        `ESM imports and exports must appear above ${COMPOSED_MDX_DELIMITER}: ${id}`,
      );
    },
  });
}

function isMdxFile(id: string) {
  return extname(decodePath(parseURL(id).pathname)) === ".mdx";
}
