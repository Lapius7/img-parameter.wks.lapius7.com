# img-parameter

[English](README.md)

URL のクエリで画像を加工して返す、Cloudflare Workers 用の API です。元画像の URL と加工内容を URL に書くだけで、加工後の画像を取得できます。専用のビルドや事前変換は要りません。生成した URL は、そのまま `<img src>` や CSS の `background-image` に使えます。

```html
<img
  src="https://img-parameter.wks.lapius7.com/?url=https://example.com/photo.jpg&w=400&h=300&fit=cover&f=webp"
  alt="サンプル画像"
>
```

## 特徴

- リサイズ、切り抜き、回転、ぼかし、明るさ・コントラストなどの調整を、URL のパラメータで指定できます
- 出力形式を AVIF、WebP、JPEG、PNG、GIF から選べます。`f` を省略すると、ブラウザの `Accept` ヘッダーに合わせて AVIF、WebP、JPEG のどれかを返します
- 加工結果を Cloudflare のキャッシュに保存するため、同じ URL への 2 回目以降のアクセスは加工を行わずに返します
- 取得元のホストを許可リストで制限できます
- `?preset=thumb` のように名前でパラメータを指定でき、URL を短くできます
- 署名付き URL を有効にすると、自分が発行していない URL の処理を拒否できます
- 元画像を取得できないときに返す代替画像を設定できます
- 加工には Cloudflare Images の binding を使います

## 使い方

```
GET https://img-parameter.wks.lapius7.com/?url=<画像のURL>&<加工パラメータ>
```

`url` は必須です。値に `?` や `&` が含まれる場合は、URL エンコードして渡してください。

### 例

| 目的 | URL のクエリ |
|---|---|
| 幅 400px に縮小 | `?url=…&w=400` |
| 300×300 の正方形に切り抜き | `?url=…&w=300&h=300&fit=cover` |
| 余白を白で埋めて 800×600 に収める | `?url=…&w=800&h=600&fit=pad&bg=ffffff` |
| WebP で画質 70 に圧縮 | `?url=…&f=webp&q=70` |
| 高解像度ディスプレイ向けに 2 倍で出力 | `?url=…&w=300&dpr=2` |
| 90 度回転してぼかす | `?url=…&rotate=90&blur=10` |
| 円形のアイコンにする | `?url=…&w=128&h=128&fit=cover&r=full` |
| プリセットを使う | `?url=…&preset=thumb` |

## パラメータ

| 名前 | 値 | 内容 |
|---|---|---|
| `url` | http / https の URL | 元画像。必須です |
| `w`, `h` | 1〜8192 | 出力サイズ（px）。片方だけ指定すると、縦横比を保ちます |
| `fit` | `scale-down` `contain` `cover` `crop` `pad` | リサイズの方法。省略時は `scale-down` です |
| `gravity` | `auto` `left` `right` `top` `bottom` `center` | `cover` や `crop` で残す位置 |
| `f` | `avif` `webp` `jpeg` `jpg` `png` `gif` | 出力形式。省略時は `Accept` ヘッダーから選びます |
| `q` | 1〜100 | 画質。省略時は 85 です |
| `dpr` | 1〜4 | 画素比。`w` と `h` に掛けます。結果は 8192px までに収めます |
| `rotate` | `0` `90` `180` `270` | 回転角度 |
| `blur` | 1〜250 | ぼかしの強さ |
| `brightness` | 0.01〜10 | 明るさ。1 で変化なしです |
| `contrast` | 0.01〜10 | コントラスト。1 で変化なしです |
| `saturation` | 0〜10 | 彩度。1 で変化なし、0 でモノクロです |
| `gamma` | 0.01〜10 | ガンマ補正。1 で変化なしです |
| `sharpen` | 0〜10 | シャープネス |
| `trim` | 0〜1000 | 上下左右から切り取る幅（px） |
| `bg` | 16 進数の色（例: `ffffff`） | `fit=pad` の余白の色 |
| `r` | 1〜4096 または `full` | 角丸。半径（px）を指定します。`full` は円（正方形でない画像では楕円）です。透過が必要なため、JPEG と GIF は WebP で出力します |
| `preset` | プリセット名 | 名前を付けたパラメータ一式を適用します。URL で明示した値が優先されます |
| `sig` | 16 進数の文字列 | HMAC 署名。署名を有効にした場合は必須です |

範囲外の値や不正な値を渡すと、`400` とエラーの理由を返します。

## レスポンス

| ステータス | 意味 |
|---|---|
| `200` | 加工後の画像 |
| `400` | パラメータが不正、元画像が画像ではない、または取得元が許可されていない |
| `404` | パスが `/` ではない |
| `405` | `GET` と `HEAD` 以外のメソッド |
| `403` | 署名が有効で、`sig` がない、または正しくない |
| `413` | 元画像が大きすぎる（上限は既定で 20MB） |
| `502` | 元画像の取得に失敗した |
| `500` | 画像の加工に失敗した |

成功時は `Cache-Control: public, max-age=86400, s-maxage=604800` を付けて返します。`f` を省略した場合は `Vary: Accept` も付けます。

## セットアップ

必要なもの:

- Cloudflare アカウント（Images を有効にしてください）
- [Bun](https://bun.sh) または Node.js、pnpm

```sh
pnpm install
pnpm dev      # ローカルで起動
pnpm deploy   # Cloudflare にデプロイ
```

公開するドメインは `wrangler.jsonc` の `routes` で変更します。

### 設定

`wrangler.jsonc` の `vars` で次の値を指定します。

| 名前 | 既定値 | 内容 |
|---|---|---|
| `PRESETS` | サンプル 2 つ | プリセット名とパラメータ文字列の JSON オブジェクト |
| `FALLBACK_URL` | 空 | 元画像を取得できないときに返す画像。同じパラメータで加工し、失敗時のステータス（`502` または `400`）のまま返します。長期間はキャッシュしません。空の場合は、エラーをテキストで返します |
| `ALLOWED_HOSTS` | 空 | 取得を許可するホストをカンマ区切りで指定します。サブドメインも許可します。空の場合は、すべてのホストを許可します |
| `MAX_SOURCE_BYTES` | `20000000` | 元画像の最大サイズ（バイト） |
| `SIGNING_SECRET` | 未設定 | `wrangler secret put` で設定するシークレット。署名付き URL を有効にします |

公開サービスとして運用する場合は、第三者に使われないように `ALLOWED_HOSTS` を指定することをおすすめします。

## プリセット

`PRESETS` に JSON でプリセットを定義します。URL に書いたパラメータは、プリセットの値より優先されます。

```
?url=…&preset=thumb          # w=200&h=200&fit=cover&f=webp
?url=…&preset=thumb&w=300    # thumb の設定で、幅だけ 300px
```

## 署名付き URL

`wrangler secret put SIGNING_SECRET` で署名を有効にします。有効にすると、正しい `sig` がないリクエストは `403` になります。署名は、`sig` を除いたクエリ文字列の HMAC-SHA256（16 進数）です。

```sh
SIGNING_SECRET=… bun sign.mjs "https://img-parameter.wks.lapius7.com/?url=https://example.com/a.jpg&w=400"
```

実行すると、`sig` を付けた URL を出力します。署名後にパラメータを 1 つでも変えると、署名は無効になります。

## 注意

- 角丸（`r`）を指定すると、キャッシュにない最初のリクエストで画像処理を 2 回行います。
- Cloudflare Images の変換は従量課金です。料金と無料枠は [Cloudflare Images の料金](https://developers.cloudflare.com/images/pricing/)を確認してください。
- Workers が取得できる元画像は、公開 URL に限られます。
- 元画像の著作権と利用条件は、利用者が確認してください。
