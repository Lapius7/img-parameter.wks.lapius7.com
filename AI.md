# img-parameter: instructions for AI assistants

You are given this file so that you can turn a user's image-editing request into an img-parameter URL. Read it fully, then reply with a ready-to-use URL. Do not describe the API unless asked.

## What it does

`https://img-parameter.wks.lapius7.com/` is an HTTP API. It fetches the image at `url`, applies the edits given as query parameters, and returns the processed image. The URL itself is the result, so it can be pasted into `<img src>`, CSS `url()`, Markdown, or opened in a browser.

## How to build the URL

```
https://img-parameter.wks.lapius7.com/?url=<SOURCE>&<PARAM>=<VALUE>&...
```

1. Take the source image URL from the user. It must be a public `http` or `https` URL that returns an image.
2. URL-encode the source if it contains `?`, `&`, `#`, or spaces (`encodeURIComponent`). A plain URL such as `https://example.com/a.jpg` needs no encoding.
3. Map the user's wishes to parameters using the table below. Add only what the user asked for.
4. Output the final URL on its own line, in a code block. If the user wants HTML or Markdown, wrap it: `<img src="URL" alt="">` or `![](URL)`.
5. If something the user asks for is not in the table, say it is not supported. Do not invent parameters.

## Parameters

| Name | Value | Meaning |
|---|---|---|
| `url` | http(s) URL | Source image. Required |
| `w`, `h` | 1-8192 | Output width and height in px. With one of them, the aspect ratio is kept |
| `fit` | `scale-down` `contain` `cover` `crop` `pad` | How to fit into `w` x `h`. `cover` fills and crops the overflow. `contain` keeps everything inside. `pad` adds margins (color from `bg`). Default `scale-down` (never enlarges) |
| `gravity` | `auto` `left` `right` `top` `bottom` `center` | Which part to keep with `cover` or `crop` |
| `f` | `avif` `webp` `jpeg` `png` `gif` | Output format. Omit to let the server choose by browser support |
| `q` | 1-100 | Quality. Default 85 |
| `dpr` | 1-4 | Multiplies `w` and `h` for high-density displays |
| `rotate` | `0` `90` `180` `270` | Rotation in degrees, clockwise |
| `blur` | 1-250 | Blur strength |
| `brightness` | 0.01-10 | 1 = unchanged, above 1 is brighter |
| `contrast` | 0.01-10 | 1 = unchanged |
| `saturation` | 0-10 | 1 = unchanged, 0 = grayscale |
| `gamma` | 0.01-10 | 1 = unchanged |
| `sharpen` | 0-10 | Sharpening strength |
| `trim` | 0-1000 | Pixels cut from every edge |
| `r` | 1-4096 or `full` | Rounded corners in px. `full` makes a circle (square source) or ellipse. JPEG/GIF output switches to WebP |
| `bg` | hex without `#` | Margin color for `fit=pad`, such as `ffffff` |
| `preset` | name | Named parameter set. Only use names the user gives you |
| `sig` | hex | Signature. Only when the operator enabled signing. You cannot create it |

## Translating requests

| User says | Parameters |
|---|---|
| "make it 400px wide" | `w=400` |
| "square thumbnail, 200px" | `w=200&h=200&fit=cover` |
| "circle avatar" | `w=<size>&h=<size>&fit=cover&r=full` |
| "rounded corners" | `r=<px>` (use 16 if unspecified) |
| "smaller file size" | `f=webp&q=70` |
| "black and white" | `saturation=0` |
| "brighter" / "darker" | `brightness=1.3` / `brightness=0.7` |
| "blurry background" | `blur=20` |
| "rotate right" / "upside down" | `rotate=90` / `rotate=180` |
| "fit into 800x600 with white bars" | `w=800&h=600&fit=pad&bg=ffffff` |
| "sharper" | `sharpen=2` |
| "sharp on retina screens" | `w=<css width>&dpr=2` |

Rules of thumb:

- Prefer one of `w`/`h` unless the user gives both dimensions or wants a crop.
- Keep values inside the ranges above. If the user asks for more, use the limit and say so.
- Only use `f` when the user names a format or asks for smaller files.
- Do not add parameters "for quality" that the user did not ask for.

## Example

Request: "Make https://example.com/photo.jpg a 300px circle, slightly brighter."

```
https://img-parameter.wks.lapius7.com/?url=https://example.com/photo.jpg&w=300&h=300&fit=cover&r=full&brightness=1.2
```

## Errors you may relay

| Status | Meaning |
|---|---|
| 400 | A parameter is invalid, or the source is not an image, or the host is not allowed. The body explains why |
| 403 | A signature is required and missing or wrong |
| 413 | The source image is larger than 20MB |
| 502 | The source image could not be fetched |

## Limits

- Output is a still image. Animation, video, text overlays, and watermarks are not supported.
- The source must be reachable from the public internet.
- Full reference: https://github.com/Lapius7/img-parameter.wks.lapius7.com/blob/main/README.md
