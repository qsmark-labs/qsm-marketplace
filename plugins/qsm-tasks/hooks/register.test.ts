import { expect, test } from "claude-code/testing";

test(
  "the loaded tasks noun runs the CLI doctor and returns its data",
  {
    plugins: [
      {
        name: "tasks-consumer",
        register(on) {
          on("command.run", async ($) => ({ text: JSON.stringify(await $.tasks.doctor()) }));
        },
      },
    ],
  },
  async ($, on) => {
    const data = { plugin: "qsm-tasks", tools: [] };
    on("process.run", (_$, event) => {
      expect(event.argv).toEqual(["qsm-tasks", "doctor", "--json"]);
      return {
        value: {
          exitCode: 0,
          stdout: JSON.stringify({ code: "ok", exit: 0, data }),
          stderr: "",
          isStdoutTruncated: false,
          isStderrTruncated: false,
        },
      };
    });

    const result = await $.command.run({
      command: "test-tasks-doctor",
      args: "",
      origin: { kind: "composer" },
      presentation: { isFullscreen: false, columns: 80 },
    });
    expect(result.text).toBe(JSON.stringify(data));
  },
);
