import { describe, expect, it } from 'vitest'
import { yahooProvider } from './routing'
describe('Yahoo public search URL', () => {
  it('encodes stations and preserves verified conditions', () => {
    const url = new URL(yahooProvider.buildUrl({ from: ' 東京 ', to: '新宿 & 大阪', departure: new Date('2026-09-18T09:07:59Z') }))
    expect(url.origin + url.pathname).toBe('https://transit.yahoo.co.jp/search/result')
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ from: '東京', to: '新宿 & 大阪', y: '2026', m: '09', d: '18', hh: '18', m1: '0', m2: '7', type: '1', s: '0' })
  })
  it('handles midnight and year rollover in Japan', () => {
    const params = new URL(yahooProvider.buildUrl({ from: '新宿', to: '東京', departure: new Date('2026-12-31T15:00:00Z') })).searchParams
    expect(Object.fromEntries(params)).toMatchObject({ from: '新宿', to: '東京', y: '2027', m: '01', d: '01', hh: '00', m1: '0', m2: '0' })
  })
  it('rejects invalid dates and blank stations', () => {
    expect(() => yahooProvider.buildUrl({ from: ' ', to: '東京', departure: new Date() })).toThrow()
    expect(() => yahooProvider.buildUrl({ from: '新宿', to: '東京', departure: new Date('invalid') })).toThrow()
  })
})
