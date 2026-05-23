// Supabase Edge Function: Fetch stock quotes + dividend data from Yahoo Finance
// Deploy: npx supabase functions deploy stock-quote --project-ref <your-project-ref>

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function detectDividendFrequency(dividends: { amount: number; date: number }[]): 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'none' {
  if (dividends.length < 2) return dividends.length === 0 ? 'none' : 'yearly'
  const sorted = [...dividends].sort((a, b) => a.date - b.date)
  let totalGapDays = 0
  for (let i = 1; i < sorted.length; i++) {
    totalGapDays += (sorted[i].date - sorted[i - 1].date) / (60 * 60 * 24)
  }
  const avgGap = totalGapDays / (sorted.length - 1)
  if (avgGap <= 10) return 'weekly'
  if (avgGap <= 40) return 'monthly'
  if (avgGap <= 100) return 'quarterly'
  return 'yearly'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const symbols = url.searchParams.get('symbols')

    if (!symbols) {
      return new Response(
        JSON.stringify({ error: 'Missing symbols parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const symbolList = symbols.split(',').map(s => s.trim().toUpperCase()).slice(0, 20)

    const results: Record<string, {
      price: number
      previousClose: number
      change: number
      changePercent: number
      dividendYield: number
      dividendRate: number
      dividendFrequency: string
      name: string
    }> = {}

    await Promise.all(symbolList.map(async (symbol) => {
      try {
        const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1mo&range=1y&events=div`
        const resp = await fetch(chartUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TradingParadise/1.0)' },
        })
        if (!resp.ok) return

        const data = await resp.json()
        const result = data?.chart?.result?.[0]
        if (!result) return

        const meta = result.meta
        const price = meta.regularMarketPrice ?? meta.previousClose ?? 0
        const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? price
        const change = price - previousClose
        const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0

        let dividendRate = 0
        let dividendFrequency = 'none'
        const dividends = result.events?.dividends
        if (dividends && typeof dividends === 'object') {
          const divValues = Object.values(dividends) as { amount: number; date: number }[]
          dividendRate = divValues.reduce((sum, d) => sum + (d.amount ?? 0), 0)
          dividendFrequency = detectDividendFrequency(divValues)
        }

        const dividendYield = price > 0 ? (dividendRate / price) * 100 : 0

        results[symbol] = {
          price,
          previousClose,
          change,
          changePercent,
          dividendYield,
          dividendRate,
          dividendFrequency,
          name: meta.shortName ?? meta.symbol ?? symbol,
        }
      } catch {}
    }))

    return new Response(
      JSON.stringify({ quotes: results, fetchedAt: new Date().toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
