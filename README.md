# FreshRSS Picture Cache with Cloudflare Workers

This is a Cloudflare worker utilizing its Cache API to cache and serve pictures for RSS feeds.

You can use the [FreshRSS image cache plugin](https://github.com/Victrid/freshrss-image-cache-plugin) to rewrite the RSS feeds to this caching URL.

## Usage

1. edit `wrangler.toml` and set its route and fallback figure url. For example:

   ```toml
   route = "https://example.com/piccache"
   
   [vars]
   FALLBACK_FIGURE = "https://http.cat/404.jpg"
   ```

   The CF worker will be bind to the route specified, and when unable to retrieve the figure, it will return `FALLBACK_FIGURE` instead. You may also remove the line of `route` and it will use `*.workers.dev` instead.

2. Add secrets of `APITOKEN`

   Use `wrangler secret put APITOKEN ` to specify the access token. This should be consistent with image cache plugin's `access_token`.

3. Deploy the worker

   [Read this guide](https://developers.cloudflare.com/workers/get-started/guide).

4. Configure the image cache plugin

   First, upload the plugin [FreshRSS image cache plugin](https://github.com/Victrid/freshrss-image-cache-plugin) to your freshRSS instance with this [guide](https://github.com/FreshRSS/Extensions).

   If you use a route like `https://example.com/piccache`, the image cache plugin should be configured as:

   ```yaml
   cache_url: "https://example.com/piccache?url="
   post_url: "https://example.com/piccache"
   access_token: "<AS THE APITOKEN ABOVE>"
   url_encode: true
   ```

   If you don't use route and get a `*.workers.dev` for your worker, the image cache plugin should be configured as:

   ```yaml
   cache_url: "https://some.workers.dev/?url="
   post_url: "https://some.workers.dev/"
   access_token: "<AS THE APITOKEN ABOVE>"
   url_encode: true
   ```

## Additional Headers

Some RSS feeds may mis-configured their figure loading policies, and cannot retrieve the figure without a specific header. Consider add the URL-headers pair to `src/index.ts:25`. 

## Reference

[Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
