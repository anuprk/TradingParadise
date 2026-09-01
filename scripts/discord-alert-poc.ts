/**
 * Runnable demo for the Discord trade-alert parser POC.
 *
 * Parses each sample alert in DISCORD_ALERT_EXAMPLES and prints a readable
 * summary of the extracted fields to the console. Intended for manual
 * inspection of parsing quality; it does not touch the UI, database, or any
 * app state.
 *
 * Run with:  npx tsx scripts/discord-alert-poc.ts
 *        or: npm run poc:discord
 */

import { parseDiscordAlert } from '../src/utils/parsers/discordAlertParser';
import { DISCORD_ALERT_EXAMPLES } from '../src/utils/parsers/__fixtures__/discordAlertExamples';

const SEPARATOR = '='.repeat(72);

function truncate(text: string, max = 200): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length > max ? `${collapsed.slice(0, max)}…` : collapsed;
}

function fmt(value: unknown): string {
  if (value === null || value === undefined) return '(none)';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '(none)';
  return String(value);
}

function main(): void {
  console.log(SEPARATOR);
  console.log('Discord Trade-Alert Parser POC');
  console.log(`${DISCORD_ALERT_EXAMPLES.length} example(s)`);
  console.log(SEPARATOR);

  DISCORD_ALERT_EXAMPLES.forEach((example, index) => {
    const parsed = parseDiscordAlert(example.rawContent, {
      community: example.community,
      chatRoom: example.chatRoom,
    });

    console.log('');
    console.log(`Example ${index + 1}`);
    console.log('-'.repeat(72));
    console.log(`community          : ${example.community}`);
    console.log(`chatRoom           : ${example.chatRoom}`);
    console.log(`messageId          : ${parsed.messageId}`);
    console.log(`actionType         : ${fmt(parsed.actionType)}`);
    console.log(`symbol             : ${fmt(parsed.symbol)}`);
    console.log(`strategy           : ${fmt(parsed.strategy)}`);
    console.log(`expiration         : ${fmt(parsed.expiration)}`);
    console.log(`strikes            : ${fmt(parsed.strikes)}`);
    console.log(`direction          : ${fmt(parsed.direction)}`);
    console.log(`fillPrice          : ${fmt(parsed.fillPrice)}`);
    console.log(`amount             : ${fmt(parsed.amount)}`);
    console.log(`amountKind         : ${fmt(parsed.amountKind)}`);
    console.log(`links              : ${fmt(parsed.links)}`);
    console.log(`extractedAnyField  : ${fmt(parsed.extractedAnyField)}`);
    console.log(`rawContent         : ${truncate(parsed.rawContent)}`);
  });

  console.log('');
  console.log(SEPARATOR);
  console.log('Done.');
  console.log(SEPARATOR);
}

main();
