/**
 * Sample Discord trade-alert messages used by the parser POC demo script and
 * unit tests. Each entry mirrors the shape of a real alert captured from a
 * community chat room. The rawContent strings are verbatim samples and must
 * not be edited, as tests assert against their exact parsed output.
 */

export interface DiscordAlertExample {
  community: string;
  chatRoom: string;
  rawContent: string;
}

export const DISCORD_ALERT_EXAMPLES: DiscordAlertExample[] = [
  {
    community: 'OptionsKit',
    chatRoom: 'income-trades',
    rawContent: `BTO TSM 450/460 Call Spread @ 2.8 debit

⛽ Fill Range: $2.8

🎯 Profit Target:
50% or higher

This has a 257% upside

⛔ No Stop Loss:
Max risk is only $280/contract. It can go to zero.
Size accordingly.

Starting with a small position with a plan to avg down if the stock comes down.

BUY +1 VERTICAL TSM 100 16 OCT 26 450/460 CALL @2.80 LMT

https://optionstrat.com/n0gz0pC43bcX

@everyone`,
  },
  {
    community: "Mak's Money Maker Club",
    chatRoom: 'elite-trade-alerts',
    rawContent: `NEW OPEN TRADE: NVDA
STRATEGY: PORTFOLIO SECURED PUT EXPIRING 2/19/27

STO 2/19/27 190p

FILLED AT: $890 CREDIT (per contract)

SENTIMENT: Neutral to Bullish
POTENTIAL MAX RETURN ON PREMIUM: 100%
MARGIN REQUIREMENT:$2,161

@everyone

Selling 2 short puts for NVDA

I will sell MORE if there is more drawdown in NVDA over the next few days/weeks. So layer these contracts accordingly.`,
  },
  {
    community: 'MRTOPTICK',
    chatRoom: 'igor-in-trades',
    rawContent: `This is an unbalanced Iron Condor, 50 point wide put credit spread + 30 point wide call credit spread.

Credit: 8.75
Margin: 41.25
Implied POP: 82%
🎯 PT: 4.75 debit
🪓 SL:14.00 debit`,
  },
];
