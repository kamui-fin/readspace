We wish to migrate from PostgreSQL built-in search to meilisearch.

Primary key: id (from feeds table)

Indexed fields:
- title
- description
- tags
- link (website)
- url (rss - exact match)
- language - filter
- category - filter
- popularity score (sortable)
- embedding (user provided, store in _vectors field)

Non-index but display:
- image url

We want to support both full text search and AI search modes. 

We will keep the feeds table from postgres in sync during:
- Batch enrich feeds
- Admin actions (CRUD)
- Create new global feed
- _update_feed_metadata function when we have a new link and image_url


Our frontend can directly talk to meilisearch!
Follow https://www.meilisearch.com/docs/guides/front_end/react_quick_start and re-implement the discover page. 
https://github.com/meilisearch/meilisearch-js  too

Also setup pagination: https://www.meilisearch.com/docs/guides/front_end/pagination.

Have a switch somewhere to enable ai search or not. We can 

Modify docker compose to include meili: see https://www.meilisearch.com/docs/guides/docker

Understand the existing way we did it and see how we can migrate it out. Use context7 mcp to search meilisearch-js and meilisearch documentation. Or use web search too. 
- server/app/routers/discover.py
- server/app/services/feeds/search/search_engine.py
- server/app/services/feeds/search/feed_similarity.py

Create a script to migrate out the data from postgres into meili too.