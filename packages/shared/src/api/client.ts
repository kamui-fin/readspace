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
export * from "../utils/reading-time";

import { ApiClientConfig } from "./core";

class BaseApiClient extends CoreApiClient {
  static configure(config: ApiClientConfig) {
    // Ensure the base class is configured, as endpoints use it directly
    CoreApiClient.configure(config);
    // Also configure this class (inherited behavior)
    super.configure(config);
  }
}

Object.assign(BaseApiClient, feeds, folders, opml, articles, discover, users);

export const ApiClient = BaseApiClient as typeof CoreApiClient &
  typeof feeds &
  typeof folders &
  typeof opml &
  typeof articles &
  typeof discover &
  typeof users;

export type ApiClient = InstanceType<typeof CoreApiClient>;
