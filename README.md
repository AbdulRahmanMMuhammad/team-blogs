# Team Blogs

Your organization's blogs: write posts and pages in Markdown, publish now or on a schedule, take comments and see who reads them. Blogs are public at `/b/<address>` or open only to their team.

Inspired by https://blogger.com

Built with [oss.new](https://oss.new) for [EveryApp](https://github.com/every-app/every-app).

## Features

- Create blogs with a title, address and description, and edit or delete them.
- Write posts with labels, preview them, save drafts, publish now or schedule, revert and delete.
- Add standalone pages and pick which appear in the blog's navigation, in order.
- Upload images up to 10 MB into posts and pages, and manage them in one list.
- Take reader comments, with approval, spam and delete, and choose who may comment.
- Give each blog a team of admins and authors, and make it public or team only.
- See views per day, top posts and pages, and referring sites for 7 or 30 days.

Left out: accounts and sign-in, which your Gateway handles; themes and layout gadgets; custom domains; ads; feeds and a developer API; post by email and templates; a mobile app.

## Setup

- Install: `pnpm install`
- Run locally: `pnpm dev`
- Test: `pnpm test` for unit tests; `checks/` holds the release suites (behavior, authorization, persistence) that run against a packaged release.
- Deploy: `pnpm run deploy`, which creates the D1 database and the `media` R2 bucket (R2 must be enabled on the Cloudflare account once).

There are no secrets or settings to fill in. Everyone in the organization can open the app; blog pages under `/b/` and comment posting are public routes.

## Limitations

- Changing a blog's address breaks links to the old one, including image links already in posts.
- People appear in the team picker only after they have opened the app once.
- Times on public pages are shown in UTC.
- Real deployment behind a live Gateway was not exercised here; the checks run against the packaged release in a local Gateway runtime.
