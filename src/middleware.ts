// Copyright 2023 Im-Beast. All rights reserved. MIT license.

import { Deferred } from "./util.ts";

import type { HydraHandler } from "./handler.ts";
import type { HydraRequest } from "./request.ts";
import { type HydraResponse, HydraResponseByType, type HydraResponseType, HydraResponseUtils } from "./response.ts";

export type HydraMiddlewareNextParams<Y extends HydraResponseType> = Y extends "unknown" ? [] : [type: Y];

export interface HydraMiddlewareNext {
  <T extends HydraResponseType = "unknown">(
    ...args: HydraMiddlewareNextParams<T>
  ): Promise<HydraResponseByType<T>>;
}

export interface HydraMiddlewareSet {
  (response: HydraResponse): void;
}

// deno-lint-ignore no-explicit-any
export type HydraMiddleware<Route extends string = any> = (
  request: HydraRequest<Route>,
  next: HydraMiddlewareNext,
  set: HydraMiddlewareSet,
) => void | PromiseLike<void>;

export function createMiddlewareHandler<Route extends string>(
  handler: HydraHandler<Route>,
  middlewares: HydraMiddleware[],
): HydraHandler<Route> {
  return async function middlewareHandler(request: HydraRequest) {
    let response: HydraResponse;
    const deferred = new Deferred<HydraResponse>();
    const finished = new Deferred<boolean>();

    const next: HydraMiddlewareNext = (async (value?: HydraResponseType) => {
      await deferred;

      if (value) {
        response = HydraResponseUtils.toType(response, value);
      }

      return response;
    }) as HydraMiddlewareNext;

    const set: HydraMiddlewareSet = (value) => {
      response = value;
    };

    void async function () {
      for (const middleware of middlewares) {
        await middleware(request, next, set);
      }
      finished.resolve(true);
    }();

    response = handler(request);
    deferred.resolve(response);
    await finished;

    return response;
  };
}
