/**
 * Strategy Library - A static catalog of 20 pre-defined options trading strategies.
 * Each template conforms to the Strategy type (minus `id`) with a stable `templateId`.
 */

import type { Strategy } from '../types/tradingPlan';

export interface StrategyCategory {
  id: string;
  name: string;
  description: string;
  templateIds: string[];
}

export interface OptionsStrategyTemplate extends Omit<Strategy, 'id'> {
  templateId: string;
}

const CATEGORIES: StrategyCategory[] = [
  {
    id: 'directional',
    name: 'Directional',
    description: 'Single-leg directional bets',
    templateIds: ['long-call', 'long-put'],
  },
  {
    id: 'premium-selling',
    name: 'Premium Selling',
    description: 'Selling premium for income',
    templateIds: ['short-call', 'short-put', 'covered-call'],
  },
  {
    id: 'vertical-spreads',
    name: 'Vertical Spreads',
    description: 'Defined-risk directional spreads',
    templateIds: ['bull-call-spread', 'bear-put-spread', 'bull-put-spread', 'bear-call-spread'],
  },
  {
    id: 'iron-strategies',
    name: 'Iron Strategies',
    description: 'Multi-leg neutral income strategies',
    templateIds: ['iron-condor', 'iron-butterfly'],
  },
  {
    id: 'volatility',
    name: 'Volatility',
    description: 'Volatility expansion and contraction plays',
    templateIds: ['long-straddle', 'short-straddle', 'long-strangle', 'short-strangle'],
  },
  {
    id: 'calendar-diagonal',
    name: 'Calendar and Diagonal',
    description: 'Time-based spreads',
    templateIds: ['calendar-spread', 'diagonal-spread'],
  },
  {
    id: 'advanced',
    name: 'Advanced',
    description: 'Complex multi-leg structures',
    templateIds: ['butterfly-spread', 'ratio-spread', 'collar'],
  },
];


const TEMPLATES: OptionsStrategyTemplate[] = [
  // === DIRECTIONAL ===
  {
    templateId: 'long-call',
    name: 'Long Call',
    classification: 'Speculative',
    description:
      'Bullish directional strategy buying a call option to profit from upward price movement. Undefined reward potential with defined risk limited to the premium paid.',
    entryCriteria: [
      { id: 'lc-dte', parameterName: 'DTE', value: '45-90 days' },
      { id: 'lc-delta', parameterName: 'Delta', value: '0.50-0.70 (ATM to slightly ITM)' },
      { id: 'lc-iv', parameterName: 'IV Rank', value: 'Below 30 (cheap premiums)' },
    ],
    managementRules: [
      { id: 'lc-mgmt-1', triggerCondition: 'Stock moves against position by 50% of premium', actionDescription: 'Re-evaluate thesis; consider closing if outlook changed' },
      { id: 'lc-mgmt-2', triggerCondition: 'Position at 21 DTE', actionDescription: 'Roll out to further expiration or close to avoid accelerating time decay' },
    ],
    profitTargets: [
      { id: 'lc-pt-1', targetValue: '50-100% of premium paid', action: 'Close position to lock in gains' },
    ],
    stopLosses: [
      { id: 'lc-sl-1', stopValue: '50% of premium paid', action: 'Close position to limit loss' },
    ],
  },
  {
    templateId: 'long-put',
    name: 'Long Put',
    classification: 'Speculative',
    description:
      'Bearish directional strategy buying a put option to profit from downward price movement. Defined risk limited to the premium paid with large profit potential if the underlying drops significantly.',
    entryCriteria: [
      { id: 'lp-dte', parameterName: 'DTE', value: '45-90 days' },
      { id: 'lp-delta', parameterName: 'Delta', value: '-0.50 to -0.70 (ATM to slightly ITM)' },
      { id: 'lp-iv', parameterName: 'IV Rank', value: 'Below 30 (cheap premiums)' },
    ],
    managementRules: [
      { id: 'lp-mgmt-1', triggerCondition: 'Stock moves against position by 50% of premium', actionDescription: 'Re-evaluate thesis; consider closing if outlook changed' },
      { id: 'lp-mgmt-2', triggerCondition: 'Position at 21 DTE', actionDescription: 'Roll out to further expiration or close to avoid accelerating time decay' },
    ],
    profitTargets: [
      { id: 'lp-pt-1', targetValue: '50-100% of premium paid', action: 'Close position to lock in gains' },
    ],
    stopLosses: [
      { id: 'lp-sl-1', stopValue: '50% of premium paid', action: 'Close position to limit loss' },
    ],
  },

  // === PREMIUM SELLING ===
  {
    templateId: 'short-call',
    name: 'Short Call',
    classification: 'Speculative',
    description:
      'Bearish to neutral strategy selling a naked call option to collect premium. Undefined risk to the upside with profit limited to the premium received. Requires high margin.',
    entryCriteria: [
      { id: 'sc-dte', parameterName: 'DTE', value: '30-45 days' },
      { id: 'sc-delta', parameterName: 'Short Strike Delta', value: '0.16-0.20 (1 SD OTM)' },
      { id: 'sc-ivr', parameterName: 'IV Rank', value: 'Above 50' },
    ],
    managementRules: [
      { id: 'sc-mgmt-1', triggerCondition: 'Short strike tested (delta > 0.30)', actionDescription: 'Roll up and out for a credit if possible' },
      { id: 'sc-mgmt-2', triggerCondition: 'Position at 21 DTE with no profit', actionDescription: 'Close to avoid gamma risk acceleration' },
    ],
    profitTargets: [
      { id: 'sc-pt-1', targetValue: '50% of max profit (premium received)', action: 'Buy back the call to close' },
    ],
    stopLosses: [
      { id: 'sc-sl-1', stopValue: '2x premium received', action: 'Buy back the call to close' },
    ],
  },
  {
    templateId: 'short-put',
    name: 'Short Put',
    classification: 'Core',
    description:
      'Neutral to bullish strategy selling a cash-secured put to collect premium. Undefined risk to the downside (stock can go to zero) with profit limited to the premium received. Core income strategy.',
    entryCriteria: [
      { id: 'sp-dte', parameterName: 'DTE', value: '30-45 days' },
      { id: 'sp-delta', parameterName: 'Short Strike Delta', value: '0.20-0.30' },
      { id: 'sp-ivr', parameterName: 'IV Rank', value: 'Above 30' },
      { id: 'sp-margin', parameterName: 'Buying Power', value: 'Cash secured or margin available for assignment' },
    ],
    managementRules: [
      { id: 'sp-mgmt-1', triggerCondition: 'Short strike tested (delta > 0.40)', actionDescription: 'Roll down and out for a credit' },
      { id: 'sp-mgmt-2', triggerCondition: 'Position at 21 DTE with no profit', actionDescription: 'Close or roll to next cycle' },
    ],
    profitTargets: [
      { id: 'sp-pt-1', targetValue: '50% of max profit', action: 'Buy back the put to close' },
    ],
    stopLosses: [
      { id: 'sp-sl-1', stopValue: '2x premium received', action: 'Buy back the put to close' },
    ],
  },
  {
    templateId: 'covered-call',
    name: 'Covered Call',
    classification: 'Core',
    description:
      'Neutral to mildly bullish strategy selling a call against long stock to generate income. Defined risk (stock ownership) with profit capped at the strike price plus premium received.',
    entryCriteria: [
      { id: 'cc-dte', parameterName: 'DTE', value: '30-45 days' },
      { id: 'cc-delta', parameterName: 'Short Strike Delta', value: '0.20-0.30 (OTM)' },
      { id: 'cc-ivr', parameterName: 'IV Rank', value: 'Above 30' },
      { id: 'cc-shares', parameterName: 'Stock Position', value: 'Own 100 shares per contract sold' },
    ],
    managementRules: [
      { id: 'cc-mgmt-1', triggerCondition: 'Stock rallies through short strike', actionDescription: 'Roll up and out for a credit or allow assignment' },
      { id: 'cc-mgmt-2', triggerCondition: 'Stock drops significantly', actionDescription: 'Let call expire worthless; reassess stock position' },
    ],
    profitTargets: [
      { id: 'cc-pt-1', targetValue: '50% of premium received', action: 'Buy back the call to close; sell new call next cycle' },
    ],
    stopLosses: [
      { id: 'cc-sl-1', stopValue: 'Stock drops below cost basis minus 2x premiums collected', action: 'Close entire position (stock + call)' },
    ],
  },

  // === VERTICAL SPREADS ===
  {
    templateId: 'bull-call-spread',
    name: 'Bull Call Spread',
    classification: 'Speculative',
    description:
      'Bullish strategy buying a call and selling a higher-strike call to reduce cost. Defined risk limited to the net debit paid with defined reward capped at the spread width minus debit.',
    entryCriteria: [
      { id: 'bcs-dte', parameterName: 'DTE', value: '30-60 days' },
      { id: 'bcs-delta', parameterName: 'Long Strike Delta', value: '0.50-0.60 (ATM)' },
      { id: 'bcs-width', parameterName: 'Spread Width', value: '$5 wide (adjust for underlying price)' },
      { id: 'bcs-debit', parameterName: 'Max Debit', value: 'Less than 50% of spread width' },
    ],
    managementRules: [
      { id: 'bcs-mgmt-1', triggerCondition: 'Underlying moves below long strike', actionDescription: 'Close spread if loss exceeds 50% of debit paid' },
      { id: 'bcs-mgmt-2', triggerCondition: 'Position at 21 DTE with less than 50% profit', actionDescription: 'Close to avoid time decay acceleration' },
    ],
    profitTargets: [
      { id: 'bcs-pt-1', targetValue: '50% of max profit', action: 'Close entire spread' },
    ],
    stopLosses: [
      { id: 'bcs-sl-1', stopValue: '50% of debit paid', action: 'Close entire spread' },
    ],
  },
  {
    templateId: 'bear-put-spread',
    name: 'Bear Put Spread',
    classification: 'Speculative',
    description:
      'Bearish strategy buying a put and selling a lower-strike put to reduce cost. Defined risk limited to the net debit paid with defined reward capped at the spread width minus debit.',
    entryCriteria: [
      { id: 'bps-dte', parameterName: 'DTE', value: '30-60 days' },
      { id: 'bps-delta', parameterName: 'Long Strike Delta', value: '-0.50 to -0.60 (ATM)' },
      { id: 'bps-width', parameterName: 'Spread Width', value: '$5 wide (adjust for underlying price)' },
      { id: 'bps-debit', parameterName: 'Max Debit', value: 'Less than 50% of spread width' },
    ],
    managementRules: [
      { id: 'bps-mgmt-1', triggerCondition: 'Underlying moves above long strike', actionDescription: 'Close spread if loss exceeds 50% of debit paid' },
      { id: 'bps-mgmt-2', triggerCondition: 'Position at 21 DTE with less than 50% profit', actionDescription: 'Close to avoid time decay acceleration' },
    ],
    profitTargets: [
      { id: 'bps-pt-1', targetValue: '50% of max profit', action: 'Close entire spread' },
    ],
    stopLosses: [
      { id: 'bps-sl-1', stopValue: '50% of debit paid', action: 'Close entire spread' },
    ],
  },
  {
    templateId: 'bull-put-spread',
    name: 'Bull Put Spread',
    classification: 'Core',
    description:
      'Neutral to bullish credit spread selling a put and buying a lower-strike put. Defined risk limited to the spread width minus credit received. Profits from time decay and the underlying staying above the short strike.',
    entryCriteria: [
      { id: 'bups-dte', parameterName: 'DTE', value: '30-45 days' },
      { id: 'bups-delta', parameterName: 'Short Strike Delta', value: '0.20-0.30' },
      { id: 'bups-ivr', parameterName: 'IV Rank', value: 'Above 30' },
      { id: 'bups-width', parameterName: 'Spread Width', value: '$5 wide (adjust for underlying price)' },
    ],
    managementRules: [
      { id: 'bups-mgmt-1', triggerCondition: 'Short strike tested (delta > 0.40)', actionDescription: 'Roll down and out for a credit' },
      { id: 'bups-mgmt-2', triggerCondition: 'Position at 21 DTE with no profit', actionDescription: 'Close to avoid gamma risk' },
    ],
    profitTargets: [
      { id: 'bups-pt-1', targetValue: '50% of max profit (credit received)', action: 'Close entire spread' },
    ],
    stopLosses: [
      { id: 'bups-sl-1', stopValue: '2x credit received', action: 'Close entire spread' },
    ],
  },
  {
    templateId: 'bear-call-spread',
    name: 'Bear Call Spread',
    classification: 'Core',
    description:
      'Neutral to bearish credit spread selling a call and buying a higher-strike call. Defined risk limited to the spread width minus credit received. Profits from time decay and the underlying staying below the short strike.',
    entryCriteria: [
      { id: 'bcas-dte', parameterName: 'DTE', value: '30-45 days' },
      { id: 'bcas-delta', parameterName: 'Short Strike Delta', value: '0.16-0.20' },
      { id: 'bcas-ivr', parameterName: 'IV Rank', value: 'Above 30' },
      { id: 'bcas-width', parameterName: 'Spread Width', value: '$5 wide (adjust for underlying price)' },
    ],
    managementRules: [
      { id: 'bcas-mgmt-1', triggerCondition: 'Short strike tested (delta > 0.30)', actionDescription: 'Roll up and out for a credit' },
      { id: 'bcas-mgmt-2', triggerCondition: 'Position at 21 DTE with no profit', actionDescription: 'Close to avoid gamma risk' },
    ],
    profitTargets: [
      { id: 'bcas-pt-1', targetValue: '50% of max profit (credit received)', action: 'Close entire spread' },
    ],
    stopLosses: [
      { id: 'bcas-sl-1', stopValue: '2x credit received', action: 'Close entire spread' },
    ],
  },

  // === IRON STRATEGIES ===
  {
    templateId: 'iron-condor',
    name: 'Iron Condor',
    classification: 'Core',
    description:
      'Neutral strategy selling an OTM put spread and OTM call spread simultaneously. Profits from time decay in low-volatility environments. Defined risk on both sides with max loss limited to the wider wing width minus total credit.',
    variants: [
      { id: 'ic-standard', name: 'Standard', description: 'Equal-width wings' },
      { id: 'ic-broken-wing', name: 'Broken Wing', description: 'Unequal wing widths for directional bias' },
    ],
    entryCriteria: [
      { id: 'ic-dte', parameterName: 'DTE', value: '30-45 days' },
      { id: 'ic-delta', parameterName: 'Short Strike Delta', value: '0.16 (1 SD)' },
      { id: 'ic-ivr', parameterName: 'IV Rank', value: 'Above 30' },
      { id: 'ic-width', parameterName: 'Wing Width', value: '$5 wide (adjust for underlying price)' },
    ],
    managementRules: [
      { id: 'ic-mgmt-1', triggerCondition: 'Short strike tested (delta > 0.30)', actionDescription: 'Roll untested side closer to collect additional credit' },
      { id: 'ic-mgmt-2', triggerCondition: 'Position at 21 DTE with no profit', actionDescription: 'Close position to avoid gamma risk' },
    ],
    profitTargets: [
      { id: 'ic-pt-1', targetValue: '50% of max profit', action: 'Close entire position' },
    ],
    stopLosses: [
      { id: 'ic-sl-1', stopValue: '2x credit received', action: 'Close entire position' },
    ],
  },
  {
    templateId: 'iron-butterfly',
    name: 'Iron Butterfly',
    classification: 'Core',
    description:
      'Neutral strategy selling an ATM straddle and buying OTM wings for protection. Higher credit than iron condor but narrower profit zone. Defined risk with max loss limited to wing width minus credit received.',
    variants: [
      { id: 'ib-standard', name: 'Standard', description: 'Symmetric wings around ATM short strikes' },
      { id: 'ib-broken-wing', name: 'Broken Wing', description: 'Asymmetric wings for directional bias' },
    ],
    entryCriteria: [
      { id: 'ib-dte', parameterName: 'DTE', value: '30-45 days' },
      { id: 'ib-strike', parameterName: 'Short Strikes', value: 'ATM (same strike for put and call)' },
      { id: 'ib-ivr', parameterName: 'IV Rank', value: 'Above 30' },
      { id: 'ib-width', parameterName: 'Wing Width', value: '$5-$10 wide' },
    ],
    managementRules: [
      { id: 'ib-mgmt-1', triggerCondition: 'Underlying moves beyond short strike by 1 wing width', actionDescription: 'Close position; do not hold to expiration' },
      { id: 'ib-mgmt-2', triggerCondition: 'Position at 21 DTE', actionDescription: 'Close regardless of P/L to avoid pin risk' },
    ],
    profitTargets: [
      { id: 'ib-pt-1', targetValue: '25% of max profit', action: 'Close entire position' },
    ],
    stopLosses: [
      { id: 'ib-sl-1', stopValue: '2x credit received', action: 'Close entire position' },
    ],
  },

  // === VOLATILITY ===
  {
    templateId: 'long-straddle',
    name: 'Long Straddle',
    classification: 'Speculative',
    description:
      'Volatility expansion strategy buying an ATM call and ATM put simultaneously. Profits from large moves in either direction. Defined risk limited to total premium paid with undefined reward potential.',
    entryCriteria: [
      { id: 'ls-dte', parameterName: 'DTE', value: '30-60 days' },
      { id: 'ls-strike', parameterName: 'Strike Selection', value: 'ATM (nearest to current price)' },
      { id: 'ls-iv', parameterName: 'IV Rank', value: 'Below 30 (cheap premiums before expected move)' },
      { id: 'ls-catalyst', parameterName: 'Catalyst', value: 'Earnings, FDA decision, or other binary event' },
    ],
    managementRules: [
      { id: 'ls-mgmt-1', triggerCondition: 'One side doubles in value', actionDescription: 'Close the profitable side; hold the losing side as a lottery ticket' },
      { id: 'ls-mgmt-2', triggerCondition: 'Position at 21 DTE with no significant move', actionDescription: 'Close to limit time decay losses' },
    ],
    profitTargets: [
      { id: 'ls-pt-1', targetValue: '100% of total premium paid', action: 'Close entire position' },
    ],
    stopLosses: [
      { id: 'ls-sl-1', stopValue: '50% of total premium paid', action: 'Close entire position' },
    ],
  },
  {
    templateId: 'short-straddle',
    name: 'Short Straddle',
    classification: 'Core',
    description:
      'Neutral strategy selling an ATM call and ATM put simultaneously. Profits from time decay when the underlying stays near the strike. Undefined risk on both sides with profit limited to total premium received.',
    entryCriteria: [
      { id: 'ss-dte', parameterName: 'DTE', value: '30-45 days' },
      { id: 'ss-strike', parameterName: 'Strike Selection', value: 'ATM (nearest to current price)' },
      { id: 'ss-ivr', parameterName: 'IV Rank', value: 'Above 50' },
    ],
    managementRules: [
      { id: 'ss-mgmt-1', triggerCondition: 'Underlying moves beyond expected move (1 SD)', actionDescription: 'Roll tested side out in time for a credit' },
      { id: 'ss-mgmt-2', triggerCondition: 'Position at 21 DTE', actionDescription: 'Close to avoid gamma risk regardless of P/L' },
    ],
    profitTargets: [
      { id: 'ss-pt-1', targetValue: '25% of max profit (premium received)', action: 'Close entire position' },
    ],
    stopLosses: [
      { id: 'ss-sl-1', stopValue: '2x premium received', action: 'Close entire position' },
    ],
  },
  {
    templateId: 'long-strangle',
    name: 'Long Strangle',
    classification: 'Speculative',
    description:
      'Volatility expansion strategy buying an OTM call and OTM put. Cheaper than a straddle but requires a larger move to profit. Defined risk limited to total premium paid with undefined reward potential.',
    entryCriteria: [
      { id: 'lsg-dte', parameterName: 'DTE', value: '30-60 days' },
      { id: 'lsg-delta', parameterName: 'Strike Deltas', value: '0.25-0.30 OTM on each side' },
      { id: 'lsg-iv', parameterName: 'IV Rank', value: 'Below 30 (cheap premiums)' },
      { id: 'lsg-catalyst', parameterName: 'Catalyst', value: 'Expected large move from event or breakout' },
    ],
    managementRules: [
      { id: 'lsg-mgmt-1', triggerCondition: 'One side doubles in value', actionDescription: 'Close the profitable side; hold the losing side' },
      { id: 'lsg-mgmt-2', triggerCondition: 'Position at 21 DTE with no significant move', actionDescription: 'Close to limit time decay losses' },
    ],
    profitTargets: [
      { id: 'lsg-pt-1', targetValue: '100% of total premium paid', action: 'Close entire position' },
    ],
    stopLosses: [
      { id: 'lsg-sl-1', stopValue: '50% of total premium paid', action: 'Close entire position' },
    ],
  },
  {
    templateId: 'short-strangle',
    name: 'Short Strangle',
    classification: 'Core',
    description:
      'Neutral strategy selling an OTM call and OTM put simultaneously. Wider profit zone than a short straddle but less premium collected. Undefined risk on both sides with profit limited to total premium received.',
    entryCriteria: [
      { id: 'ssg-dte', parameterName: 'DTE', value: '30-45 days' },
      { id: 'ssg-delta', parameterName: 'Short Strike Deltas', value: '0.16 on each side (1 SD)' },
      { id: 'ssg-ivr', parameterName: 'IV Rank', value: 'Above 30' },
    ],
    managementRules: [
      { id: 'ssg-mgmt-1', triggerCondition: 'Short strike tested (delta > 0.30)', actionDescription: 'Roll tested side out and away for a credit' },
      { id: 'ssg-mgmt-2', triggerCondition: 'Position at 21 DTE', actionDescription: 'Close to avoid gamma risk' },
    ],
    profitTargets: [
      { id: 'ssg-pt-1', targetValue: '50% of max profit (premium received)', action: 'Close entire position' },
    ],
    stopLosses: [
      { id: 'ssg-sl-1', stopValue: '2x premium received', action: 'Close entire position' },
    ],
  },

  // === CALENDAR AND DIAGONAL ===
  {
    templateId: 'calendar-spread',
    name: 'Calendar Spread',
    classification: 'Core',
    description:
      'Neutral strategy selling a near-term option and buying a longer-term option at the same strike. Profits from time decay differential between the two expirations. Defined risk limited to the net debit paid.',
    variants: [
      { id: 'cal-put', name: 'Put Calendar', description: 'Using puts for slight bearish bias' },
      { id: 'cal-call', name: 'Call Calendar', description: 'Using calls for slight bullish bias' },
    ],
    entryCriteria: [
      { id: 'cal-front-dte', parameterName: 'Front Month DTE', value: '25-35 days' },
      { id: 'cal-back-dte', parameterName: 'Back Month DTE', value: '50-70 days' },
      { id: 'cal-strike', parameterName: 'Strike Selection', value: 'ATM or slightly OTM' },
      { id: 'cal-ivr', parameterName: 'IV Rank', value: 'Low to moderate (below 50)' },
    ],
    managementRules: [
      { id: 'cal-mgmt-1', triggerCondition: 'Underlying moves beyond breakeven', actionDescription: 'Close position; calendars have narrow profit zones' },
      { id: 'cal-mgmt-2', triggerCondition: 'Front month at 7 DTE', actionDescription: 'Close or roll front month to next expiration' },
    ],
    profitTargets: [
      { id: 'cal-pt-1', targetValue: '25-50% of debit paid', action: 'Close entire position' },
    ],
    stopLosses: [
      { id: 'cal-sl-1', stopValue: '50% of debit paid', action: 'Close entire position' },
    ],
  },
  {
    templateId: 'diagonal-spread',
    name: 'Diagonal Spread',
    classification: 'Core',
    description:
      'Bullish or bearish time spread selling a near-term OTM option and buying a longer-term option at a different strike. Combines directional bias with time decay income. Defined risk limited to the net debit paid.',
    variants: [
      { id: 'diag-bull', name: 'Bullish Diagonal', description: 'Long call further out, short call near-term higher strike' },
      { id: 'diag-bear', name: 'Bearish Diagonal', description: 'Long put further out, short put near-term lower strike' },
    ],
    entryCriteria: [
      { id: 'diag-front-dte', parameterName: 'Front Month DTE', value: '25-35 days' },
      { id: 'diag-back-dte', parameterName: 'Back Month DTE', value: '50-90 days' },
      { id: 'diag-long-delta', parameterName: 'Long Strike Delta', value: '0.60-0.70 (ITM)' },
      { id: 'diag-short-delta', parameterName: 'Short Strike Delta', value: '0.20-0.30 (OTM)' },
    ],
    managementRules: [
      { id: 'diag-mgmt-1', triggerCondition: 'Short strike tested', actionDescription: 'Roll short strike up/out for a credit' },
      { id: 'diag-mgmt-2', triggerCondition: 'Front month at 7 DTE', actionDescription: 'Close or roll front month to next expiration' },
    ],
    profitTargets: [
      { id: 'diag-pt-1', targetValue: '25-50% of debit paid', action: 'Close entire position' },
    ],
    stopLosses: [
      { id: 'diag-sl-1', stopValue: '50% of debit paid', action: 'Close entire position' },
    ],
  },

  // === ADVANCED ===
  {
    templateId: 'butterfly-spread',
    name: 'Butterfly Spread',
    classification: 'Core',
    description:
      'Neutral strategy combining a bull spread and bear spread with a shared middle strike. Very low cost with defined risk limited to the net debit. Profits when the underlying pins near the middle strike at expiration.',
    variants: [
      { id: 'bfly-call', name: 'Call Butterfly', description: 'All calls: buy 1 lower, sell 2 middle, buy 1 upper' },
      { id: 'bfly-put', name: 'Put Butterfly', description: 'All puts: buy 1 upper, sell 2 middle, buy 1 lower' },
      { id: 'bfly-iron', name: 'Iron Butterfly', description: 'Mixed: sell ATM straddle, buy OTM strangle' },
    ],
    entryCriteria: [
      { id: 'bfly-dte', parameterName: 'DTE', value: '14-30 days' },
      { id: 'bfly-strike', parameterName: 'Middle Strike', value: 'ATM (expected pin price)' },
      { id: 'bfly-width', parameterName: 'Wing Width', value: 'Equal width on both sides ($5-$10)' },
    ],
    managementRules: [
      { id: 'bfly-mgmt-1', triggerCondition: 'Underlying moves beyond wing strikes', actionDescription: 'Close position; max loss is the debit paid' },
      { id: 'bfly-mgmt-2', triggerCondition: 'Position at 7 DTE and near max profit', actionDescription: 'Close to lock in gains; avoid pin risk at expiration' },
    ],
    profitTargets: [
      { id: 'bfly-pt-1', targetValue: '50% of max profit', action: 'Close entire position' },
    ],
    stopLosses: [
      { id: 'bfly-sl-1', stopValue: '100% of debit paid (let expire worthless)', action: 'Close if underlying moves well beyond wings' },
    ],
  },
  {
    templateId: 'ratio-spread',
    name: 'Ratio Spread',
    classification: 'Speculative',
    description:
      'Bullish or bearish strategy buying one option and selling two or more further OTM options. Can be entered for a credit or small debit. Undefined risk beyond the short strikes with defined risk on the long side.',
    variants: [
      { id: 'ratio-call', name: 'Call Ratio', description: 'Buy 1 ATM call, sell 2 OTM calls' },
      { id: 'ratio-put', name: 'Put Ratio', description: 'Buy 1 ATM put, sell 2 OTM puts' },
    ],
    entryCriteria: [
      { id: 'ratio-dte', parameterName: 'DTE', value: '30-45 days' },
      { id: 'ratio-ratio', parameterName: 'Ratio', value: '1:2 (buy 1, sell 2)' },
      { id: 'ratio-ivr', parameterName: 'IV Rank', value: 'Above 30' },
      { id: 'ratio-credit', parameterName: 'Net Credit/Debit', value: 'Enter for a credit or zero cost if possible' },
    ],
    managementRules: [
      { id: 'ratio-mgmt-1', triggerCondition: 'Underlying approaches short strikes', actionDescription: 'Close position or buy back extra short options' },
      { id: 'ratio-mgmt-2', triggerCondition: 'Position at 21 DTE', actionDescription: 'Close to avoid gamma risk on naked short leg' },
    ],
    profitTargets: [
      { id: 'ratio-pt-1', targetValue: 'Underlying at short strike at expiration (max profit zone)', action: 'Close entire position' },
    ],
    stopLosses: [
      { id: 'ratio-sl-1', stopValue: 'Underlying moves 1 spread width beyond short strikes', action: 'Close entire position' },
    ],
  },
  {
    templateId: 'collar',
    name: 'Collar',
    classification: 'Core',
    description:
      'Neutral hedging strategy combining a covered call with a protective put on existing stock. Defined risk on both sides: downside protected by the put, upside capped by the call. Often entered for zero or near-zero cost.',
    entryCriteria: [
      { id: 'col-dte', parameterName: 'DTE', value: '30-60 days' },
      { id: 'col-put-delta', parameterName: 'Put Strike Delta', value: '-0.20 to -0.30 (OTM protective put)' },
      { id: 'col-call-delta', parameterName: 'Call Strike Delta', value: '0.20-0.30 (OTM covered call)' },
      { id: 'col-cost', parameterName: 'Net Cost', value: 'Zero cost or small net credit' },
    ],
    managementRules: [
      { id: 'col-mgmt-1', triggerCondition: 'Stock rallies through call strike', actionDescription: 'Allow assignment or roll call up and out' },
      { id: 'col-mgmt-2', triggerCondition: 'Stock drops to put strike', actionDescription: 'Exercise put or close collar and reassess stock position' },
    ],
    profitTargets: [
      { id: 'col-pt-1', targetValue: 'Stock at call strike (max profit on upside)', action: 'Allow assignment or roll to next cycle' },
    ],
    stopLosses: [
      { id: 'col-sl-1', stopValue: 'Stock at put strike (max loss on downside)', action: 'Exercise put to exit stock position' },
    ],
  },
];


// === HELPER FUNCTIONS ===

export function getAllTemplates(): OptionsStrategyTemplate[] {
  return TEMPLATES;
}

export function getCategories(): StrategyCategory[] {
  return CATEGORIES;
}

export function getTemplatesByCategory(categoryId: string): OptionsStrategyTemplate[] {
  const category = CATEGORIES.find((c) => c.id === categoryId);
  if (!category) return [];
  return TEMPLATES.filter((t) => category.templateIds.includes(t.templateId));
}

export function getTemplateById(templateId: string): OptionsStrategyTemplate | undefined {
  return TEMPLATES.find((t) => t.templateId === templateId);
}
