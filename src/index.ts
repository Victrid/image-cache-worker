export interface Env {
  APITOKEN: string
  FALLBACK_FIGURE: string
}

interface post_request {
  url: string
  access_token: string
}

export default {
  process_content_type (content: string | null): string {
    if (content == null || content.length === 0) {
      return 'application/octet-stream'
    }
    const ct = content.split(';')
    if (ct.length === 0) {
      return 'application/octet-stream'
    }
    return ct[0]
  },

  get_headers (host: string): HeadersInit {
    const HEADER_MAP = new Map<string, HeadersInit>(
      [
        ['www.zhihu.com', new Headers({
          'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="96", "Google Chrome";v="96"',
          Referer: 'https://daily.zhihu.com',
          'sec-ch-ua-mobile': '?0',
          accept: 'image/webp,image/svg+xml;q=0.9,image/png;q=0.5,image/jpeg;q=0.5,image/gif;q=0.3,image/bmp;q=0.1',
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
          'sec-ch-ua-platform': '"Linux"'
        })],
        ['cn.nikkei.com', new Headers({
          'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="96", "Google Chrome";v="96"',
          Referer: 'https://cn.nikkei.com/',
          'sec-ch-ua-mobile': '?0',
          accept: 'image/webp,image/svg+xml;q=0.9,image/png;q=0.5,image/jpeg;q=0.5,image/gif;q=0.3,image/bmp;q=0.1',
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
          'sec-ch-ua-platform': '"Linux"'
        })]
      ])

    const result = HEADER_MAP.get(host)
    return new Headers(result)
  },

  set_cache_header (header: Headers): Headers {
    const newHeader = new Headers()
    const contentType = this.process_content_type(header.get('content-type'))
    newHeader.set('content-type', contentType)
    newHeader.set('cache-control', 'public, max-age=259200')
    return newHeader
  },

  async cache_url (request: Request, env: Env, url: URL): Promise<Response> {
    const ALLOWED_MIME_TYPES = new Set<string>(['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp', 'image/bmp'])
    const requestHeader = this.get_headers(url.host)
    const picRequest = new Request(url.toString(), { method: 'GET', headers: requestHeader })

    const cacheKey = new Request(request.url, { method: 'GET', headers: new Headers() })

    const cache = caches.default
    const cacheResponse = await cache.match(cacheKey)

    if (cacheResponse === undefined || !cacheResponse.ok) {
      let originalResponse = await fetch(picRequest)
      if (!originalResponse.ok) {
        // Failed to load
        console.debug('[CACHE] Failed to load origin response.')
        let fallbackResponse = await fetch(env.FALLBACK_FIGURE)
        const header = this.set_cache_header(fallbackResponse.headers)
        fallbackResponse = new Response(fallbackResponse.body, { ...fallbackResponse, headers: header })
        await cache.put(cacheKey, fallbackResponse.clone())
        return fallbackResponse
      } else {
        const mime = originalResponse.headers.get('Content-Type')

        if ((mime == null) || !ALLOWED_MIME_TYPES.has(this.process_content_type(mime))) {
          // Failed to load
          console.debug('[CACHE] No mime set.')
          let fallbackResponse = await fetch(env.FALLBACK_FIGURE)
          const header = this.set_cache_header(fallbackResponse.headers)
          fallbackResponse = new Response(fallbackResponse.body, { ...fallbackResponse, headers: header })
          await cache.put(cacheKey, fallbackResponse.clone())
          return fallbackResponse
        }

        // Successfully loaded
        console.debug('[CACHE] Successfully loaded.')
        const header = this.set_cache_header(originalResponse.headers)
        originalResponse = new Response(originalResponse.body, { ...originalResponse, headers: header })
        await cache.put(cacheKey, originalResponse.clone())
        return originalResponse
      }
    } else {
      // Cache hit
      console.debug('[CACHE] Cache hit.')
      return cacheResponse
    }
  },

  async handle_post (request: Request, env: Env): Promise<Response> {
    if (request.body == null) {
      return new Response('Bad request', { status: 400 })
    }
    // Parse JSON request
    let requestContent = null
    try {
      requestContent = await request.json<post_request>()
    } catch (error) {
      if (error instanceof Error) {
        return new Response('Input is invalid.', { status: 400 })
      } else {
        return new Response('Bad request', { status: 400 })
      }
    }

    // Check if access token is correct
    if (requestContent.access_token !== env.APITOKEN) {
      return new Response('Invalid token.', { status: 403 })
    }

    // Check if URL is correct
    let url = null
    try {
      url = new URL(requestContent.url)
    } catch (error) {
      if (error instanceof Error) {
        return new Response('Invalid URL.', { status: 400 })
      } else {
        return new Response('Bad request', { status: 400 })
      }
    }

    console.debug('[POST] Request: ' + requestContent.url)

    // Request and store
    await this.cache_url(request, env, url)

    return new Response(JSON.stringify({ status: 'OK' }), { status: 200 })
  },

  async handle_get (request: Request, env: Env): Promise<Response> {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')
    if (url == null) { return new Response('Invalid URL.', { status: 400 }) }
    console.debug('[GET] Request: ' + url)
    return await this.cache_url(request, env, new URL(url))
  },

  async fetch (
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    if (request.method === 'GET') {
      return await this.handle_get(request, env)
    } else if (request.method === 'POST') {
      return await this.handle_post(request, env)
    } else {
      return new Response('Method not allowed', { status: 405 })
    }
  }
}
