// Copyright 2023 Im-Beast. All rights reserved. MIT license.

import { createMiddlewareHandler, HydraMiddleware } from "./middleware.ts";
import type { HydraRequest } from "./request.ts";
import type { HydraResponse } from "./response.ts";
import { UrlPatternGroups } from "./url_pattern.ts";

// deno-lint-ignore no-explicit-any
export interface HydraHandler<Route extends string = any> {
  (request: HydraRequest<Route>): HydraResponse;
}

export function getPossibleRoutePaths(
  method: string,
  hostname: string,
  port: number,
  route: string,
  forwarded = false,
): string[] {
  const paths: string[] = [
    `${method}/${hostname}:${port}${route}`,
    `${method}/http://${hostname}:${port}${route}`,
  ];

  if (port === 80) {
    paths.push(
      `${method}/${hostname}${route}`,
      `${method}/http://${hostname}${route}`,
    );
  } else if (port === 443) {
    paths.push(
      `${method}/${hostname}${route}`,
      `${method}/https://${hostname}${route}`,
    );
  }

  if (!forwarded) {
    if (hostname === "127.0.0.1") {
      paths.push(...getPossibleRoutePaths(method, "localhost", port, route, true));
    } else if (hostname === "localhost") {
      paths.push(...getPossibleRoutePaths(method, "127.0.0.1", port, route, true));
    }
  }

  return paths;
}

export function createReadyHandler<Route extends string>(
  handler: HydraHandler<Route>,
  middlewares: HydraMiddleware[],
  groups?: UrlPatternGroups<Route>,
): HydraHandler<Route> {
  if (middlewares.length) {
    handler = createMiddlewareHandler(handler, middlewares);
  }

  if (groups) {
    const $handler = handler;
    handler = function groupHandler(request) {
      request.groups = groups;
      return $handler(request);
    };
  }

  return handler;
}
