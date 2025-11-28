import { ApiClient as CoreApiClient } from "./core";
import { feeds } from "./endpoints/feeds";
import { folders } from "./endpoints/folders";
import { opml } from "./endpoints/opml";
import { articles } from "./endpoints/articles";
import { discover } from "./endpoints/discover";

export * from "./core";
export * from "./types/common";
export * from "./types/feeds";
export * from "./types/articles";
export * from "./types/folders";
export * from "./types/opml";

export class ApiClient extends CoreApiClient {
  static rss = {
    ...feeds,
    ...folders,
    ...opml,
    ...articles,
    ...discover,
  };
}
