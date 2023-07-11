// Copyright 2023 Im-Beast. All rights reserved. MIT license.

/**
 * Checks whether a route is possibly an URLPattern string
 * @example
 * ```ts
 * console.log(isUrlPattern("/books/johnny_bravo")); // false
 * console.log(isUrlPattern("/books/:author")); // true
 * ```
 */
export function isUrlPattern(route: string): boolean {
  return route.includes("*") || route.includes(":") || route.includes("{") || route.includes("?");
}

/**
 * Extracts route from given url
 *
 * Slices string from first occurence of `"/"` after 8th index
 * It starts at 8th index, because that's the last position protocols `"/"`
 * ```ts
 * Math.max("http://".length, "https://".length) === 8;
 * ```
 *
 * @example
 * ```ts
 * console.log(extractRouteFromUrl("https://library.com/book/3")); // "/book/3"
 * ```
 */
export function extractRouteFromUrl(url: string): string {
  return url.slice(url.indexOf("/", 8));
}

export function indexOfOrLength(string: string, searchString: string, position?: number): number {
  const index = string.indexOf(searchString, position);
  return index === -1 ? string.length : index;
}

export function extractPatternShorthand(method: string, route: string): string {
  return method.toUpperCase() + route.slice(
    0,
    Math.min(
      indexOfOrLength(route, "*"),
      indexOfOrLength(route, ":"),
      indexOfOrLength(route, "{"),
    ) - 1,
  );
}

/**
 * Promise that has `resolve` and `reject` functions as its methods.
 *
 * @example
 * ```ts
 * const name = new Deferred<string>();
 *
 * setTimeout(() => {
 *  name.resolve("Johnny")
 * }, 150);
 *
 * console.log(await name); // waits for 150ms and then prints "Johnny"
 * ```
 */
export class Deferred<T> extends Promise<T> {
  constructor() {
    let resolve!: this["resolve"];
    let reject!: this["reject"];

    super((res, rej) => {
      resolve = res;
      reject = rej;
    });
    this.resolve = resolve;
    this.reject = reject;
  }

  resolve!: (value: T | PromiseLike<T>) => void;
  reject!: (reason?: unknown) => void;

  static get [Symbol.species]() {
    return Promise;
  }
}
