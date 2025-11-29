import { ApiClient as CoreApiClient } from "./core";
import { feeds } from "./endpoints/feeds";
import { folders } from "./endpoints/folders";
import { opml } from "./endpoints/opml";
import { articles } from "./endpoints/articles";
import { discover } from "./endpoints/discover";
import { users } from "./endpoints/users";

export * from "./core";
export * from "./types/common";
export * from "./types/feeds";
export * from "./types/articles";
export * from "./types/folders";
export * from "./types/opml";

class BaseApiClient extends CoreApiClient {}

Object.assign(BaseApiClient, feeds, folders, opml, articles, discover, users);

export const ApiClient = BaseApiClient as typeof CoreApiClient &
  typeof feeds &
  typeof folders &
  typeof opml &
  typeof articles &
  typeof discover &
  typeof users;

export type ApiClient = InstanceType<typeof CoreApiClient>;
