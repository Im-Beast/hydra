// Copyright 2023 Im-Beast. All rights reserved. MIT license.

export type NormalOrPromiseLike<A> = A | PromiseLike<A>;

export type HTTPMethod =
  | "GET"
  | "PUT"
  | "POST"
  | "HEAD"
  | "PATCH"
  | "DELETE"
  | "OPTIONS";
