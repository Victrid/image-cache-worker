export interface Env {
  APITOKEN: string;
  FALLBACK_FIGURE: string;
}

type post_request = {
  url: string;
  access_token: string;
};


export default {
  process_content_type(content: string | null): string {
    if (content == null || content.length == 0) {
      return "application/octet-stream";
    }
    const ct = content.split(";")
    if (ct.length == 0) {
      return "application/octet-stream";
    }
    return ct[0];
  },

  get_headers(host: string): HeadersInit {
    const header_map = new Map<string, HeadersInit>(
      [
        ["www.zhihu.com", new Headers({
          "sec-ch-ua": "\" Not A;Brand\";v=\"99\", \"Chromium\";v=\"96\", \"Google Chrome\";v=\"96\"",
          "Referer": "https://daily.zhihu.com",
          "sec-ch-ua-mobile": "?0",
          "accept": "image/svg+xml,image/png;q=0.5,image/jpeg;q=0.5,image/gif;q=0.3",
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36",
          "sec-ch-ua-platform": "\"Linux\""
        })],
        ["cn.nikkei.com", new Headers({
          "sec-ch-ua": "\" Not A;Brand\";v=\"99\", \"Chromium\";v=\"96\", \"Google Chrome\";v=\"96\"",
          "Referer": "https://cn.nikkei.com/",
          "sec-ch-ua-mobile": "?0",
          "accept": "image/png,image/jpeg;q=0.5,image/gif;q=0.3",
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36",
          "sec-ch-ua-platform": "\"Linux\""
        })],
      ]);

    var result = header_map.get(host);
    return new Headers(result);
  },

  set_cache_header(header: Headers): Headers {
    var new_header = new Headers()
    var content_type = this.process_content_type(header.get("content-type"))
    new_header.set("content-type", content_type)
    new_header.set("cache-control", 'public, max-age=259200');
    return new_header;
  },

  async cache_url(request: Request, env: Env, url: URL): Promise<Response> {
    const allowed_mime_types = new Set<string>(['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml']);
    const request_header = this.get_headers(url.host);
    const pic_request = new Request(url.toString(), { method: "GET", headers: request_header });

    const cachekey = new Request(request.url, { method: "GET", headers: new Headers() });

    const cache = caches.default;
    let cache_response = await cache.match(cachekey);

    if (!cache_response) {
      let origin_response = await fetch(pic_request);
      if (!origin_response) {
        // Failed to load
        console.debug("[CACHE] Failed to load origin response.");

        var fallback_response = await fetch(env["FALLBACK_FIGURE"]);
        var header = this.set_cache_header(fallback_response.headers)
        fallback_response = new Response(fallback_response.body, { ...fallback_response, headers: header });
        await cache.put(cachekey, fallback_response.clone());
        return fallback_response;
      } else {
        var mime = origin_response.headers.get("Content-Type");

        if (!mime || !allowed_mime_types.has(this.process_content_type(mime))) {
          // Failed to load
          console.debug("[CACHE] No mime set.");
          var fallback_response = await fetch(env["FALLBACK_FIGURE"]);
          var header = this.set_cache_header(fallback_response.headers);
          fallback_response = new Response(fallback_response.body, { ...fallback_response, headers: header });
          await cache.put(cachekey, fallback_response.clone());
          return fallback_response;
        }

        // Successfully loaded
        console.debug("[CACHE] Successfully loaded.");
        var header = this.set_cache_header(origin_response.headers)
        origin_response = new Response(origin_response.body, { ...origin_response, headers: header });
        await cache.put(cachekey, origin_response.clone());
        return origin_response;
      }
    } else {
      // Cache hit
      console.debug("[CACHE] Cache hit.");
      return cache_response;
    }
  },


  async handle_post(request: Request, env: Env): Promise<Response> {
    if (request.body == null) {
      return new Response("Bad request", { status: 400 });
    }
    // Parse JSON request
    try {
      var req_content = await (request.json()) as post_request;
    }
    catch (error) {
      if (error instanceof Error) {
        return new Response("Input is invalid.", { status: 400 });
      } else {
        return new Response("Bad request", { status: 400 });
      }
    }

    // Check if access token is correct
    if (req_content.access_token != env["APITOKEN"]) {
      return new Response("Invalid token.", { status: 403 });
    }

    // Check if URL is correct
    try {
      var url = new URL(req_content.url);
    }
    catch (error) {
      if (error instanceof Error) {
        return new Response("Invalid URL.", { status: 400 });
      } else {
        return new Response("Bad request", { status: 400 });
      }
    }

    console.debug("[POST] Request: " + req_content.url);

    // Request and store
    await this.cache_url(request, env, url);

    return new Response(JSON.stringify({ status: "OK" }), { status: 200 });
  },

  async handle_get(request: Request, env: Env): Promise<Response> {
    const { searchParams } = new URL(request.url)
    var url = searchParams.get("url");
    if (!url)
      return new Response("Invalid URL.", { status: 400 });
    console.debug("[GET] Request: " + url);
    return this.cache_url(request, env, new URL(url));
  },

  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    if (request.method == "GET") {
      return this.handle_get(request, env);
    } else if (request.method == "POST") {
      return this.handle_post(request, env);
    } else {
      return new Response("Method not allowed", { status: 405 });
    }
  },
};
