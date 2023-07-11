import { UrlPatternGroups } from "../mod.ts";

import { AssertTrue, IsExact } from "./deps.ts";

Deno.test("Types", async (t) => {
  await t.step("UrlPatternGroups", () => {
    type Group = AssertTrue<
      IsExact<UrlPatternGroups<"/book/:id">, {
        id: string;
      }>
    >;

    type GroupRegExp = AssertTrue<
      IsExact<UrlPatternGroups<"/book/:id(\\d+)">, {
        id: string;
      }>
    >;

    type OptionalGroup = AssertTrue<
      IsExact<
        UrlPatternGroups<"/books{/archive/:room}?/:id">,
        {
          room?: string;
          id: string;
        }
      >
    >;

    type OptionalGroupsAndRegExp = AssertTrue<
      IsExact<
        UrlPatternGroups<"/books{/archive/:room(\\d+)}?/book{/by_author/:author(\\w+)}?/:id">,
        {
          room?: string;
          author?: string;
          id: string;
        }
      >
    >;
  });
});
