# img-parameter

[日本語](README.ja.md)

An image transform API for Cloudflare Workers. Put the source image URL and the edits in the query string, and get the processed image back. There are no pre-generated variants. The resulting URL works as-is in `<img src>` or CSS `background-image`.

```html
<img
  src="https://img-parameter.wks.lapius7.com/?url=https://example.com/photo.jpg&w=400&h=300&fit=cover&f=webp"
  alt="Sample image"
>
```

## Build a URL in the browser

Open [img-parameter.wks.lapius7.com](https://img-parameter.wks.lapius7.com/) with no parameters. Change the options in the form, check the preview, and copy the generated URL.

## Just ask an AI

No need to learn the parameters. Give an AI assistant the link to [AI.md](https://raw.githubusercontent.com/Lapius7/img-parameter.wks.lapius7.com/main/AI.md), your image URL, and the edit you want. It returns a ready-to-use URL.

```
Read https://raw.githubusercontent.com/Lapius7/img-parameter.wks.lapius7.com/main/AI.md
and make https://example.com/photo.jpg a 300px circle, slightly brighter.
```

```
https://img-parameter.wks.lapius7.com/?url=https://example.com/photo.jpg&w=300&h=300&fit=cover&r=full&brightness=1.2
```

## Features

- Resize, crop, rotate, blur, and adjust brightness and contrast with URL parameters
- Output as AVIF, WebP, JPEG, PNG, or GIF. When `f` is omitted, the API picks AVIF, WebP, or JPEG from the browser's `Accept` header
- Results are stored in the Cloudflare cache, so repeat requests for the same URL skip processing
- Source hosts can be restricted with an allowlist
- Named presets, such as `?preset=thumb`, keep URLs short
- Optional signed URLs reject requests that were not issued by you
- Optional fallback image for when the source cannot be fetched
- Processing uses the Cloudflare Images binding

## Usage

```
GET https://img-parameter.wks.lapius7.com/?url=<image url>&<parameters>
```

`url` is required. If the source URL contains `?` or `&`, URL-encode it.

### Examples

| Goal | Query |
|---|---|
| Shrink to 400px wide | `?url=…&w=400` |
| Crop to a 300×300 square | `?url=…&w=300&h=300&fit=cover` |
| Fit into 800×600 with white padding | `?url=…&w=800&h=600&fit=pad&bg=ffffff` |
| Compress as WebP at quality 70 | `?url=…&f=webp&q=70` |
| Render at 2x for high-density displays | `?url=…&w=300&dpr=2` |
| Rotate 90 degrees and blur | `?url=…&rotate=90&blur=10` |
| Circular avatar | `?url=…&w=128&h=128&fit=cover&r=full` |
| Use a preset | `?url=…&preset=thumb` |

## Parameters

| Name | Value | Description |
|---|---|---|
| `url` | http / https URL | Source image. Required |
| `w`, `h` | 1-8192 | Output size in px. With only one set, the aspect ratio is kept |
| `fit` | `scale-down` `contain` `cover` `crop` `pad` | Resize mode. Defaults to `scale-down` |
| `gravity` | `auto` `left` `right` `top` `bottom` `center` | Which part to keep with `cover` or `crop` |
| `f` | `avif` `webp` `jpeg` `jpg` `png` `gif` | Output format. Chosen from the `Accept` header when omitted |
| `q` | 1-100 | Quality. Defaults to 85 |
| `dpr` | 1-4 | Pixel ratio. Multiplies `w` and `h`, capped at 8192px |
| `rotate` | `0` `90` `180` `270` | Rotation in degrees |
| `blur` | 1-250 | Blur strength |
| `brightness` | 0.01-10 | 1 leaves it unchanged |
| `contrast` | 0.01-10 | 1 leaves it unchanged |
| `saturation` | 0-10 | 1 leaves it unchanged, 0 is grayscale |
| `gamma` | 0.01-10 | 1 leaves it unchanged |
| `sharpen` | 0-10 | Sharpening strength |
| `trim` | 0-1000 | Pixels to cut from each edge |
| `bg` | Hex color (for example `ffffff`) | Padding color for `fit=pad` |
| `r` | 1-4096 or `full` | Rounded corners. Radius in px, or `full` for a circle (an ellipse for non-square images). JPEG and GIF output switches to WebP to keep transparency |
| `preset` | Preset name | Applies a named parameter set. Explicit parameters override it |
| `sig` | Hex string | HMAC signature. Required when signing is enabled |

Out-of-range or invalid values return `400` with the reason.

## Responses

| Status | Meaning |
|---|---|
| `200` | The processed image |
| `400` | Invalid parameter, the source is not an image, or the host is not allowed |
| `404` | The path is not `/` |
| `405` | Method other than `GET` or `HEAD` |
| `403` | Signing is enabled and `sig` is missing or invalid |
| `413` | The source is too large (20MB by default) |
| `502` | Fetching the source failed |
| `500` | Image processing failed |

Successful responses carry `Cache-Control: public, max-age=86400, s-maxage=604800`. When `f` is omitted, they also carry `Vary: Accept`.

## Setup

Requirements:

- A Cloudflare account with Images enabled
- [Bun](https://bun.sh) or Node.js, and pnpm

```sh
pnpm install
pnpm build    # build the form UI into public/
pnpm dev      # run locally
pnpm deploy   # build, then deploy to Cloudflare
```

Change the public domain in `routes` in `wrangler.jsonc`.

### Configuration

Set these under `vars` in `wrangler.jsonc`.

| Name | Default | Description |
|---|---|---|
| `PRESETS` | two samples | JSON object of preset names and parameter strings |
| `FALLBACK_URL` | empty | Image returned when the source cannot be fetched. It is processed with the same parameters and keeps the failure status (`502` or `400`). Not cached long-term. When empty, the error is returned as text |
| `ALLOWED_HOSTS` | empty | Comma-separated hosts the API may fetch from. Subdomains are allowed too. When empty, every host is allowed |
| `MAX_SOURCE_BYTES` | `20000000` | Maximum source size in bytes |
| `SIGNING_SECRET` | unset | Secret, set with `wrangler secret put`. Enables signed URLs |

For a public deployment, set `ALLOWED_HOSTS` so that others cannot use your instance to process arbitrary images.

## Presets

Define presets as JSON in `PRESETS`. Parameters in the URL override the preset's values.

```
?url=…&preset=thumb          # w=200&h=200&fit=cover&f=webp
?url=…&preset=thumb&w=300    # thumb, but 300px wide
```

## Signed URLs

Run `wrangler secret put SIGNING_SECRET` to enable signing. Requests without a valid `sig` then get `403`. The signature is the hex HMAC-SHA256 of the query string with `sig` removed.

```sh
SIGNING_SECRET=… bun sign.mjs "https://img-parameter.wks.lapius7.com/?url=https://example.com/a.jpg&w=400"
```

The command prints the URL with `sig` appended. Changing any parameter after signing invalidates the signature.

## Notes

- Rounded corners (`r`) cost two image operations per uncached request.
- Cloudflare Images transformations are billed by usage. See [Cloudflare Images pricing](https://developers.cloudflare.com/images/pricing/) for rates and the free tier.
- Workers can only fetch public URLs as sources.
- Check the copyright and license terms of the source images yourself.
