# Readspace Mobile App

Ok so we are building the readspace mobile app in expo react native that accompanies the web version. All API hooks are in the packages/shared directory so use that rather than build your own hooks. 

# Web

So the full readspace web product is already built out (next.js tailwind shadcn typescript) in apps/web so you may look at that if you ever need some inspiration on functionality stuff.

# Logo

I have the svg in readspace.svg

# Lists

Use legend-list (https://www.legendapp.com/open-source/list/v2/getting-started/) for highly performant lists esp. for the article list.

# Styling

Use nativewind + clsx + cva (for re-usable primitives)

# Icons

Use monicons (https://github.com/mikaeljorhult/monicons) with lucide for icons.

# Routing

Expo router.

# Code Quality

VERY IMPORTANT. We must maintain a top-notch, pristine codebase. AVOID massive files or components. Try to keep things modular, have files be dedicated to 1 component. 

Always keep an eye out for code smells and when you see a need to refactor, DO IT. A file structure like this maybe:
├── assets/
├── scripts/
├── src/
│   ├── app/
│   │   ├── api/                    # API routes in a separate folder
│   │   │   ├── event+api.ts
│   │   │   └── user+api.ts
│   │   ├── _layout.tsx
│   │   ├── index.tsx
│   │   ├── events.tsx
│   │   └── settings.tsx
│   ├── components/
│   │   ├── Table/
│   │   │   ├── Cell.tsx
│   │   │   └── index.tsx
│   │   ├── BarChart.tsx
│   │   └── Button.tsx
│   ├── screens/
│   │   ├── Home/
│   │   │   ├── Card.tsx            # component only used in the home page
│   │   │   └── index.tsx           # returned from /src/app/index.tsx
│   │   ├── Events.tsx              # returned from /src/app/events.tsx
│   │   └── Settings.tsx            # returned from /src/app/settings.tsx
│   ├── server/                     # code used in /api
│   │   ├── auth.ts
│   │   └── db.ts
│   ├── utils/                      # reusable utilities
│   │   ├── formatDate.ts
│   │   ├── formatDate.test.ts      # unit test next to the file being tested
│   │   └── pluralize.ts
│   ├── hooks/
│   │   ├── useAppState.ts
│   │   └── useTheme.ts
├── app.json
├── eas.json
└── package.json

# Typography

Main: Geist Sans

Headings: -2% letter spacing

Logo: Figtree

EB Garamond: Article or book reading font

Refer to https://docs.expo.dev/develop/user-interface/fonts/ to setup fonts but also check mobile-old for reference.

# Readspace Color Pallete

primary: #386641
---
- default button bg


secondary: #6A994E
---
- active states for switch, chip, radio, check, bottom nav item, progress bar, slider
- link color


mid-grey: #F3F3F3
---
- bg for inputs, chips, radio items, 


grey: #90988B
---
- main fg for "muted" text (e.g. input placeholder)
    - especially when sitting on another lighter grey


red: #EA4335
----
- cancel and logout button text
- error text


green-grey: #D1DBCD
---
- switch off state bg


light-grey: #F9F9F9
---
- card bg
- <hr> divider color

white: #FFFFFF
----
- main screen bg
- bottom sheet bg


black: #232222
---
- light theme default fg for all text
- alternate button bg (e.g. for google sign-in)

This color pallete is VERY important. Set it up properly with nativewind config, global.css, etc. 

# Animations

Would love for the app to be quite fluid, especially like a native app. Use react-native-reanimated.

# Dark mode

Make sure all the components you build support dark mode with the way nativewind expects it (consult the docs)

# Consulting documentation

Your knowledge may not be up-to-date with the latest versions of the libraries i'm mentioning. This is why you MUST use context7 or if that doesn't work then web search for it. 

React native / expo ecosystem is changing fast and the last thing we want is outdated code.

# Other stuff

Check README.md of repo root level to understand what readspace is. But basically we're building a modern RSS feed reader + e-reader in one. 

# Toasts

Use sonner-native

# Data fetching 

Obviously, use tanstack query like we have in the shared api code and web app. I believe it was already setup in mobile-old. 

# Bun

Use /home/kamui/.bun/bin/bun to run bun commands.