// Copyright 2023 Im-Beast. All rights reserved. MIT license.

import type { NormalOrPromiseLike } from "./types.ts";

export type HydraResponseType = "unknown" | "string" | "response" | "json";
export type HydraResponseByType<T extends HydraResponseType> =
  | (T extends "unknown" ? HydraResponse
    : T extends "string" ? string
    : T extends "response" ? Response
    : T extends "json" ? Record<string | number, unknown>
    : never)
  | undefined;

export type HydraResponse = NormalOrPromiseLike<
  | string
  | Record<string | number, unknown>
  | Response
  | undefined
>;

export class HydraResponseUtils {
  static toType<T extends HydraResponseType, R = Promise<HydraResponseByType<T>>>(response: HydraResponse, type: T): R {
    switch (type) {
      case "json":
        return HydraResponseUtils.toObject(response) as R;
      case "response":
        return HydraResponseUtils.toResponse(response) as R;
      case "string":
        return HydraResponseUtils.toString(response) as R;
      default:
        throw "Unknown response type";
    }
  }

  static async toString(response: HydraResponse): Promise<string | undefined> {
    if (response instanceof Promise) {
      response = await response;
    }

    if (response === undefined) {
      return response;
    }

    if (typeof response === "string") {
      return response;
    } else if (response instanceof Response) {
      return response.text();
    }

    return JSON.stringify(response);
  }

  static async toObject(response: HydraResponse): Promise<Record<string | number, unknown> | undefined> {
    if (response instanceof Promise) {
      response = await response;
    }

    if (response === undefined) {
      return response;
    }

    let json: Record<string | number, unknown>;
    if (typeof response === "string") {
      try {
        json = JSON.parse(response);
      } catch {
        json = { data: response };
      }
      return json;
    } else if (response instanceof Response) {
      let text: string | null = null;
      try {
        text = await response.text();
        json = JSON.parse(text);
      } catch {
        json = { data: text };
      }
      return json;
    }

    return response as Record<string | number, unknown>;
  }

  static async toResponse(response: HydraResponse): Promise<Response | undefined> {
    if (response instanceof Promise) {
      response = await response;
    }

    if (response === undefined) {
      return undefined;
    }

    if (response instanceof Response) {
      return response;
    } else if (typeof response === "string") {
      return new Response(response);
    }

    return Response.json(response);
  }
}
