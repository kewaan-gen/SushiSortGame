/**
 * Compact level encoding string codec.
 *
 * Format:
 *   <queues> :: <customers> :: <seats>S
 *
 *   queues    = lane0 | lane1 | ...      where lane = comma-separated letters, front first
 *   customers = D{demand}, ...           e.g. A4,B4,C3
 *   seats     = integer + 'S'
 *
 * Example:
 *   "A,A,B,C|C,C,A,B|B,A,D,D::A4,B4,C4,D4::4S"
 */

import { DishLetter, DISH_LETTERS, ForgeCustomer } from './types';

export interface DecodedLevel {
  queues: DishLetter[][];
  customers: ForgeCustomer[];
  numSeats: number;
}

const isDishLetter = (s: string): s is DishLetter =>
  (DISH_LETTERS as readonly string[]).includes(s);

export function encodeLevel(
  queues: DishLetter[][],
  customers: ForgeCustomer[],
  numSeats: number,
): string {
  const q = queues.map((lane) => lane.join(',')).join('|');
  const c = customers.map((cust) => `${cust.dish}${cust.demand}`).join(',');
  return `${q}::${c}::${numSeats}S`;
}

export function decodeLevel(encoding: string): DecodedLevel {
  const parts = encoding.split('::');
  if (parts.length !== 3) {
    throw new Error(`Invalid encoding: expected 3 sections, got ${parts.length}`);
  }

  const [qPart, cPart, sPart] = parts;

  const queues: DishLetter[][] = qPart.split('|').map((lane, laneIdx) =>
    lane
      .split(',')
      .map((tok) => tok.trim())
      .filter((tok) => tok.length > 0)
      .map((tok) => {
        if (!isDishLetter(tok)) {
          throw new Error(`Invalid dish "${tok}" in lane ${laneIdx}`);
        }
        return tok;
      }),
  );

  const customers: ForgeCustomer[] = cPart
    .split(',')
    .map((tok) => tok.trim())
    .filter((tok) => tok.length > 0)
    .map((tok) => {
      const dish = tok[0];
      const demand = parseInt(tok.slice(1), 10);
      if (!isDishLetter(dish) || Number.isNaN(demand)) {
        throw new Error(`Invalid customer token "${tok}"`);
      }
      return { dish, demand };
    });

  const numSeats = parseInt(sPart.replace(/[^0-9]/g, ''), 10);
  if (Number.isNaN(numSeats)) {
    throw new Error(`Invalid seats section "${sPart}"`);
  }

  return { queues, customers, numSeats };
}
