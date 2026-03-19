export const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

export const FLEX_THRESHOLD = 5

const FETCH_TIMEOUT_MS = 30_000
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 3000

export async function fetchPage(url: string): Promise<string> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        redirect: 'follow',
        signal: controller.signal
      })

      if (!response.ok) {
        clearTimeout(timeout)
        throw new Error(`HTTP ${response.status} fetching ${url}`)
      }

      const text = await response.text()
      clearTimeout(timeout)
      return text
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
      }
    }
  }

  throw lastError!
}

export function normalizeLane(lane: string): string {
  const mapping: Record<string, string> = {
    top: 'top',
    jungle: 'jungle',
    middle: 'mid',
    mid: 'mid',
    bottom: 'bottom',
    adc: 'bottom',
    support: 'support',
    utility: 'support'
  }
  return mapping[lane.toLowerCase()] || lane.toLowerCase()
}
