// Copyright 2023 Im-Beast. All rights reserved. MIT license.

import { UrlPatternGroups } from "./url_pattern.ts";

// deno-lint-ignore no-explicit-any
export interface HydraRequest<Route extends string = any> extends Request {
  groups: UrlPatternGroups<Route>;
}
