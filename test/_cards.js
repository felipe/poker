// Tiny card-string parser shared by the test files. Uses standard poker
// notation: rank ∈ 23456789TJQKA, suit ∈ shdc.
//   card("Ah") → ace of hearts → { rank: 14, suit: 1 }
//   hand("As","Kh","Qd","Jc","Ts") → royal-flush-ish array of five cards

const RANK = { "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, T: 10, J: 11, Q: 12, K: 13, A: 14 };
const SUIT = { s: 0, h: 1, d: 2, c: 3 };

/** @param {string} s e.g. "Ah" */
export function card(s) {
  return { rank: RANK[s[0]], suit: SUIT[s[1]] };
}

/** @param {...string} strs */
export function hand(...strs) {
  return strs.map(card);
}
