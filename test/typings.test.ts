/* eslint-disable vitest/expect-expect */
/**
 * checks if the typings are correct
 * run via 'npm run test:typings'
 */
import { spawn } from "child-process-promise";
import path from "path";
import { describe, expect, it } from "vitest";

describe("typings.test.ts", () => {
  const mainPath = path.join(__dirname, "../src");
  const codeBase = `
        import { 
            BroadcastChannel
        } from '${mainPath}';
        declare type Message = {
            foo: string;
        };
    `;

  const transpileCode = async (code: string) => {
    const stdout: string[] = [];
    const stderr: string[] = [];

    const tsConfig = {
      module: "commonjs",
      target: "es6",
      strict: true,
      isolatedModules: false,
      noUnusedLocals: false,
    };

    const promise = spawn("ts-node", ["--compiler-options", JSON.stringify(tsConfig), "-e", codeBase + "\n" + code]);
    const childProcess = promise.childProcess;

    childProcess.stdout.on("data", (data: Buffer) => {
      stdout.push(data.toString());
    });
    childProcess.stderr.on("data", (data: Buffer) => {
      stderr.push(data.toString());
    });

    try {
      await promise;
    } catch (err) {
      throw new Error(`could not run
                # Error: ${err}
                # Output: ${stdout}
                # ErrOut: ${stderr}
                `);
    }
  };

  describe("basic", () => {
    it("should sucess on basic test", async () => {
      // eslint-disable-next-line prettier/prettier
      await transpileCode("console.log(\"Hello, world!\")");
    });

    it("should fail on broken code", async () => {
      const brokenCode = `
                let x: string = 'foo';
                x = 1337;
            `;
      await expect(transpileCode(brokenCode)).rejects.toThrow();
    });
  });

  describe("non-typed channel", () => {
    it("should be ok to create post and recieve", async () => {
      const code = `
                (async() => {
                    const channel = new BroadcastChannel('foobar', { type: 'simulate' });
                    const emitted: any[] = [];
                    channel.onmessage = msg => emitted.push(msg);
                    await channel.postMessage({foo: 'bar'});
                    channel.close();
                })();
            `;
      await transpileCode(code);
    });

    it("should not allow to set wrong onmessage", async () => {
      const code = `
                (async() => {
                    const channel = new BroadcastChannel('foobar');

                    const emitted: any[] = [];
                    channel.onmessage = {};
                    await channel.postMessage({foo: 'bar'});
                    channel.close();
                })();
            `;
      await expect(transpileCode(code)).rejects.toThrow();
    });
  });

  describe("typed channel", () => {
    it("should be ok to create and post", async () => {
      const code = `
                (async() => {
                    const channel = new BroadcastChannel<Message>('foobar', { type: 'simulate' });
                    await channel.postMessage({foo: 'bar'});
                    channel.close();
                })();
            `;
      await transpileCode(code);
    });

    it("should be ok to recieve", async () => {
      const code = `
                (async() => {
                    const channel: BroadcastChannel<Message> = new BroadcastChannel('foobar', { type: 'simulate' });
                    const emitted: Message[] = [];
                    channel.onmessage = msg => {
                        const f: string = msg.foo;
                        emitted.push(msg);
                    };
                    channel.close();
                })();
            `;
      await transpileCode(code);
    });

    it("should not allow to post wrong message", async () => {
      const code = `
          (async() => {
              const channel = new BroadcastChannel<Message>('foobar');
              await channel.postMessage({x: 42});
              channel.close();
          })();
      `;
      await expect(transpileCode(code)).rejects.toThrow();
    });
  });
});
