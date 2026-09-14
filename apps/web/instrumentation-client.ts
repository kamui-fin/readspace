// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { isCloudProd } from "@/lib/is-cloud-prod";

// Only report to Readspace's Sentry project on the hosted cloud instance — never
// for self-hosted deployments, which have no reason to send errors to us.
if (isCloudProd()) {
  Sentry.init({
    dsn: "https://839d2cd1f45b3311901991dc08b25001@o4511544654036992.ingest.us.sentry.io/4512086153232384",

    // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
    tracesSampleRate: 1,

    integrations: [
      // send console.log, console.warn, and console.error calls as logs to Sentry
      Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
    ],

    dataCollection: {
      // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
      // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
      // userInfo: false,
      // httpBodies: [],
    },
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
