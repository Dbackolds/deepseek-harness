import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { LOADER_SMOKE_TEST_TIMEOUT_MS, runLoaderSmoke } from '@deepseek-ai/dsh-loader-smoke'

const binScript = fileURLToPath(new URL('./fixtures/dsh-session-control/snapshot.ts', import.meta.url))
const configPath = fileURLToPath(new URL('./fixtures/dsh-session-control/cordis.yml', import.meta.url))
const tsconfigPath = fileURLToPath(new URL('../../../tsconfig.json', import.meta.url))
const skillAssetsPath = fileURLToPath(new URL('../../../packages/skill/skill-session-control/assets/', import.meta.url))

describe('dsh session-control assembled snapshot', () => {
  it('advertises and loads the bundled session-control skill through the shipped app', async () => {
    const assembled = await runLoaderSmoke({
      label: 'dsh session-control skill snapshot',
      tempDirPrefix: 'headless-snapshot-dsh-session-control-',
      binScript,
      libBinScript: binScript,
      configPath,
      tsconfigPath,
    })
    const snapshot = JSON.parse(
      assembled.stdout.replaceAll(skillAssetsPath, '{{skillAssetsPath}}'),
    ) as unknown

    expect(assembled.stderr).toBe('')
    expect(snapshot).toMatchInlineSnapshot(`
      {
        "catalog": [
          {
            "text": "<system-reminder>
      A skill is a reusable set of task-specific instructions. The following skills are available in this session:

      <available_skills>
      - \`dsh-session-control\`: Search every session, read whether it is running, stop a turn, or send a later message to another conversation. Use when the user asks about other sessions, wants work coordinated across conversations, or names a session to interrupt or continue.
      </available_skills>

      If the user names a skill, or the task clearly matches a skill's description, call the \`skill\` tool with the exact skill name before taking task actions. Load all applicable skills, then follow their full instructions. This catalog contains summaries only; do not infer or follow a skill's instructions until it has been loaded.
      A user may also invoke a skill directly; its <skill_content> block then appears in this conversation. Follow it, and do not call the \`skill\` tool again for that skill.
      </system-reminder>",
            "type": "text",
          },
        ],
        "result": {
          "content": [
            {
              "text": "<skill_content name="dsh-session-control">
      <skill_resources>
      Base directory for this skill: {{skillAssetsPath}}
      Resolve relative paths mentioned by this skill against the base directory before using them. Load referenced resources only as needed.
      </skill_resources>

      <skill_instructions>
      # Session Control

      Use the \`session_control_*\` tools to find any logical session, read whether it is running, stop its current turn, or deliver a later message.

      These tools address ordinary sessions, forks, automation fires, and live subagent children. They are not limited to children you started in this turn.

      ## Tools

      - \`session_control_search\` — list sessions with live status. Optional \`query\` matches session id, working directory, or title. Optional \`limit\` caps the page.
      - \`session_control_stop\` — stop the current turn and keep queued inbox work. A known session with no live driver is an accepted no-op.
      - \`session_control_send\` — deliver one non-empty text message. \`mode\` is \`queue\` (next turn, default) or \`steer\` (nearest step).

      ## Status

      | activity | meaning |
      |---|---|
      | \`running\` | A live Agent has an active driver. |
      | \`idle\` | A live Agent is attached between turns. |
      | \`ready\` | The session exists in storage or the live store and has no live Agent. |

      ## Workflow

      1. Call \`session_control_search\` when the user asks about another conversation, wants work coordinated across sessions, or you need an id you do not already have.
      2. Prefer an \`idle\` or \`running\` row for \`session_control_send\`. Use \`session_control_stop\` first when the user asked to interrupt that session.
      3. If a send fails because the session is not live, report that the session must be resumed in the UI or by its owner. Do not invent a resume tool.
      4. Do not use \`send_message\` or \`interrupt_agent\` for peer sessions. Those tools only address subagents you own.

      ## Rules

      - Load this skill before searching, stopping, or messaging another session.
      - Copy session ids from tool results. Do not guess ids.
      - Keep messages self-contained. The recipient does not see this conversation unless you include the needed context.
      - Stopping keeps queued work. Say so if the user asked to cancel everything.


      </skill_instructions>
      </skill_content>",
              "type": "text",
            },
          ],
          "isError": false,
          "value": {
            "content": "# Session Control

      Use the \`session_control_*\` tools to find any logical session, read whether it is running, stop its current turn, or deliver a later message.

      These tools address ordinary sessions, forks, automation fires, and live subagent children. They are not limited to children you started in this turn.

      ## Tools

      - \`session_control_search\` — list sessions with live status. Optional \`query\` matches session id, working directory, or title. Optional \`limit\` caps the page.
      - \`session_control_stop\` — stop the current turn and keep queued inbox work. A known session with no live driver is an accepted no-op.
      - \`session_control_send\` — deliver one non-empty text message. \`mode\` is \`queue\` (next turn, default) or \`steer\` (nearest step).

      ## Status

      | activity | meaning |
      |---|---|
      | \`running\` | A live Agent has an active driver. |
      | \`idle\` | A live Agent is attached between turns. |
      | \`ready\` | The session exists in storage or the live store and has no live Agent. |

      ## Workflow

      1. Call \`session_control_search\` when the user asks about another conversation, wants work coordinated across sessions, or you need an id you do not already have.
      2. Prefer an \`idle\` or \`running\` row for \`session_control_send\`. Use \`session_control_stop\` first when the user asked to interrupt that session.
      3. If a send fails because the session is not live, report that the session must be resumed in the UI or by its owner. Do not invent a resume tool.
      4. Do not use \`send_message\` or \`interrupt_agent\` for peer sessions. Those tools only address subagents you own.

      ## Rules

      - Load this skill before searching, stopping, or messaging another session.
      - Copy session ids from tool results. Do not guess ids.
      - Keep messages self-contained. The recipient does not see this conversation unless you include the needed context.
      - Stopping keeps queued work. Say so if the user asked to cancel everything.

      ",
            "name": "dsh-session-control",
            "provider": "dsh-session-control",
            "resourceBase": {
              "kind": "directory",
              "path": "{{skillAssetsPath}}",
            },
          },
        },
        "summary": {
          "description": "Search every session, read whether it is running, stop a turn, or send a later message to another conversation. Use when the user asks about other sessions, wants work coordinated across conversations, or names a session to interrupt or continue.",
          "invocation": {
            "modelInvocable": true,
            "userInvocable": true,
          },
          "name": "dsh-session-control",
          "provider": "dsh-session-control",
          "resourceBase": {
            "kind": "directory",
            "path": "{{skillAssetsPath}}",
          },
          "source": "bundled",
        },
        "tools": [
          "session_control_search",
          "session_control_send",
          "session_control_stop",
        ],
      }
    `)
  }, LOADER_SMOKE_TEST_TIMEOUT_MS)
})
