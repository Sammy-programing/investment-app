// src/services/jquantsApi.ts
const BASE = "https://api.jquants.com/v1";

export interface JQuantsListedInfo {
  Code: string;             // "72030"（5桁）
  CompanyName: string;
  Sector33CodeName: string;
  MarketCodeName: string;
}

export interface JQuantsQuote {
  Code: string;
  Close: number | null;
  TurnoverValue: number | null;
}

export interface JQuantsStatement {
  Code: string;
  DisclosedDate: string;    // "2024-02-06"
  EarningsPerShare: string; // 文字列で返される
  BookValuePerShare: string;
}

export interface JQuantsDividend {
  Code: string;
  ReferenceDate: string;    // "2024-03-29"
  AnnualDividendPerShare: string;
}

async function getRefreshToken(): Promise<string> {
  const res = await fetch(`${BASE}/token/auth_user`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mailaddress: process.env.JQUANTS_EMAIL,
      password: process.env.JQUANTS_PASSWORD,
    }),
  });
  if (!res.ok) throw new Error(`J-Quants auth_user failed: ${res.status}`);
  const data = await res.json();
  return data.refreshToken as string;
}

async function getIdTokenFromRefresh(refreshToken: string): Promise<string> {
  const res = await fetch(`${BASE}/token/auth_refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshtoken: refreshToken }),
  });
  if (!res.ok) throw new Error(`J-Quants auth_refresh failed: ${res.status}`);
  const data = await res.json();
  return data.idToken as string;
}

export async function getJQuantsToken(): Promise<string> {
  const refreshToken = await getRefreshToken();
  return getIdTokenFromRefresh(refreshToken);
}

async function fetchAllPages<T>(idToken: string, path: string, key: string): Promise<T[]> {
  const results: T[] = [];
  let paginationKey: string | undefined;

  do {
    const url = new URL(`${BASE}${path}`);
    if (paginationKey) url.searchParams.set("pagination_key", paginationKey);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) throw new Error(`J-Quants ${path} failed: ${res.status}`);
    const data = await res.json();

    const items = data[key];
    if (Array.isArray(items)) results.push(...items);
    paginationKey = data.pagination_key as string | undefined;
  } while (paginationKey);

  return results;
}

export async function fetchListedInfo(idToken: string): Promise<JQuantsListedInfo[]> {
  return fetchAllPages<JQuantsListedInfo>(idToken, "/listed/info", "info");
}

export function getPreviousTradingDate(): string {
  const d = new Date();
  // 土曜(6)→金曜(-1日), 日曜(0)→金曜(-2日), 月曜(1)→金曜(-3日), それ以外→前日
  const offsets: Record<number, number> = { 6: 1, 0: 2, 1: 3 };
  const offset = offsets[d.getDay()] ?? 1;
  d.setDate(d.getDate() - offset);
  return d.toISOString().slice(0, 10).replace(/-/g, ""); // "YYYYMMDD"
}

export async function fetchDailyQuotes(idToken: string, date: string): Promise<JQuantsQuote[]> {
  return fetchAllPages<JQuantsQuote>(idToken, `/prices/daily_quotes?date=${date}`, "daily_quotes");
}

export async function fetchFinStatements(idToken: string): Promise<JQuantsStatement[]> {
  return fetchAllPages<JQuantsStatement>(idToken, "/fins/statements", "statements");
}

export async function fetchDividend(idToken: string): Promise<JQuantsDividend[]> {
  return fetchAllPages<JQuantsDividend>(idToken, "/fins/dividend", "dividend");
}
