# Resumable CLI Specification

Status: Draft

Parent spec: [`SPEC.md`](./SPEC.md)

## Decision

The CLI should make it fast to create a Resumable app, but it should not become
a second framework configuration surface.

Core model:

```txt
create-resumable     -> create a new app
resumable            -> project CLI commands
vp                   -> generated app dev, build, check, fmt, and test
resumable()          -> framework Vite plugin
nitro: {}            -> native Nitro app config
```

The CLI should preserve the framework boundary:

```txt
Pages are Resumable.
Components are Qwik.
Server behavior is Nitro.
Configuration is Vite.
Tooling is Vite+.
```

## Package Shape

The public CLI should follow the same general package shape as Qwik's CLI: one
official CLI package with two binaries.

Recommended package:

```json
{
  "name": "@resumable.dev/cli",
  "bin": {
    "create-resumable": "./dist/bin/create-resumable.mjs",
    "resumable": "./dist/bin/resumable.mjs"
  },
  "files": ["dist", "stubs"]
}
```

`create-resumable` is the create entrypoint used by package-manager create
flows.

`resumable` is the project CLI entrypoint for commands such as `add`, `check`,
`routes`, `doctor`, `generate`, and `preview` when those commands are
implemented.

This is preferable to permanently splitting the create command and project CLI
into unrelated packages. The create and project commands need the same console
UI, package-manager operations, filesystem helpers, project detection, and
source editing primitives.

The CLI package may still publish a compatibility package or npm alias later if
package-manager create flows require it, but the primary implementation should
live in `@resumable.dev/cli`.

## Command Architecture

Commands should use a class-based lifecycle similar to Qwik's CLI command
programs.

Each command should have the same phases:

```txt
configure -> validate -> interact -> execute
```

Phase responsibilities:

- `configure`: register command name, description, positional args, and flags.
- `validate`: convert raw CLI args into typed input and fail on invalid values.
- `interact`: ask only for missing choices when running in an interactive TTY.
- `execute`: perform deterministic filesystem, package-manager, and process
  work.

This lifecycle keeps agent and CI behavior predictable:

```txt
non-interactive command + missing required input -> direct error
interactive command + missing required input     -> prompt
valid typed input                                -> deterministic execute
```

Recommended command classes:

```txt
CreateProgram
AddProgram
CheckProgram
RoutesProgram
DoctorProgram
GenerateProgram
PreviewProgram
```

The create command should be implemented as `CreateProgram`, not as a one-off
script, because create and add flows both need package-manager operations,
template commits, dependency merging, post-install tasks, and direct error
handling.

## CLI Dependencies

The CLI dependency direction should match Qwik's modern CLI direction: small,
purpose-built packages for prompts, argument parsing, package-manager
operations, source parsing, and source edits.

Recommended create-only dependency set:

```txt
@clack/prompts  -> interactive prompts
kleur           -> terminal colors
yargs           -> command and flag parsing
which-pm-runs   -> package-manager detection
panam           -> package-manager commands across pnpm, npm, yarn, bun, deno
semver          -> Node, Vite, Qwik, and Resumable version checks
```

Recommended project-command dependency additions:

```txt
ignore          -> file filtering
oxc-parser      -> parse TypeScript and Vite config
magic-string    -> safe source edits
magic-regexp    -> readable route and file-pattern expressions
```

Recommended dev dependency:

```txt
vite-plus       -> build, test, lint, and format the CLI package
```

Avoid building custom package-manager abstractions if `panam` covers the needed
install, add, remove, exec, dlx, and script-run behavior.

Avoid string-based source edits for `vite.config.ts`, `package.json`, route
files, or future integration add commands when an AST parser or structured JSON
edit is practical.

## CLI Test Evidence

Create-flow tests must prove generated output on disk, not only returned data
structures or mocked filesystem calls.

Use a real temporary root under `/tmp`, with a Resumable-specific prefix such
as:

```txt
/tmp/resumable-cli-test
/tmp/resumable-cli-create-*
```

Each create-flow test should clean its temporary root before or after the test
so runs are repeatable. On macOS, `/tmp` may resolve to `/private/tmp`; the test
intent is still a real temporary directory outside the repository.

The reference pattern is the local QwikDev Astro create package:

```txt
QwikDev/astro build/v2
libs/create-qwikdev-astro/tests/cli.spec.ts
```

That package runs the real create command into a `/tmp/...` destination and then
asserts generated directories and files through path helpers. Resumable should
use the same evidence style:

- Run the create flow with a real destination path under `/tmp`.
- Assert the project directory exists and is a directory.
- Assert every required generated directory exists.
- Assert every required generated file exists and is a file.
- Read important generated files such as `package.json` and `vite.config.ts`
  from disk and assert their contents.
- Assert forbidden files and directories are absent.
- Keep unit tests for argument parsing, prompt choices, and lifecycle defaults,
  but do not treat those as sufficient proof that a generated app is correct.

For the Minimal starter, the disk test should verify at least:

```txt
pages/index.tsx
public/
vite.config.ts
package.json
tsconfig.json
```

And verify these are absent:

```txt
resumable.config.ts
nitro.config.ts
src/pages/
pages/api/
```

## Create Flow

The primary command is:

```sh
pnpm create resumable my-app
```

Equivalent package-manager entrypoints should work:

```sh
npm create resumable my-app
bun create resumable my-app
yarn create resumable my-app
```

If the user passes a project name, the CLI should not ask for one.

```txt
$ pnpm create resumable my-app

create-resumable

◇ Project format
│ Node        package.json
│ Deno        deno.json
│ Bun         package.json

◇ Starter
│ Minimal     one page
│ App         layouts, status pages
│ Docs        MDX docs routes
│ Full-stack  app plus Nitro api/ and middleware/

◇ Install dependencies?
│ Yes

◇ Initialize git?
│ Yes

◇ Created my-app

Next:
  cd my-app
  pnpm dev
```

If the user does not pass a project name, the first prompt should ask for one.

```txt
$ pnpm create resumable

create-resumable

◇ Project name
│ my-app

◇ Project format
│ Node        package.json
│ Deno        deno.json
│ Bun         package.json

◇ Starter
│ Minimal     one page
│ App         layouts, status pages
│ Docs        MDX docs routes
│ Full-stack  app plus Nitro api/ and middleware/

◇ Install dependencies?
│ Yes

◇ Initialize git?
│ Yes

◇ Created my-app

Next:
  cd my-app
  pnpm dev
```

Project name rules:

- If a positional target directory is provided, use it and skip the prompt.
- If no positional target is provided, prompt for `Project name`.
- The project name cannot be empty.
- Invalid path characters should fail with a direct error.
- The generated package name should be derived from the project directory when
  needed.
- If the target directory exists and is non-empty, the CLI should stop unless
  the user explicitly confirms or passes `--force`.

## Project Format

`Project format` describes the generated project shape, not the deployment
target.

The prompt should show the human choice first and the generated config file as
muted supporting detail:

```txt
Node        package.json
Deno        deno.json
Bun         package.json
```

In the interactive UI, `package.json` and `deno.json` should be dimmer than the
runtime label. They explain what files will be generated; they are not part of
the runtime name.

Do not present this as:

```txt
Node / package.json
```

The slash makes the file detail feel like part of the product name. The primary
choice should be `Node`, `Bun`, or `Deno`; the generated file should be
secondary.

Default:

```txt
Node        package.json
```

In the local qwik-bundler package, we have proven native deno works as a fixture.

## Package Manager Inference

The CLI should not ask which package manager to use.

Infer the package manager from the command the user ran:

```txt
pnpm create resumable  -> pnpm
npm create resumable   -> npm
bun create resumable   -> bun
yarn create resumable  -> yarn
```

For `Node`, use the inferred package manager.

For `Bun`, use Bun.

For `Deno`, use Deno.

Project format wins over the invoking package manager. For example:

```sh
pnpm create resumable my-app
```

If the user chooses `Bun`, the generated project should be a Bun project and
dependency installation should use Bun.

## Starters

Use the word `Starter` in the prompt instead of `Template`.

Reason:

- `Starter` describes a code shape.
- `Template` can sound like a visual theme.
- Resumable starter choices should map directly to files and folders.
- Junior developers and AI agents should be able to infer what was generated
  from the starter name.

The default starter is `Minimal`.

Recommended starter list:

```txt
Minimal     one page
App         layouts, status pages
Docs        MDX docs routes
Full-stack  app plus Nitro api/ and middleware/
```

### Minimal

The smallest useful Resumable app. This should be the default.

```txt
my-app/
  pages/
    index.tsx
  public/
  vite.config.ts
  package.json
  tsconfig.json
```

Use this when the user wants to learn the core rule:

```txt
pages/ maps to routes.
```

### App

A normal application skeleton without server examples.

```txt
my-app/
  app.tsx
  pages/
    index.tsx
    about.tsx
    404.tsx
    500.tsx
  components/
    layouts/
      RootLayout.tsx
  public/
  vite.config.ts
  package.json
  tsconfig.json
```

Use this when the user wants the main Resumable UI conventions visible on day
one:

- `app.tsx` document shell.
- explicit layout component.
- root status pages.
- multiple page routes.

### Docs

A documentation-site skeleton using first-class MDX page routes and Composed
MDX for explicit page composition.

```txt
my-app/
  app.tsx
  pages/
    index.mdx
    docs/
      index.mdx
      [...slug].mdx
  components/
    docs/
      Sidebar.tsx
    layouts/
      DocsLayout.tsx
  public/
  vite.config.ts
  package.json
  tsconfig.json
```

Use this when the user wants content-oriented routes. The starter should not add
`content/`, `collections/`, `menu.md`, or a separate MDX Vite plugin.

Docs starter MDX pages should demonstrate that layouts are components, not
frontmatter metadata:

```mdx
import { Sidebar } from "../../components/docs/Sidebar";
import { DocsLayout } from "../../components/layouts/DocsLayout";

<DocsLayout section="guides">
  <Sidebar active="getting-started" />
  <main>
    <Content />
  </main>
</DocsLayout>

--- content

# Getting Started
```

`Docs` should ship only after the MDX fixture proves Satteri, Qwik v2, and the
Qwik optimizer work together.

### Full-stack

The App starter plus Nitro-native server files.

```txt
my-app/
  app.tsx
  pages/
    index.tsx
    about.tsx
    404.tsx
    500.tsx
  api/
    health.ts
  middleware/
    00.logger.ts
  components/
    layouts/
      RootLayout.tsx
  public/
  vite.config.ts
  package.json
  tsconfig.json
```

Use this when the user wants the full framework boundary visible:

```txt
pages/      -> Resumable UI routes
api/        -> Nitro API routes
middleware/ -> Nitro request pipeline
```

Do not call this starter `API`. `API` sounds like an API-only project and hides
the fact that the generated app is still a Resumable UI app with Nitro server
files.

### Data

Do not show `Data` as a default starter choice until `query$`, `action$`,
`schema`, native typed forms, and the SPA/SSR transport protocol are
implemented.

When the data layer is ready, prefer making data examples part of the
`Full-stack` starter or a dedicated example app rather than adding another
default prompt option.

## Default Starter

The default generated app should be intentionally small. `Minimal` is the
default because it teaches the core Resumable routing model before introducing
app shell, layouts, status pages, MDX, or Nitro server files.

`app.tsx` should not be required in the default starter. It should be added by
larger starters or by users when they need document-shell customization.

The generated `vite.config.ts` should teach the framework boundary:

```ts
import { defineConfig } from "vite-plus";
import { qwik } from "qwik-bundler/vite";
import { resumable } from "@resumable.dev/core/vite";

export default defineConfig({
  plugins: [qwik(), resumable()]
});
```

The CLI must not add `nitro()` to the generated Vite plugin list. Nitro's Vite
plugin wiring belongs inside `resumable()`.

Every starter should include Vite+. Generated scripts should use the local
`vp` command:

```json
{
  "scripts": {
    "dev": "vp dev",
    "build": "vp build",
    "preview": "vp preview",
    "check": "vp check",
    "format": "vp fmt",
    "test": "vp test"
  }
}
```

## Non-Interactive Flow

`--yes` should be deterministic and should not prompt.

```sh
pnpm create resumable my-app --yes
```

Equivalent default choices:

```txt
project name: from positional argument
project format: Node
starter: Minimal
install dependencies: Yes
initialize git: Yes
package manager: inferred from invoking command
```

Explicit examples:

```sh
pnpm create resumable my-app --starter full-stack
pnpm create resumable docs-site --starter docs --format node
bun create resumable my-app --format bun
pnpm create resumable deno-app --format deno --starter minimal
```

## Deployment Target

The default create flow should not ask for a deployment target.

Deployment and runtime output belong in native Nitro config:

```ts
import { defineConfig } from "vite-plus";
import { qwik } from "qwik-bundler/vite";
import { resumable } from "@resumable.dev/core/vite";

export default defineConfig({
  plugins: [qwik(), resumable()],
  nitro: {
    preset: "cloudflare"
  }
});
```

This keeps the create flow focused on files that are generated immediately.
Users can choose deployment targets later by editing `vite.config.ts`.

## Acceptance Criteria

`pnpm create resumable my-app --yes` creates a working app.

The generated app:

- Uses `@qwik.dev/core`, not `@builder.io/qwik`.
- Uses explicit `qwik()` in `vite.config.ts`.
- Uses `resumable()` in `vite.config.ts`.
- Does not call `nitro()` in `vite.config.ts`.
- Can run `pnpm dev`.
- Can run `pnpm build`.
- Has a visible `pages/index.tsx`.
- Has no `resumable.config.ts`.
- Has no `nitro.config.ts`.
- Has no `src/pages/`.
- Has no `pages/api/`.

The CLI:

- Prompts for project name only when no positional target is passed.
- Does not ask for package manager.
- Infers the package manager from the invoking command.
- Shows project format choices as `Node`, `Bun`, and `Deno` with the generated
  config file as secondary detail.
- Does not ask for deployment target in the default flow.
- Shows Deno only after fixtures prove the full path.

## Open Questions

- Should `Bun` be available in v0, or wait for a Bun fixture?
- Should `Deno` be visible in v0, or hidden until fully proven?
- Should `Docs` be hidden until ready, or visible as a starter choice?
- Should the default starter include `app.tsx`, or keep it out until users
  need document customization?
