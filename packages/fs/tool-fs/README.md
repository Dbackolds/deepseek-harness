---
description: "The model-facing read, read_image, write, and edit tools for users and maintainers composing or debugging filesystem access for agents."
kind: "package-reference"
---

# @deepseek-ai/dsh-tool-fs

English | [中文](README.zh.md)

## Summary

`dsh-tool-fs` provides the model-facing filesystem tools — `read`, `read_image`, `write`, and `edit` — and their executor. With them the model reads files with line numbers, creates or replaces them atomically, and applies targeted literal edits; results are capped and failures carry stable codes with recovery instructions, all backed by a mounted `ctx.fs` backend. The read-before-edit policy lives in a separate plugin (`dsh-fs-observation-policy`), so omitting it yields unconditional, still-atomic mutations. `read_image` appears while a durable attachment store is mounted and refuses execution unless the routed model declares image input. Choose this package when the model should read, create, replace, or edit UTF-8 text files; discovery (`glob`/`grep`) is a sibling package.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Mount the tools after a `ctx.fs` backend and, for read-before-write/edit behavior, the policy plugin. The model then gets line-numbered reads, atomic writes and edits, and — with an attachment store mounted — image reads; every result is capped, and failures carry stable codes with recovery instructions.

### Minimal composition

A backend, the policy plugin, then the tools; the attachment store is optional and enables `read_image`.

```yaml
- name: '@deepseek-ai/dsh-fs-local'
- name: '@deepseek-ai/dsh-fs-observation-policy'
- name: '@deepseek-ai/dsh-tool-fs'
The **model-facing filesystem tools** — `read`, `read_image`, `read_video`, `write`, `edit` — and their **executor**. This is the consumer layer of the filesystem stack: it owns tool names, JSON schemas, argument validation, prompt sections, **read windowing**, and result formatting. It reads/writes/edits through the `ctx.fs` provider contract ([`@deepseek-ai/dsh-fs`](../fs)) **directly**. The freshness/observation policy is contributed by a separate plugin ([`@deepseek-ai/dsh-fs-observation-policy`](../fs-observation-policy)) through the `fs/*` event gate; the tool is not method-coupled to it. Under a confining provider, the shared sandbox-policy service is required for per-session execution and the tool exposes escalation for filesystem mutations.
```ts ignore-check
// Default deployment: a ctx.fs provider, the policy plugin, then the tools.
await ctx.plugin(LocalFileSystem, { cwd: process.cwd() }) // @deepseek-ai/dsh-fs-local
await ctx.plugin(FsPolicy)                             // @deepseek-ai/dsh-fs-observation-policy (policy gate)
await ctx.plugin(LocalAttachmentStore, { dshHome })       // optional — enables durable read_image/read_video results
await ctx.plugin(ToolFs)                                  // this package — read/write/edit, plus read_image/read_video with attachments
```

The policy plugin is optional: without it the tools run against the bare provider (unconditional write, overwrite, and edit with no observed-state). A deployment that loads these tools is expected to also load it, so the behavior is read-before-write/edit. `read_image` registers only while a durable `ctx.attachments` service is mounted; execution additionally refuses on a route whose exact model does not declare image input, so a text route's durable history stays free of image blocks.

### The tools

| Tool | Arguments | Behavior |
|---|---|---|
| `read` | `file_path`, `offset?`, `limit?` | Line-numbered UTF-8 content with a pagination footer; `offset` is 1-based and `limit` defaults to and caps at the configured `readLimit` |
| `read_image` | `file_path` | Reads and persists a PNG/JPEG/WebP/GIF source; an extension-less path (normalized attachment object paths included) is identified from its file signature; normalization can downscale it before the next model request, so the model need not create a thumbnail first |
| `write` | `file_path`, `content` | Creates or fully replaces a file; with the policy plugin, overwriting requires a prior `read` at the unchanged version, creating does not |
| `edit` | `file_path`, `old_string`, `new_string`, `replace_all?` | Literal replacement requiring a unique match unless `replace_all` is true; with the policy plugin, requires a prior `read` and an unchanged file |

Field names are snake_case to match Claude Code and existing harness tool schemas. Successes return compact envelopes — a read window, an image reference, or a `Created file`/`Updated file` confirmation — and `write`/`edit` derive replayable diff-card metadata for UI presentation.
`read_image` and `read_video` register only while a durable `ctx.attachments` service is mounted. Execution additionally requires the exact routed model to declare `image` (respectively `video`) input, resolved through `ctx.llm.resolveModelInfo` from the session's latest request header and then from agent options.

### Configuration

All keys are optional; the defaults are the shipped read caps.

| Key | Default | Meaning |
|---|---|---|
| `readLimit` | `2000` | Default and maximum lines returned by one `read` call |
| `readMaxLineLength` | `2000` | Characters kept per line before truncation |
| `readMaxBytes` | `51200` | Byte cap on one `read` call's selected lines; overflow ends the window with a capped footer |
| `readStreamMinSize` | `10485760` | Files at or above this size (or of unknown size) stream instead of loading whole into memory |

The generated [configuration catalog](../../../docs/config-catalog.md#deepseek-aidsh-tool-fs) is the exhaustive source for every accepted field and its JSDoc.

### Policy and sandbox behavior

Path authorization for `read` and `read_image` belongs entirely to `ctx.fs`; media-type declarations and file signatures only decide whether `read_image` accepts the bytes returned by that backend.

With the policy plugin mounted, `write` and `edit` obtain their guard from the `fs/*` intent slots, so an unread target or a stale observation fails with `FS_NOT_OBSERVED` or `FS_STALE_VERSION` and a recovery instruction. Under a confining backend (`fs-sandbox`), `write`/`edit` additionally advertise `sandbox_permissions` and `justification`; a denied mutation returns the `[sandbox: file access denied under <mode> mode]` marker with the same-turn escalation hint, and an approved retry may stamp a strictly wider mode for that one call.
| Tool | Arguments | Behavior |
|---|---|---|
| `read` | `file_path`, `offset?`, `limit?` | Line-numbered UTF-8 content with a pagination footer. `offset` is 1-based; `limit` defaults to and caps at the configured `readLimit` (2000). |
| `read_image` | `file_path` | Reads a PNG/JPEG/WebP/GIF file through the bounded byte seam, persists it through `ctx.attachments.saveImage`, and returns an image block beside a small metadata envelope. Harness validates and downscales large supported images before the next model request, so the model can read the source directly without first creating a thumbnail. It succeeds only when the exact routed model declares image input. |
| `read_video` | `file_path` | Reads an MP4/MKV/MOV file through the bounded byte seam, persists it through `ctx.attachments.saveVideo`, and returns a video block beside a small metadata envelope. The harness validates the container before the next model request — no transcode or probing — so the model can read the source directly. It succeeds only when the exact routed model declares video input. |
| `write` | `file_path`, `content` | Create or fully replace a file. With the policy plugin: overwriting an existing file requires a prior `read` at the unchanged version; creating a new file does not. Without it: unconditional. |
| `edit` | `file_path`, non-empty `old_string`, `new_string`, `replace_all?` | Literal replacement; unique match required unless `replace_all` is true. With the policy plugin: requires a prior `read` (any window) and the file unchanged since. Without it: unconditional. |

### Failures and recovery

Failures are normalized as `Error: <message>` with a structured code preserved for callers. Stable messages include `file_path must be a non-empty string`, `limit must be less than or equal to <max>`, `cannot read "<path>": not found`, `cannot read "<path>": not a regular file`, and the image-route refusal `cannot read "<path>" as an image: model "<model>" does not declare image input; switch to an image-capable model to read images`. Guarded-mutation failures append their remedy: `FS_STALE_VERSION` gets `— re-read the file, then retry`, `FS_NOT_OBSERVED` gets `— read the file, then retry`. After the reread confirms absence, `edit` reports `FS_NOT_FOUND` instead of repeating a stale remedy, while `write` uses guarded creation.
Structured successes are `read` → `{ path, offset, lines: [{ number, text }], totalLines }`, `read_image` → `{ path, image: { attachmentId, mediaType, bytes, width, height, name?, originalDimensions?: { width, height } } }`, `read_video` → `{ path, video: { attachmentId, mediaType, bytes, name? } }`, `write` → `{ path, operation: 'create' | 'update', before: string | null, after }`, and `edit` → `{ path, before, after }`. `originalDimensions` appears only when normalization downscaled the submitted raster and records its orientation-applied input size. Native renderers preserve the line-numbered read and mutation acknowledgements below. `write`/`edit` derive replayable diff-card metadata, and `read` derives a replayable read-card window `{ path, offset, lines, totalLines, lang? }`; execution-local structured values are not added to `tool/result`, while image and video renderers emit the durable attachment blocks that the result logs.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>
- **read** — one `ctx.fs.stat` (type + size routing + version), then `readText`/`streamText`, then builds the line window, then emits `fs/observed` with a plain `ctx.emit`. (1 stat.)
- **read_image** — validates the argument, extension, attachment availability, deployment media types, and the image-capable route before any I/O; then one `ctx.fs.stat` (recording an `absent` observation for a missing target, like `read`), a bounded `ctx.fs.readBytes` capped at the smaller of `imageLimits.maxImageBytes` and `imageLimits.maxMessageImageBytes` (the result is one message carrying one image), `attachments.saveImage` (content-addressed, so the image block references a durably committed object by the time `tool/result` is appended), and finally `fs/observed`. (1 stat.)
- **read_video** — the same executor shape for video: argument, extension, attachment availability, deployment media types, and the video-capable route gate before any I/O; then one `ctx.fs.stat` (recording an `absent` observation for a missing target), a bounded `ctx.fs.readBytes` capped at the smaller of `videoLimits.maxVideoBytes` and `videoLimits.maxMessageVideoBytes` (the result is one message carrying one video), `attachments.saveVideo` (content-addressed), and finally `fs/observed`. (1 stat.)
- **write** — `ctx.waterfall('fs/write-intent', target, exec, () => undefined)` for the optional guard, then `ctx.fs.writeText(target, content, intent)`, then `fs/observed`. (0 stat.)
- **edit** — `ctx.waterfall('fs/edit-intent', target, exec, () => undefined)` for the optional guard, then `ctx.fs.editText(target, edit, intent)`, then `fs/observed`. (0 stat.)

This section explains the design decisions behind the tool suite and points at the code that realizes them; the observable behavior is fully covered in [Use this package](#use-this-package).

### Design concept

The tools are the executor; policy is an event gate. The tools inject no policy service and inspect no cache — each mutation asks the single intent slot for its guard through `ctx.waterfall`, and each operation emits `fs/observed` only after it succeeded. Reads do exactly one provider `stat` (type and size routing plus the observed version); mutations do none, because the guard comes from the intent slot and the provider re-checks under its lock.

### Source map
`fs/observed` fires AFTER the read/read_image/read_video/write/edit already succeeded, via a plain `ctx.emit`. A listener is contractually a synchronous, side-effect-only recorder (`@deepseek-ai/dsh-fs-observation-policy`'s is a `WeakMap.set`); the tool does not guard the emit, so a listener that throws would surface as the tool's `isError` result — async or fallible observation does not belong on this event.

| File | Role |
|---|---|
| [`src/index.ts`](src/index.ts) | Plugin entry: `Config`, tool composition, `read_image` attachments gate |
| [`src/read.ts`](src/read.ts) | `read` executor: one stat, streaming decision, window build, observation |
| [`src/read-image.ts`](src/read-image.ts) | `read_image` executor: route and media-type gates, bounded bytes, attachment save |
| [`src/write.ts`](src/write.ts) | `write` executor: intent waterfall, atomic write, observation |
| [`src/edit.ts`](src/edit.ts) | `edit` executor: intent waterfall, literal edit, observation |
| [`src/read-render.ts`](src/read-render.ts) | Cordis-free windowing and envelope formatting |
| [`src/sandbox.ts`](src/sandbox.ts) | Escalation API shared by `write`/`edit`: policy resolution and denial-marker mapping |
| [`src/error.ts`](src/error.ts) | Model-facing remedy appended to `FS_STALE_VERSION` and `FS_NOT_OBSERVED` |

### Per-tool flow
The package root exports only the Cordis plugin contract (`name`, `inject`, `Config`, and `apply`). Read rendering (line windowing + output formatting) lives in `src/read-render.ts` (Cordis-free, independently unit-tested); `src/read.ts`/`read-image.ts`/`read-video.ts`/`write.ts`/`edit.ts` are the tool executors and `src/index.ts` composes them.

All four tools share one flow shape: resolve the path with the calling session's cwd, run the applicable gate, perform exactly one provider operation, and emit `fs/observed` only after success. `read` and `read_image` pay one `stat` for type and size routing; `write` and `edit` pay none because their guard comes from the intent slot, and provider failures surface as typed `FsError` results. The per-tool executors live in `src/read.ts`, `src/read-image.ts`, `src/write.ts`, and `src/edit.ts`.

### Observation and concurrency

`fs/observed` fires after the operation succeeded via a plain `ctx.emit`; a listener is contractually a synchronous, side-effect-only recorder, so async or fallible observation does not belong on this event. `read` opts into concurrent scheduling because its only mutation is the synchronous version recorder; recorder races fail closed when a later `write` or `edit` re-checks the version under its target lock, and both mutation tools remain exclusive.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

Read these pages when the package-level contract is not enough. They move from the tools to the contract, backends, and policy they compose with.

- [Filesystem subsystem](../../../docs/subsystems/filesystem.md) — exhaustive provider contract, policy events, and error taxonomy.
- [dsh-fs](../fs/README.md) — the `ctx.fs` contract these tools consume.
- [fs-local](../fs-local/README.md) — the host-filesystem backend these tools run against.
- [fs-sandbox](../fs-sandbox/README.md) — the sandbox-enforcing backend that adds the escalation fields.
- [fs-observation-policy](../fs-observation-policy/README.md) — the policy plugin that guards mutations through the `fs/*` events.
- [Generated tool catalog](../../../docs/tool-catalog.md#deepseek-aidsh-tool-fs) — the exhaustive schemas this package registers.

-----

<a id="model-experience"></a>
## Model Experience

### System prompt

#### What the model sees

Every request in this plugin's registration scope receives the independently registered read, write, and edit guidance below. Scoped tool restrictions can hide schemas without removing these sections.

##### Read guidance

```markdown
Use the read tool — not shell commands like cat — to inspect text files. Results include line numbers. Use offset and limit to continue reading large files.
```

##### Write guidance

```markdown
Use the write tool to create files or completely replace file contents. Existing files are overwritten, so read an existing file first (the default fs-observation-policy requires it) and prefer edit for targeted changes.
```

##### Edit guidance

```markdown
Use the edit tool for targeted changes to existing UTF-8 text files. It replaces literal old_string with new_string; by default old_string must appear exactly once. If old_string appears multiple times, provide a more specific old_string or set replace_all to true. Read the file first (the default fs-observation-policy requires it), unless you just created or edited it in this session.
```

#### Token effect

Fixed guidance cost per request while the plugin is active, even when a restriction hides one or more tools.

#### KV Cache effect

Prefix-stable while the plugin scope and guidance text are unchanged. Tool restrictions do not remove this section, but plugin activation or disposal may invalidate reuse from it.

### Tool schemas

#### What the model sees

The model sees the generated [`read`, `read_image`, `read_video`, `write`, and `edit` schemas](../../../docs/tool-catalog.md#deepseek-aidsh-tool-fs), with snake_case arguments. The media tools appear only while a durable attachment store is mounted; their schemas are route-independent, and the strict gates refuse at execution. Scoped tool restrictions can remove any definition for one agent.

#### Token effect

Fixed schema cost on every request in that tool view.

#### KV Cache effect

Prefix-stable while the visible tool definitions and order are unchanged. Registration lifecycle or scoped restrictions may invalidate reuse from the first changed schema token.

### Read result

#### What the model sees

A successful read is exactly `<path><displayPath></path>`, newline, `<type>file</type>`, newline, `<content>`, numbered lines as `<lineNumber>: <text>`, a blank line, one footer, and `</content>`. The footer is exactly `(Output capped. Showing lines <start>-<end>. Use offset=<next> to continue.)`, `(Showing lines <start>-<end> of <total>. Use offset=<next> to continue.)`, or `(End of file - total <total> lines)`. A long line ends exactly `... (line truncated to <max> chars)`. A missing read still returns `FS_NOT_FOUND`, but it records confirmed absence for the calling session; after an externally deleted file is re-read, a retried `write` can safely recreate it through the provider's no-replace guard.

#### Token effect

Read output is capped by `readLimit`, `readMaxLineLength`, and `readMaxBytes`; the retained call and result are resent until compaction.

#### KV Cache effect

Append-only; newly visible content follows the reusable request prefix and does not invalidate existing KV-cache entries.

### Image read result

#### What the model sees

A successful `read_image` returns `<path><displayPath></path>`, `<type>image</type>`, and a `<content>` envelope naming the media type, normalized dimensions, and byte size, followed by the image itself as a native image block. The result is logged with its durable reference before the next model request.

#### Token effect

The image is billed on every later request until compaction. Each call is independently bounded by the attachment store's `maxImageBytes`/`maxImagePixels` and optional `maxImageDimension`; repeated successful calls accumulate history, and content addressing deduplicates only the stored bytes, not the per-request token cost.

#### KV Cache effect

Append-only; newly visible content follows the reusable request prefix and does not invalidate existing KV-cache entries.

### Video read result

#### What the model sees

A successful `read_video` returns `<path><displayPath></path>`, `<type>video</type>`, and a `<content>` envelope naming the container media type and byte size, followed by the video itself as a native video block. The result is logged with its durable reference before the next model request.

#### Token effect

The video is billed on every later request until compaction, after base64 expansion in the request pipeline. Each call is bounded by the attachment store's `maxVideoBytes`/`maxVideosPerMessage`; repeated successful calls accumulate history, and content addressing deduplicates only the stored bytes, not the per-request token cost.

#### KV Cache effect

Append-only; newly visible content follows the reusable request prefix and does not invalidate existing KV-cache entries.

### Write and edit results

#### What the model sees

Write returns the exact five-line envelope `<path><displayPath></path>`, `<type>file</type>`, `<content>`, `Created file` or `Updated file`, then `</content>`. Edit returns exactly `The file <displayPath> has been updated successfully.` or, for `replace_all`, `The file <displayPath> has been updated. All occurrences were successfully replaced.` The full write or replacement text remains in the assistant tool-call arguments.

#### Token effect

Success text is small, but large mutation arguments and any result are resent until compaction.

#### KV Cache effect

Append-only; newly visible content follows the reusable request prefix and does not invalidate existing KV-cache entries.

### Tool errors

#### What the model sees

Failures are normalized as `Error: <message>` with a structured code preserved for callers. Stable messages include `file_path must be a non-empty string`, `limit must be less than or equal to <max>`, `cannot read "<path>": not found`, `cannot read "<path>": not a regular file`, and the image-route refusal `cannot read "<path>" as an image: model "<model>" does not declare image input; switch to an image-capable model to read images`. Guarded-mutation failures append their remedy: `FS_STALE_VERSION` gets `— re-read the file, then retry`, `FS_NOT_OBSERVED` gets `— read the file, then retry`. After the reread confirms absence, `edit` reports `FS_NOT_FOUND` instead of repeating a stale remedy, while `write` uses guarded creation.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

This section explains the design decisions behind the tool suite and points at the code that realizes them; the observable behavior is fully covered in [Use this package](#use-this-package).

### Design concept

The tools are the executor; policy is an event gate. The tools inject no policy service and inspect no cache — each mutation asks the single intent slot for its guard through `ctx.waterfall`, and each operation emits `fs/observed` only after it succeeded. Reads do exactly one provider `stat` (type and size routing plus the observed version); mutations do none, because the guard comes from the intent slot and the provider re-checks under its lock.

### Source map

| File | Role |
|---|---|
| [`src/index.ts`](src/index.ts) | Plugin entry: `Config`, tool composition, `read_image` attachments gate |
| [`src/read.ts`](src/read.ts) | `read` executor: one stat, streaming decision, window build, observation |
| [`src/read-image.ts`](src/read-image.ts) | `read_image` executor: route and media-type gates, bounded bytes, attachment save |
| [`src/write.ts`](src/write.ts) | `write` executor: intent waterfall, atomic write, observation |
| [`src/edit.ts`](src/edit.ts) | `edit` executor: intent waterfall, literal edit, observation |
| [`src/read-render.ts`](src/read-render.ts) | Cordis-free windowing and envelope formatting |
| [`src/sandbox.ts`](src/sandbox.ts) | Escalation API shared by `write`/`edit`: policy resolution and denial-marker mapping |
| [`src/error.ts`](src/error.ts) | Model-facing remedy appended to `FS_STALE_VERSION` and `FS_NOT_OBSERVED` |

### Per-tool flow

All four tools share one flow shape: resolve the path with the calling session's cwd, run the applicable gate, perform exactly one provider operation, and emit `fs/observed` only after success. `read` and `read_image` pay one `stat` for type and size routing; `write` and `edit` pay none because their guard comes from the intent slot, and provider failures surface as typed `FsError` results. The per-tool executors live in `src/read.ts`, `src/read-image.ts`, `src/write.ts`, and `src/edit.ts`.

### Observation and concurrency

`fs/observed` fires after the operation succeeded via a plain `ctx.emit`; a listener is contractually a synchronous, side-effect-only recorder, so async or fallible observation does not belong on this event. `read` opts into concurrent scheduling because its only mutation is the synchronous version recorder; recorder races fail closed when a later `write` or `edit` re-checks the version under its target lock, and both mutation tools remain exclusive.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

Read these pages when the package-level contract is not enough. They move from the tools to the contract, backends, and policy they compose with.

- [Filesystem subsystem](../../../docs/subsystems/filesystem.md) — exhaustive provider contract, policy events, and error taxonomy.
- [dsh-fs](../fs/README.md) — the `ctx.fs` contract these tools consume.
- [fs-local](../fs-local/README.md) — the host-filesystem backend these tools run against.
- [fs-sandbox](../fs-sandbox/README.md) — the sandbox-enforcing backend that adds the escalation fields.
- [fs-observation-policy](../fs-observation-policy/README.md) — the policy plugin that guards mutations through the `fs/*` events.
- [Generated tool catalog](../../../docs/tool-catalog.md#deepseek-aidsh-tool-fs) — the exhaustive schemas this package registers.

-----

<a id="model-experience"></a>
## Model Experience

### System prompt

#### What the model sees

Every request in this plugin's registration scope receives the independently registered read, write, and edit guidance below. Scoped tool restrictions can hide schemas without removing these sections.

##### Read guidance

```markdown
Use the read tool — not shell commands like cat — to inspect text files. Results include line numbers. Use offset and limit to continue reading large files.
```

##### Write guidance

```markdown
Use the write tool to create files or completely replace file contents. Existing files are overwritten, so read an existing file first (the default fs-observation-policy requires it) and prefer edit for targeted changes.
```

##### Edit guidance

```markdown
Use the edit tool for targeted changes to existing UTF-8 text files. It replaces literal old_string with new_string; by default old_string must appear exactly once. If old_string appears multiple times, provide a more specific old_string or set replace_all to true. Read the file first (the default fs-observation-policy requires it), unless you just created or edited it in this session.
```

#### Token effect

Only a failing call adds these retained tokens.

#### KV Cache effect

Append-only; newly visible content follows the reusable request prefix and does not invalidate existing KV-cache entries.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>


These limits define when the tool suite is a poor fit or needs special operational care. They are current package constraints, not a general filesystem comparison or a task backlog.

- **No model-facing directory listing ships** — `ctx.fs.listDir` serves provider code such as skill discovery, while the sibling `dsh-tool-fs-search` package supplies ripgrep-backed `glob` and `grep` rather than extending the filesystem seam.
- **No model-facing directory listing ships** — `ctx.fs.listDir` serves provider code such as skill discovery, while the sibling `dsh-tool-fs-search` package supplies ripgrep-backed `glob` and `grep` rather than extending the filesystem seam.
- **`read` handles UTF-8 text files only** — images use the separate `read_image` tool, videos the `read_video` tool; PDF and audio remain deferred. A directory target is `FS_NOT_REGULAR_FILE`.
- **Extension-declared media type** — an extension selects the declared type and the attachment store's magic-byte validation stays authoritative; a correctly formatted image or video under a wrong extension is refused with the rename remedy rather than sniffed. Only a path with no extension is identified from its file signature.
- **Object paths re-enter source admission** — `read_image` on a normalized attachment object re-admits its bytes as a new source, so a deployment whose `maxImageBytes`/`maxMessageImageBytes` sit below the normalized-image byte budget can refuse an object path that `ctx.attachments.readImage` still serves; shipped defaults keep the normalized budget (4 MiB) far under the source caps (20 MiB).
- **No inline image preview on the tool-result card** — UI surfaces render the image result generically (the durable reference, not pixels); inline rendering is deferred to the UI packages.
- **No attachment-region tool** — an agent may crop an image through another available tool when it has a filesystem path; a pasted or dragged image without a path cannot be re-read at higher resolution.
- **No timeout surface** — `read`/`write`/`edit` take no timeout argument and declare no timeout budget; cancellation rides `exec.signal` only ([provider rationale](../README.md)).

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
