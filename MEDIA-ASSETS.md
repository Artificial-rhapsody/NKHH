# Media assets and GitHub Pages

## Source tree

```text
site.json                             Homepage copy, image paths, Hero media choice
videos.json                           Canonical video library and cover paths
assets/
  images/                             Existing design resources (for example intro-mask.png)
  temp/                               Existing supplied images; preserved to avoid broken links
  uploads/
    site/
      images/<sha256>.png|jpg|webp|gif  Homepage images, backgrounds and raster masks
      videos/<sha256>.mp4|webm         Uploaded Hero background videos
    videos/
      covers/<sha256>.png|jpg|webp|gif  Interview/video-library covers
```

The upload service creates folders on demand. Files use a content SHA-256 rather than user filenames: immutable paths, safe names and deduplication within each category. Original image bytes and video bytes are retained; no silent compression or transcoding. New SVG/HTML uploads are deliberately rejected. Existing design SVG resources are unaffected.

## Administrator workflow

Start `npm run worker:dev` and `npm run dev` in separate terminals, then open `http://127.0.0.1:8000/admin.html` with an administrator account.

- **Page editor → Hero media** selects the Hero media type and image/poster. Select **Image**, **Uploaded video**, or **Vimeo background**. The media-source field accepts a Vimeo video URL, not arbitrary iframe HTML. Uploading MP4/WebM automatically selects Uploaded video.
- **All homepage images** exposes every homepage image/background/mask, including visually obscured elements. Editor-only buttons in the preview also select the Hero, intro image, background and mask. These buttons are absent from the visitor page.
- **Video library → Cover image URL** includes a direct image file picker. Upload the cover, save the video draft, then confirm publication.
- Each picker reports upload progress and errors. Images have a 20 MiB cap; Hero videos have a 90 MiB cap. Prefer Vimeo for larger videos to avoid Git/GitHub Pages repository growth.
- Hero videos autoplay muted, loop and play inline. Vimeo backgrounds use the same parameters; Vimeo privacy/domain restrictions and browser autoplay policy still apply. The regular Hero image remains the uploaded video's poster/fallback. Vimeo remote playback is not guaranteed by local iframe tests.

An upload immediately stores and verifies a file in the configured local source tree or, in production, as a GitHub Contents API commit. It only updates the current editing draft. Visitors continue reading published JSON until **Confirm and publish homepage/library**. Discarding a draft does not delete its uploaded files. Upload URLs are public static resources, not confidential storage. Unreferenced uploads are retained in source (no automatic deletion); they are excluded from the Pages artifact. Existing user records and source images are never automatically deleted.

Upload requests require a same-origin browser request and a fresh administrator check. Types are allowlisted and checked against file signatures; payload size is bounded and filenames cannot control filesystem paths. Uploaded video serving supports byte-range requests.

## Static artifact

```bash
npm test
npm run check
npm run build
```

`npm run build` writes the ignored `dev-page/` artifact. It validates source JSON, checks referenced local assets, copies allowlisted public HTML/CSS/JS/JSON and **only referenced media**, and adds `.nojekyll`. Missing media, symlink media, unsafe paths, and assets at or above 100 MiB fail the build. Backend code, authentication databases, Worker state, dependencies and credentials are not copied. The builder only replaces an output directory it previously marked as its own artifact.

All media references are relative `assets/...` paths, compatible with a GitHub Pages repository subpath. Keep `assets/uploads/` in source control when eventually committing published media; do not commit `dev-page/`.

For a visitor-only static preview (not editing/authentication):

```bash
python3 -m http.server 8010 --directory dev-page
```

Open `http://127.0.0.1:8010/`. Authentication still needs its backend; a plain static server does not provide the editor's upload/publication endpoints.

Production deployment uses a trusted Worker that writes files and JSON to GitHub, then relies on the repository's Pages Action to deploy the new commit. GitHub credentials remain server-side as a Cloudflare Worker secret. The target repository, Pages Origin, D1 ID and Worker variables must be filled before production deployment.
