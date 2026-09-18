export interface RouteRequest { from: string; to: string; departure: Date }
export interface RouteProvider { buildUrl: (request: RouteRequest) => string }
// Verified against Yahoo!'s public search form and visible results on 2026-09-18.
// No private API calls or scraping. All route rendering is owned by Yahoo!.
export const yahooProvider: RouteProvider = {
  buildUrl({ from, to, departure }) {
    if (!from.trim() || !to.trim() || Number.isNaN(departure.getTime())) throw new Error('Invalid route request')
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(departure)
    const part = (type: string) => parts.find(p => p.type === type)!.value
    const minute = part('minute')
    const params = new URLSearchParams({ from: from.trim(), to: to.trim(), y: part('year'), m: part('month'), d: part('day'), hh: part('hour'), m1: minute[0], m2: minute[1], type: '1', s: '0', ticket: 'ic', expkind: '1', userpass: '1', ws: '3', al: '1', shin: '1', ex: '1', hb: '1', lb: '1', sr: '1' })
    return `https://transit.yahoo.co.jp/search/result?${params}`
  },
}
export const routeProvider = yahooProvider
