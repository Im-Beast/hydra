// Copyright 2023 Im-Beast. All rights reserved. MIT license.

import { HydraHandler } from "./handler.ts";
import { HydraRequest } from "./request.ts";
import { getContentType } from "./mime_types.ts";
import { HydraMiddleware } from "./middleware.ts";
import { HydraResponseUtils } from "./response.ts";
import { createReadyHandler, getPossibleRoutePaths } from "./handler.ts";
import { extractPatternShorthand, extractRouteFromUrl, isUrlPattern } from "./util.ts";

import type { HTTPMethod } from "./types.ts";
import type { UrlPatternGroups } from "./url_pattern.ts";

export interface RouteCreator<Route extends string> {
  (route: Route, handler: HydraHandler<Route>, groups?: UrlPatternGroups<Route>): void;
}

// TODO: Getter setter to global context?
// or even better, to each Hydra instance.
export const errors = {
  NotFound: () => new Response("Not found", { status: 404 }),
};

export class Hydra {
  hostname: string;
  port: number;

  handlers: Map<string, HydraHandler>;
  patternHandlers: { [shorthand: string]: HydraHandler[] };
  originalHandlers: WeakMap<HydraHandler, HydraHandler>;

  middlewares: { [route: string]: [id: number, middleware: HydraMiddleware][] };
  patternMiddlewares: [id: number, middleware: HydraMiddleware, pattern: URLPattern][];
  signal?: AbortSignal;

  constructor(hostname: string, port: number, options?: HydraOptions) {
    hostname = hostname.replace(/https?:\/\/(.+)/i, "$1");
    if (hostname.endsWith("/")) hostname = hostname.slice(0, -1);

    this.hostname = hostname;
    this.port = port;
    this.signal = options?.signal;

    this.handlers = new Map();
    this.originalHandlers = new WeakMap();
    this.middlewares = {};

    this.patternHandlers = {};
    this.patternMiddlewares = [];
  }

  #addRoute(method: string, route: string, handler: HydraHandler): void {
    const { handlers, hostname, port } = this;
    method = method.toUpperCase();

    for (const routePath of getPossibleRoutePaths(method, hostname, port, route)) {
      handlers.set(routePath, handler);
    }
  }

  #deleteRoute(method: string, route: string): void {
    const { handlers, hostname, port } = this;
    method = method.toUpperCase();

    for (const routePath of getPossibleRoutePaths(method, hostname, port, route)) {
      handlers.delete(routePath);
    }
  }

  #routeCreator<Route extends string>(
    method: HTTPMethod,
    route: Route,
    handler: HydraHandler<Route>,
    groups?: UrlPatternGroups<Route>,
  ): HydraHandler<Route> {
    if (isUrlPattern(route)) {
      const { patternHandlers } = this;

      const pattern = new URLPattern({ pathname: route });

      const patternHandler: HydraHandler<Route> = (request) => {
        const { url } = request;

        const patternResult = pattern.exec(url);
        if (!patternResult) return;

        const groups = patternResult.pathname.groups as UrlPatternGroups<Route>;
        request.groups = groups;

        const route = extractRouteFromUrl(url);

        // add fast path route
        const readyHandler = this.#routeCreator(method, route as Route, handler, groups);

        return readyHandler(request);
      };

      const shorthand = extractPatternShorthand(method, route);
      patternHandlers[shorthand] ??= [];
      patternHandlers[shorthand].push(patternHandler);

      return patternHandler;
    }

    const middlewareGroups: [number, HydraMiddleware, unknown?][] = this.middlewares[route] ??= [];

    for (const mw of this.patternMiddlewares) {
      if (middlewareGroups.indexOf(mw) === -1 && mw[2].test({ pathname: route })) {
        middlewareGroups.push(mw);
      }
    }

    // TODO: There needs to be easier way to keep middlewares in order
    const middlewares = middlewareGroups
      .sort(([a], [b]) => a - b)
      .map(([_id, middleware]) => middleware);

    const readyHandler = createReadyHandler(handler, middlewares, groups);
    this.originalHandlers.set(readyHandler, handler);

    this.#addRoute(method, route, readyHandler);
    return readyHandler;
  }

  get<Route extends string>(route: Route, handler: HydraHandler<Route>): void {
    this.#routeCreator("GET", route, handler);
  }

  put<Route extends string>(route: Route, handler: HydraHandler<Route>): void {
    this.#routeCreator("PUT", route, handler);
  }

  post<Route extends string>(route: Route, handler: HydraHandler<Route>): void {
    this.#routeCreator("POST", route, handler);
  }

  head<Route extends string>(route: Route, handler: HydraHandler<Route>): void {
    this.#routeCreator("HEAD", route, handler);
  }

  patch<Route extends string>(route: Route, handler: HydraHandler<Route>): void {
    this.#routeCreator("PATCH", route, handler);
  }

  delete<Route extends string>(route: Route, handler: HydraHandler<Route>): void {
    this.#routeCreator("DELETE", route, handler);
  }

  options<Route extends string>(route: Route, handler: HydraHandler<Route>): void {
    this.#routeCreator("OPTIONS", route, handler);
  }

  #middlewareId = 0;
  use<Route extends string>(route: Route, middleware: HydraMiddleware<Route>): void {
    const { middlewares } = this;

    if (isUrlPattern(route)) {
      const pattern = new URLPattern({ pathname: route });
      this.patternMiddlewares.push([++this.#middlewareId, middleware, pattern]);
    } else {
      middlewares[route] ??= [];
      middlewares[route].push([++this.#middlewareId, middleware]);
    }
  }

  async staticDir(route: string, filePath: string, watchChanges?: boolean): Promise<void>;
  async staticDir(route: string, filePath: string, fileCache: Map<string, Uint8Array>): Promise<void>;
  async staticDir(route: string, path: string, data: Map<string, Uint8Array> | boolean = true): Promise<void> {
    const fileCache = data instanceof Map ? data : new Map<string, Uint8Array>();
    const watchChanges = data instanceof Map ? false : data;

    if (!path.endsWith("/")) path = path + "/";
    if (!route.endsWith("/")) route = route + "/";
    // path = normalize(path);

    for await (const entry of Deno.readDir(path)) {
      if (entry.isDirectory) {
        await this.staticDir(`${route}${entry.name}/`, `${path}${entry.name}/`, fileCache);
      } else {
        await this.staticFile(`${route}${entry.name}`, `${path}${entry.name}`, fileCache);
      }
    }

    if (!watchChanges) {
      return;
    }

    const watcher = Deno.watchFs(path, { recursive: true });

    this.signal?.addEventListener("abort", () => {
      watcher.close();
    });

    for await (const event of watcher) {
      const [from, to] = event.paths as [string, string?];

      const fromName = from.slice(from.indexOf(path) + path.length);
      const fromPath = `${path}${fromName}`;
      const fromRoute = `${route}${fromName}`;

      switch (event.kind) {
        case "create": {
          const info = await Deno.stat(from);
          if (info.isDirectory) {
            await this.staticDir(fromRoute, fromPath, fileCache);
          } else {
            await this.staticFile(fromRoute, fromPath, fileCache);
          }
          break;
        }

        case "modify":
          if (from !== to && to) {
            const toName = to.slice(to.indexOf(path) + path.length);
            const toPath = `${path}${toName}`;
            const toRoute = `${route}${toName}`;

            fileCache.set(toPath, fileCache.get(fromPath)!);

            fileCache.delete(fromPath);
            this.#deleteRoute("get", fromRoute);

            await this.staticFile(toRoute, toPath, fileCache);
          } else {
            fileCache.delete(fromPath);
          }
          break;

        case "remove":
          fileCache.delete(fromPath);
          break;
      }
    }
  }

  async staticFile(route: string, filePath: string, watchChanges: boolean): Promise<void>;
  async staticFile(route: string, filePath: string, fileCache: Map<string, Uint8Array>): Promise<void>;
  async staticFile(route: string, filePath: string, data: Map<string, Uint8Array> | boolean = true): Promise<void> {
    let responseInit: ResponseInit;
    const contentType = getContentType(filePath);
    if (contentType) {
      responseInit = {
        headers: { "Content-Type": contentType },
      };
    }

    if (data instanceof Map) {
      this.get(route, async () => {
        let cache = data.get(filePath);

        if (!cache) {
          try {
            cache = await Deno.readFile(filePath);
            data.set(filePath, cache);
          } catch {
            // TODO: check for permissions etc
            return;
          }
        }

        return new Response(cache, responseInit);
      });
    } else {
      let cache: Uint8Array | undefined;
      this.get(route, async () => {
        if (!cache) {
          try {
            cache = await Deno.readFile(filePath);
          } catch {
            return;
          }
        }

        return new Response(cache, responseInit);
      });

      if (!data) return;

      // watch file changes
      const watcher = Deno.watchFs(filePath, { recursive: false });

      this.signal?.addEventListener("abort", () => {
        watcher.close();
      });

      for await (const event of watcher) {
        switch (event.kind) {
          case "modify":
          case "remove":
            cache = undefined;
            break;
        }
      }
    }
  }

  resolve(request: Request): Response | undefined | Promise<Response | undefined> {
    const { method, url } = request;

    let response = this.handlers.get(`${method}/${url}`)?.(request as HydraRequest);

    if (!response) {
      const { patternHandlers } = this;

      let shorthand = `${method}/${extractRouteFromUrl(url)}`;
      let handlers: HydraHandler<string>[] = patternHandlers[shorthand];
      const maxLength = method.length + 1;

      while (!handlers && shorthand.length !== maxLength) {
        shorthand = shorthand.slice(0, shorthand.lastIndexOf("/"));
        handlers = patternHandlers[shorthand];
      }

      if (!handlers) return;

      for (const handler of handlers) {
        if ((response ??= handler(request as HydraRequest))) break;
      }
    }

    if (response) {
      return HydraResponseUtils.toResponse(response);
    }
  }

  serve(): Promise<void> {
    const { hostname, port, signal } = this;

    return Deno.serve({
      hostname,
      port,
      signal,
    }, async (request) => {
      return await this.resolve(request) ?? errors.NotFound();
    }).finished;
  }
}
