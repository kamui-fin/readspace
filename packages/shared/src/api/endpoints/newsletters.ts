import { ApiClient } from "../core";
import { Subscription } from "../types/feeds";

export const newsletters = {
  getNewsletterToken: () =>
    ApiClient.get<{ token: string; email: string }>("/api/intake/token"),

  subscribeNewsletter: (data: {
    name: string;
    sender_email: string;
    folder_id: string;
  }) => ApiClient.post<Subscription>("/api/intake/subscribe", data),
};
