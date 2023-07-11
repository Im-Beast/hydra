import { errors, HTTPMethod, Hydra } from "../mod.ts";
import { assertEquals, move, walk } from "./deps.ts";

const methods: HTTPMethod[] = [
  "GET",
  "PUT",
  "POST",
  "HEAD",
  "PATCH",
  "DELETE",
  "OPTIONS",
];

async function fileResponse(path: string): Promise<Response> {
  const file = await Deno.open(path);
  return new Response(file.readable);
}

async function assertResponseEquals(app: Hydra, url: string, method: string, expected: Response): Promise<void> {
  const actual = await app.resolve(new Request(new URL(url), { method }));

  const contentType = actual.headers.get("Content-Type");
  const isPlainText = !contentType || contentType.includes("text");
  const isJson = contentType && contentType.includes("json");

  const actualContents = isPlainText
    ? await actual.text()
    : isJson
    ? await actual.json()
    : new Uint8Array(await actual.arrayBuffer());
  const expectedContents = isPlainText
    ? await expected.text()
    : isJson
    ? await expected.json()
    : new Uint8Array(await expected.arrayBuffer());

  assertEquals(actualContents, expectedContents, "contents");
  assertEquals(actual.ok, expected.ok, "ok");
  assertEquals(actual.status, expected.status, "status");
}

async function assertResponse404s(app: Hydra, url: string, method: string): Promise<void> {
  const actual = await app.resolve(new Request(new URL(url), { method }));

  assertEquals(await actual.text(), await errors.NotFound().text(), "contents");
  assertEquals(actual.ok, false, "ok");
  assertEquals(actual.status, 404, "status");
}

Deno.test("Hydra", async (t) => {
  for (const port of [8000, 8080, 8443]) {
    await t.step(`Port ${port}`, async (t) => {
      const abortContoller = new AbortController();

      const app = new Hydra("localhost", port, {
        signal: abortContoller.signal,
      });
      const server = app.serve();

      app.use("/middleware/*", async (_request, next, set) => {
        const response = await next();
        if (!response) return;

        if (response instanceof Response) {
          set(`(*) ${await response.text()}`);
        } else if (typeof response === "object") {
          set(`(*) ${response.message}`);
        } else {
          set(`(*) ${response}`);
        }
      });

      app.use("/middleware/string", async (_, next, set) => {
        const response = await next("json");
        if (!response) return;

        set(`(jsoned) ${response.data}`);
      });

      app.use("/middleware/string", async (_, next, set) => {
        const response = await next("response");
        if (!response) return;

        const promise = new Promise<string>((r) => {
          queueMicrotask(async () => {
            r(`(responded) ${await response.text()}`);
          });
        });

        set(promise);
      });

      app.use("/middleware/json", async (_, next, set) => {
        const response = await next("string");
        if (!response) return;

        set(`(stringed) ${response}`);
      });

      app.use("/middleware/json", async (_, next, set) => {
        const response = await next("response");
        if (!response) return;

        set({ message: `(responded) ${await response.text()}` });
      });

      app.use("/middleware/response", async (_, next, set) => {
        const response = await next("string");
        set(`(stringed) ${response}`);
      });

      app.use("/middleware/response", async (_, next, set) => {
        const response = await next("json");
        if (!response) return;

        set(`(jsoned) ${response.data}`);
      });

      for (const method of methods) {
        await t.step(method, async (t) => {
          const lowercaseMethod = method.toLowerCase() as Lowercase<HTTPMethod>;

          await t.step("/", async () => {
            app[lowercaseMethod]("/", () => `Hello using ${method}`);

            const STEP_URL = `http://127.0.0.1:${port}/`;
            await assertResponseEquals(app, STEP_URL, method, new Response(`Hello using ${method}`));
          });

          await t.step(`/${method}`, async () => {
            app[lowercaseMethod](`/${method}`, () => `Hello using ${method}`);

            const STEP_URL = `http://127.0.0.1:${port}/${method}`;
            await assertResponseEquals(app, STEP_URL, method, new Response(`Hello using ${method}`));
          });

          await t.step(`/book/:id(\\d+)`, async (t) => {
            app[lowercaseMethod](
              `/book/:id(\\d+)`,
              ({ groups }) => `You tried to get book ${groups.id} using ${method}`,
            );

            for (const group of [0, 1, 2, 3, 2023, Number.MAX_SAFE_INTEGER]) {
              await t.step(`/book/${group}`, async () => {
                const STEP_URL = `http://127.0.0.1:${port}/book/${group}`;
                await assertResponseEquals(
                  app,
                  STEP_URL,
                  method,
                  new Response(`You tried to get book ${group} using ${method}`),
                );
              });
            }

            await t.step("accepts only \\d+ as arguments", async (t) => {
              for (const group of ["Johhny", "", "undefined", "π", "-1", Number.MIN_SAFE_INTEGER]) {
                await t.step(`/book/${group} fails`, async () => {
                  const STEP_URL = `http://127.0.0.1:${port}/book/${group}`;
                  await assertResponse404s(app, STEP_URL, method);
                });
              }
            });
          });

          await t.step("respond with Response", async () => {
            app[lowercaseMethod]("/response", () => new Response(`Hello using ${method}`));

            const STEP_URL = `http://127.0.0.1:${port}/response`;
            await assertResponseEquals(app, STEP_URL, method, new Response(`Hello using ${method}`));
          });

          await t.step("respond with string", async () => {
            app[lowercaseMethod]("/string", () => `Hello using ${method}`);

            const STEP_URL = `http://127.0.0.1:${port}/string`;
            await assertResponseEquals(app, STEP_URL, method, new Response(`Hello using ${method}`));
          });

          await t.step("respond with object", async () => {
            app[lowercaseMethod]("/json", () => ({ message: `Hello using ${method}` }));

            const STEP_URL = `http://127.0.0.1:${port}/json`;
            await assertResponseEquals(app, STEP_URL, method, Response.json({ message: `Hello using ${method}` }));
          });

          await t.step("Middleware", async (t) => {
            await t.step("respond with Response", async () => {
              app[lowercaseMethod]("/middleware/response", () => new Response(`Hello using ${method}`));

              const STEP_URL = `http://127.0.0.1:${port}/middleware/response`;
              await assertResponseEquals(
                app,
                STEP_URL,
                method,
                new Response(`(jsoned) (stringed) (*) Hello using ${method}`),
              );
            });

            await t.step("respond with string", async () => {
              app[lowercaseMethod]("/middleware/string", () => `Hello using ${method}`);

              const STEP_URL = `http://127.0.0.1:${port}/middleware/string`;
              await assertResponseEquals(
                app,
                STEP_URL,
                method,
                new Response(`(responded) (jsoned) (*) Hello using ${method}`),
              );
            });

            await t.step("respond with object", async () => {
              app[lowercaseMethod]("/middleware/json", () => ({ message: `Hello using ${method}` }));

              const STEP_URL = `http://127.0.0.1:${port}/middleware/json`;
              await assertResponseEquals(
                app,
                STEP_URL,
                method,
                Response.json({ message: `(responded) (stringed) (*) Hello using ${method}` }),
              );
            });
          });
        });
      }

      await t.step({
        name: "File server",
        // FS Watchers get closed when `abort` on `AbortController` is ran.
        sanitizeOps: false,
        sanitizeResources: false,
        fn: async (t) => {
          const filesPath = import.meta.resolve("./files").replace("file://", "");
          app.staticDir("/static", filesPath);

          await t.step("staticDir", async (t) => {
            for await (const entry of walk(filesPath)) {
              const RELATIVE_PATH = entry.path.replace(filesPath, "");

              if (entry.isFile) {
                const STEP_URL = `http://127.0.0.1:${port}/static${RELATIVE_PATH}`;

                await t.step(`static${RELATIVE_PATH}`, async () => {
                  await assertResponseEquals(app, STEP_URL, "GET", await fileResponse(entry.path));
                });

                if (entry.name === "this_changes.txt") {
                  await t.step("changing file", async () => {
                    const initialData = await Deno.readFile(entry.path);

                    for (let i = 0; i < 10; ++i) {
                      await assertResponseEquals(app, STEP_URL, "GET", await fileResponse(entry.path));
                      await Deno.writeTextFile(entry.path, `Test no.${i}`);
                      await new Promise<void>((r) => setTimeout(r, 150)); // give it some time to properly update
                    }

                    await Deno.writeFile(entry.path, initialData);
                  });
                }

                if (entry.name === "this_moves.txt") {
                  await t.step("moving file", async () => {
                    await assertResponseEquals(
                      app,
                      STEP_URL,
                      "GET",
                      await fileResponse(entry.path),
                    );

                    const movePath = `${filesPath}/folder_inside/this_moves.txt`;

                    await move(entry.path, movePath);
                    await new Promise<void>((r) => setTimeout(r, 150)); // give it some time to properly update

                    await assertResponse404s(app, STEP_URL, "GET");

                    await move(movePath, entry.path);
                    await new Promise<void>((r) => setTimeout(r, 150)); // give it some time to properly update

                    await assertResponseEquals(app, STEP_URL, "GET", await fileResponse(entry.path));
                  });
                }
              }
            }

            await t.step("new directory", async (t) => {
              const newDirectoryPath = `${filesPath}/new_directory`;
              await Deno.mkdir(newDirectoryPath);

              await t.step("new file", async () => {
                const STEP_URL = `http://127.0.0.1:${port}/static/new_directory/new_file.txt`;
                const newFilePath = `${newDirectoryPath}/new_file.txt`;
                await Deno.writeTextFile(newFilePath, "that's new");

                await new Promise<void>((r) => setTimeout(r, 150)); // give it some time to properly update
                await assertResponseEquals(app, STEP_URL, "GET", await fileResponse(newFilePath));

                await Deno.remove(newFilePath);

                await new Promise<void>((r) => setTimeout(r, 150)); // give it some time to properly update
                await assertResponse404s(app, STEP_URL, "GET");
              });

              await Deno.remove(newDirectoryPath, { recursive: true });
            });
          });

          await t.step("staticFile", async (t) => {
            const thisChangesPath = `${filesPath}/this_changes.txt`;
            app.staticFile("/fs/this_changes.txt", thisChangesPath, true);

            await t.step("fs/this_changes.txt", async () => {
              const STEP_URL = `http://127.0.0.1:${port}/fs/this_changes.txt`;

              const initialData = await Deno.readFile(thisChangesPath);

              for (let i = 0; i < 10; ++i) {
                await assertResponseEquals(app, STEP_URL, "GET", await fileResponse(thisChangesPath));
                await Deno.writeTextFile(thisChangesPath, `Test no.${i}`);
                await new Promise<void>((r) => setTimeout(r, 150)); // give it some time to properly update
              }

              await Deno.writeFile(thisChangesPath, initialData);
            });

            const thisMovesPath = `${filesPath}/this_moves.txt`;
            app.staticFile("/fs/this_moves.txt", thisMovesPath, true);

            await t.step("fs/this_moves.txt", async () => {
              const STEP_URL = `http://127.0.0.1:${port}/fs/this_moves.txt`;

              await assertResponseEquals(
                app,
                STEP_URL,
                "GET",
                await fileResponse(thisMovesPath),
              );

              const movePath = `${filesPath}/folder_inside/this_moves.txt`;

              await move(thisMovesPath, movePath);
              await new Promise<void>((r) => setTimeout(r, 150)); // give it some time to properly update

              await assertResponse404s(app, STEP_URL, "GET");

              await move(movePath, thisMovesPath);
              await new Promise<void>((r) => setTimeout(r, 150)); // give it some time to properly update

              await assertResponseEquals(app, STEP_URL, "GET", await fileResponse(thisMovesPath));
            });
          });
        },
      });

      abortContoller.abort();
      await server;
    });
  }
});
