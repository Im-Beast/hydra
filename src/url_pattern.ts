// Copyright 2023 Im-Beast. All rights reserved. MIT license.
// Inspired by Acorn's partially typed ParamsDictionary

type EmptyObject = Record<string | number | symbol, never>;

/**
 * Clean route from regex groups
 *
 * @example
 * ```ts
 * type Route = "/books/id(\\d+)";
 * type NoRegexRoute = RegexFreeRoute<Route>; // "/books/id"
 * ```
 */
type RegexFreeRoute<Path extends string> = Path extends `${infer PartA}(${string})${infer PartB}`
  ? RegexFreeRoute<`${PartA}${PartB}`>
  : Path;

/**
 * Get pattern group for `Path`
 * If `Optional` is `true` every next group will be optional
 * If `Path` contains more routes it will recurse
 */
type RoutePart<Path extends string, Optional extends true | false = false> = Path extends
  `${infer PartA}{${infer PartB}}${infer PartC}`
  ? PartC extends `?${infer PartD}` ? RoutePart<PartB, true> & RoutePart<PartA, Optional> & RoutePart<PartD, Optional>
  : RoutePart<`${PartA}${PartB}${PartC}`, Optional>
  : Path extends `${infer PartA}/${infer PartB}` ? EitherGroupOrNever<PartA, Optional> & RoutePart<PartB, Optional>
  : EitherGroupOrNever<Path, Optional>;

type NonCapturingGroupOrNever<
  Part extends string,
> = Part extends `{${infer Param}}?` ? { [key in Param]?: string } : EmptyObject;

type GroupOrNever<Part extends string> = Part extends `:${infer Param}` ? { [key in Param]: string } : EmptyObject;

type EitherGroupOrNever<
  Part extends string,
  Optional extends true | false,
> = NonCapturingGroupOrNever<Part> extends EmptyObject
  ? Optional extends true ? Partial<GroupOrNever<Part>> : GroupOrNever<Part>
  : NonCapturingGroupOrNever<Part>;

/** Disconnect `U` from `T` intersection of types */
type DisconnectIntersection<T, U> = T extends (infer D & U) ? D : T;

/**
 * Parse given `Path` into possible groups that URLPattern with given pathname would match.
 *
 * Supports every type of pattern, that includes:
 *  - Wildcards (`"/books/*"`)
 *  - Named groups (`"/books/:id"`)
 *  - Non-capturing groups (`"/book/:id{/data}?"`)
 *  - RegExp groups (`"/books/:id(\\d+)"`)
 *
 * Named groups within non-capturing groups will be optional.
 *
 * @example
 * ```ts
 * type BooksById = UrlPatternGroups<"/books/:id(\\d+)">
 *
 * type IsEqual = IsExact<BooksById, {
 *  id: string;
 * }>; // true
 * ```
 *
 * @example
 * ```ts
 * type VeryAdvancedPattern = UrlPatternGroups<"/books{/archive/:room(\\d+)}?/book{/by_author/:author(\\w+)}?/:id">;
 *
 * type IsEqual = IsExact<VeryAdvancedPattern, {
 *  room?: string;
 *  author?: string;
 *  id: string;
 * }>; // true
 * ```
 */
export type UrlPatternGroups<Path extends string> = DisconnectIntersection<
  DisconnectIntersection<RoutePart<RegexFreeRoute<Path>>, EmptyObject>,
  Partial<EmptyObject>
>;
