<div align="center">

<a href="https://readspace.ai">
  <img src="./apps/web/public/wordmark.png" alt="Readspace" width="300" />
</a>

<h1>The open-source reader for everything you follow</h1>

<p>
  <strong>Publications, indie blogs, and newsletters in one chronological feed.<br />
  A Daily Digest that catches you up in five minutes. Use the hosted app or run it yourself.</strong>
</p>

<p>
  <a href="https://app.readspace.ai"><img alt="Open the web app" src="https://img.shields.io/badge/Open_the_web_app-386641?style=for-the-badge&logoColor=white" height="28" /></a>
  &nbsp;
  <a href="#self-hosting"><img alt="Self-host with Docker" src="https://img.shields.io/badge/Self--host_with_Docker-1f2328?style=for-the-badge&logo=docker&logoColor=white" height="28" /></a>
</p>

<p>
  <a href="https://apps.apple.com/us/app/readspace-rss-news-reader/id6790224641"><img alt="Download on the App Store" src="./.github/assets/badges/app-store.png" height="44" /></a>
  &nbsp;
  <a href="https://play.google.com/store/apps/details?id=com.readspace.rss"><img alt="Get it on Google Play" src="./.github/assets/badges/google-play.png" height="44" /></a>
  &nbsp;
  <a href="https://chromewebstore.google.com/detail/readspace/ppadpdoicnolpjnflfladjllhmkonedi"><img alt="Available in the Chrome Web Store" src="./.github/assets/badges/chrome-web-store.png" height="44" /></a>
  &nbsp;
  <a href="https://addons.mozilla.org/en-us/firefox/addon/readspace/"><img alt="Get the Firefox add-on" src="./.github/assets/badges/firefox-add-ons.png" height="46" /></a>
</p>

<p>
  <a href="https://github.com/kamui-fin/readspace/actions/workflows/ci.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/kamui-fin/readspace/ci.yml?branch=main"></a>
  <a href="./LICENSE"><img alt="AGPL-3.0 license" src="https://img.shields.io/github/license/kamui-fin/readspace"></a>
  <a href="https://github.com/kamui-fin/readspace/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/kamui-fin/readspace"></a>
  <a href="https://discord.gg/2q5ptywuqz"><img alt="Discord community" src="https://img.shields.io/discord/1349476822290530357?logo=discord&label=discord"></a>
</p>

</div>

![Readspace feed and article reader](./landing/assets/img/main_feed_web-1200.webp)

<p align="center">
  <img src="./landing/assets/img/main_feed_mobile.webp" alt="Readspace mobile feed" width="280" />
  &nbsp;&nbsp;&nbsp;&nbsp;
  <img src="./landing/assets/img/daily_digest_mobile.webp" alt="Readspace mobile daily digest" width="280" />
</p>

> [!TIP]
> Watch or star the repo to hear about new releases, and come say hi in [Discord](https://discord.gg/2q5ptywuqz) if you want a say in what gets built next.

## Why Readspace

I follow a mix of tech writers, market newsletters, political coverage, and a handful of small blogs. Before Readspace, those lived in different places: publications on their own sites, newsletters piling up in Gmail, indie blogs in bookmarks I never opened. Social feeds put everything in one place, but an algorithm picks what you see and the feed never ends.

RSS fixes most of this, but the readers built on it tend to assume you already know how RSS works. You start with an empty screen and a box asking for a feed URL, and the mobile apps are usually an afterthought. I wanted an RSS reader my mom could use without ever learning what RSS is.

Read [the manifesto](./MANIFESTO.md) for the longer version.

> **New to RSS?** RSS is an open format websites use to publish their latest posts. A reader checks the feeds you subscribe to and collects new entries in one place, with no platform deciding what appears.

## Features

### Finding things to follow

- **You don't start with an empty reader.** The hosted catalog indexes over 120,000 feeds: news sites, magazines, indie blogs, company blogs, newsletters, podcasts, YouTube channels, and forums. Whatever you are into, there is probably a feed for it. Search by name or topic, or browse popular feeds by category.
- See similar feeds for any source you follow
- Paste a feed URL or a plain website, or let the browser extension find a site's feed as you browse
- Follow sites without native feeds through RSSHub using `rsshub://` routes
- Import and export subscriptions with OPML
- **Newsletters go in the same feed.** Hosted accounts get a private `@readspace.ai` address. Point your Substack and TLDR subscriptions at it and they show up next to everything else.

### Reading

- Chronological RSS and Atom timeline with all, today, and unread views. Nothing is ranked or reordered.
- Folders, unread counts, and read/unread controls for articles, feeds, and folders
- Full-article extraction when a feed only provides an excerpt
- Save feed articles to read later, or archive any webpage from the browser extension
- Recently read history for finding articles you opened before
- Light and dark themes across web, mobile, and extension

### Daily Digest and AI

- **The Daily Digest.** Each morning it goes through what your sources published and gives you a five-minute briefing: the big stories first, then a few articles worth reading in full. It only uses sources you follow and links every item back to the original.
- Summaries, skim-mode highlights, and translations in the article reader
- AI never adds sources or reorders your feed. Self-hosters can use their own Gemini key or turn AI off.

### Apps

- Web, iOS, Android, Chrome, and Firefox, with reading state synced across all of them
- **The store apps work with your own server.** Enter your instance URL in the iOS, Android, or extension settings. No forks or sideloading.

## Hosted or self-hosted

Both run the same codebase. The hosted service adds the infrastructure that is impractical to ship in a Compose file.

|                                                  | Hosted (`app.readspace.ai`) |                Self-hosted                |
| ------------------------------------------------ | :-------------------------: | :---------------------------------------: |
| Feeds, folders, timeline, read state             |             ✅              |                    ✅                     |
| Web, iOS, Android, Chrome, Firefox clients       |             ✅              |                    ✅                     |
| Read later, page archiving, full-text extraction |             ✅              |                    ✅                     |
| OPML import and export                           |             ✅              |                    ✅                     |
| RSSHub routes                                    |             ✅              |           ✅ (bundled instance)           |
| Daily digest, summaries, translations            |             ✅              | Bring your own Gemini key, or turn AI off |
| 120,000+ feed discovery catalog                  |             ✅              |    Add feeds by RSS URL or OPML     |
| Newsletter address |             ✅              |             Not available |
| Runs on your own hardware, your own data         |             No              |                    ✅                     |

The browser extensions and mobile apps connect to a self-hosted instance using only its instance URL, so you can use the App Store and Play Store builds against your own server.

## Self-hosting

The Docker setup runs the web app, API, workers, Supabase, Redis, Meilisearch, and an optional RSSHub instance.

### Requirements

- Git
- Docker Engine or Docker Desktop with Docker Compose
- Bash, `curl`, `jq`, and OpenSSL

### Install

```bash
git clone https://github.com/kamui-fin/readspace.git
cd readspace

./docker/setup.sh
./docker/launch.sh
```

`setup.sh` configures the public URL, RSSHub, and optional AI support. `launch.sh` builds and starts the stack. Running setup again preserves existing secrets unless you explicitly rotate them.

Open [http://localhost:18042](http://localhost:18042) and create an account. To make it an administrator:

```bash
./docker/promote-admin.sh you@example.com
```

For a public deployment, follow the [reverse proxy examples](./docs/reverse-proxy-examples.md) for Caddy, Nginx, or Traefik.

### Connect an extension or mobile app to your instance

Open the extension or mobile app settings and enter your **instance URL**. This is the URL of the Readspace API, which usually ends in port `18008`:

```text
http://192.168.1.42:18008
```

That is the only value the client needs; Supabase configuration is discovered automatically. Use your public HTTPS API URL instead when running behind a reverse proxy.

<details>
<summary><strong>Reset or rotate secrets</strong></summary>

> [!CAUTION]
> Resetting permanently deletes all instance data.

```bash
./docker/reset.sh
./docker/launch.sh
```

To also regenerate secrets:

```bash
./docker/reset.sh
./docker/setup.sh --regenerate-secrets
./docker/launch.sh
```

</details>

## Development

Readspace is a monorepo containing several product surfaces and services:

| Path             | What it contains                                  |
| ---------------- | ------------------------------------------------- |
| `apps/web`       | Next.js web application                           |
| `apps/mobile`    | Expo / React Native mobile application            |
| `apps/extension` | Chrome and Firefox browser extension              |
| `apps/inbound`   | Hosted newsletter ingestion worker                |
| `server`         | FastAPI API, feed processing, and background jobs |
| `packages`       | Shared code, configuration, and design tokens     |
| `docker`         | Self-hosted infrastructure and setup scripts      |

For prerequisites, local infrastructure, app-specific commands, database migrations, tests, and pull-request guidance, see [CONTRIBUTING.md](./CONTRIBUTING.md).

## Contributing

You do not need to run the whole stack to help. Documentation fixes, self-hosting reports, browser extension tweaks, design feedback, and bug reports all help, and they are the easiest place to start.

1. Read the [contributing guide](./CONTRIBUTING.md).
2. Check [existing issues](https://github.com/kamui-fin/readspace/issues) before opening a new one.
3. For ideas or questions that are not yet actionable bugs, start a [GitHub discussion](https://github.com/kamui-fin/readspace/discussions).

Self-hosted Readspace on something unusual, or hit a wall during setup? Tell us in [Discord](https://discord.gg/2q5ptywuqz) or a discussion. Setup friction reports are one of the most valuable contributions right now.

## Community

- [Join the Discord](https://discord.gg/2q5ptywuqz)
- [Start a discussion](https://github.com/kamui-fin/readspace/discussions)

## License

Readspace is licensed under the [GNU Affero General Public License v3.0](./LICENSE).
