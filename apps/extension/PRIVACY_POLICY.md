# Privacy Policy for the Readspace Browser Extension

Last updated: September 13, 2026

## Overview

Readspace helps users collect web reading material in their Readspace account by saving webpage articles and subscribing to RSS feeds discovered on websites they visit. This policy explains how the Readspace browser extension handles information.

## Information We Handle

### Account and Authentication Information

- Email address and basic Readspace account profile information
- Passwords submitted directly to the configured Supabase authentication service when email/password sign-in is used
- OAuth authorization results and authentication tokens used to keep the user signed in

### Web History and Website Content

On HTTP and HTTPS pages, the extension automatically reads the current page URL and extracts page metadata, article content, images, and RSS or Atom feed links. It uses this information to display feed availability, prepare the current page for saving, and make the extension load faster.

Page information and extracted content may be cached temporarily in extension-local browser storage. Article content and associated metadata are sent to the user's configured Readspace server only when the user chooses to save the article. Feed URLs and metadata are sent when the user chooses to subscribe to a feed.

### Settings and Organizational Data

- The configured Readspace and Supabase server details for hosted or self-hosted use
- Preferences such as theme and saving options
- Selected folders, priorities, notes, and titles used to organize saved content

## How We Use Information

We use this information only to provide Readspace's article-saving, feed-discovery, authentication, synchronization, and content-organization features. We do not use it for advertising, creditworthiness, lending, or unrelated profiling.

## Storage and Retention

The extension stores authentication sessions, settings, cached page data, and cached save or follow status in extension-local browser storage. This local data remains until it expires, is cleared by the extension, the user clears the extension's data, or the extension is uninstalled.

Articles, feeds, account information, and related metadata that the user sends to a Readspace server are retained according to that server's policies and the user's account settings. Users can manage saved content through their Readspace account.

## Sharing and Service Providers

The extension communicates with:

- The official Readspace service or the self-hosted Readspace server selected by the user
- The configured Supabase service for authentication
- Google when the user chooses Google OAuth sign-in
- Websites and feed URLs accessed to detect and validate RSS or Atom feeds

We do not sell user data. We do not transfer user data to advertising platforms, data brokers, or other third parties except service providers necessary to deliver Readspace, transfers requested by the user, security or legal requirements, or other cases permitted by the Chrome Web Store User Data Policy.

The use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Permissions

- **storage:** Stores authentication sessions, settings, cached page information, and saved or followed state locally.
- **identity:** Runs the browser-mediated Google OAuth flow when the user chooses Google sign-in.
- **scripting:** Re-injects the extension's packaged content script into an eligible page when a tab opened before an extension installation, update, or reload no longer has a live content-script receiver.
- **Host access for HTTP and HTTPS pages:** Detects feeds, extracts page content and metadata, validates feed URLs, and enables the user to save articles from websites across the web.

The extension does not download or execute remote JavaScript or WebAssembly.

## Security

User data transmitted by the extension is sent over secure HTTPS connections. Authentication sessions are kept in browser extension-local storage and are not intentionally exposed to webpages. Users of self-hosted instances are responsible for securing and maintaining those servers.

## User Choices and Data Removal

Users can disable or uninstall the extension at any time. Uninstalling removes extension-local data according to browser behavior. Users can manage or delete server-stored articles and feeds through their Readspace account. For requests concerning account data, contact admin@readspace.ai.

## Changes

We may update this policy when the extension's behavior or legal requirements change. The updated date above identifies the latest revision.
