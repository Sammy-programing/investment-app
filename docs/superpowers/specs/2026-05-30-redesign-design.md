# 設計リファクタリング仕様書

**日付:** 2026-05-30  
**対象:** `investment-app` — Next.js 16 投資管理アプリ  
**目的:** コードの保守性向上。ロジックをカスタムフックへ分離し、機能別フォルダ構成に整理する。

---

## 背景と課題

現状のコードには以下の問題がある。

- `src/app/page.tsx`（189行）が全状態管理・API呼び出し・フィルタリングロジックを一手に担っている
- `src/components/StockScreening.tsx`（294行）に同期ジョブ管理・スクリーニング条件・結果表示が混在している
- `src/components/AIAdviceChat.tsx`にストリーミング受信ロジックがコンポーネント内に直書きされている
- コンポーネントから直接`fetch`を呼んでいるため、APIエンドポイントの変更影響が広範囲に及ぶ

---

## 変更しないもの

- `src/app/api/` 配下のルートハンドラー（全て据え置き）
- `src/types/index.ts`
- `prisma/schema.prisma`
- `package.json` の依存関係（新規ライブラリ追加なし）

---

## 新しいファイル構成

```
src/
  app/
    page.tsx              ← タブ切り替えのみ（~40行）
    layout.tsx            ← 変更なし
    api/                  ← 変更なし
  features/
    portfolio/
      components/
        PortfolioTable.tsx
        HoldingModal.tsx
        ProfitLossCard.tsx
      hooks/
        useHoldings.ts
        usePortfolioStats.ts
    screening/
      components/
        StockScreening.tsx
      hooks/
        useScreening.ts
        useStockSync.ts
    ai-advice/
      components/
        AIAdviceChat.tsx
      hooks/
        useAIChat.ts
    charts/
      components/
        PortfolioChart.tsx
  services/
    holdingsApi.ts
    stocksApi.ts
    aiApi.ts
  types/
    index.ts              ← 変更なし
```

既存の `src/components/` 内ファイルは `src/features/` 配下の対応する `components/` フォルダへ移動する。
`src/data/nikkei225.ts` と `src/lib/prisma.ts` は移動しない（`src/lib/`・`src/data/` をそのまま維持）。
`src/components/ScreeningPanel.tsx`（現在未使用）は削除する。

---

## Servicesレイヤー

API呼び出しをservices関数として一元管理する。フック・コンポーネントは直接`fetch`を呼ばない。

```ts
// services/holdingsApi.ts
fetchHoldings(q?: string, sector?: string): Promise<Holding[]>
createHolding(data: Omit<Holding, "id">): Promise<Holding>
updateHolding(id: string, data: Partial<Holding>): Promise<Holding>
deleteHolding(id: string): Promise<void>

// services/stocksApi.ts
searchStocks(params: Record<string, string>): Promise<Stock[]>
syncStocks(jobId?: string): Promise<SyncJobResult>  // SyncJobResult は stocksApi.ts 内でローカル定義
getSyncCount(): Promise<{ total: number }>
seedNikkei225(): Promise<{ seeded: number }>
importStocksCsv(text: string): Promise<{ imported: number }>

// services/aiApi.ts
streamAIAdvice(
  messages: ChatMessage[],
  holdings: Holding[]
): Promise<ReadableStreamDefaultReader<Uint8Array>>
```

各services関数はレスポンスが`!ok`のとき`Error`をthrowする。エラーハンドリングは呼び出し元フックの`try/catch`で行う。

---

## カスタムフック設計

### `useHoldings` (`features/portfolio/hooks/useHoldings.ts`)

ポートフォリオタブの状態管理を一手に担う。

```ts
const {
  holdings,       // フィルター・検索適用済みリスト（テーブル表示用）
  allHoldings,    // フィルター前の全件（stats計算用）
  loading,
  searchQuery, setSearchQuery,
  sectorFilter, setSectorFilter,
  save,           // create/update を統合（idの有無で分岐）
  remove,
} = useHoldings()
```

- 検索・セクターフィルターの変更は300msデバウンスでAPIを呼ぶ
- `save`は`data.id`の有無でPUT/POSTを切り替え、完了後に再取得する

### `usePortfolioStats` (`features/portfolio/hooks/usePortfolioStats.ts`)

```ts
const stats = usePortfolioStats(holdings: Holding[]): PortfolioStats
```

現在`page.tsx`内の`calcStats`関数をフック化したもの。純粋な計算のみ（副作用なし）。

### `useAIChat` (`features/ai-advice/hooks/useAIChat.ts`)

```ts
const { messages, input, setInput, send, loading } = useAIChat(holdings: Holding[])
```

- ストリーミング受信ロジックを封じ込める
- エラー時はassistantメッセージをエラー文言に置き換える

### `useScreening` (`features/screening/hooks/useScreening.ts`)

```ts
const { criteria, set, results, searching, screen, reset } = useScreening()
```

- スクリーニング条件の状態とAPI呼び出しを管理する

### `useStockSync` (`features/screening/hooks/useStockSync.ts`)

```ts
const { sync, start, stop, seeding, seed, importing, importCsv } = useStockSync()
```

- `syncRef`による停止制御をこのフック内に完全に封じ込める
- seed・CSVインポートの状態もここで管理する

---

## `page.tsx` のリファクタリング後イメージ

```tsx
export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("portfolio")
  const { holdings, allHoldings, ...portfolioProps } = useHoldings()
  const stats = usePortfolioStats(allHoldings)

  return (
    <div>
      <Header onAdd={...} />
      <ProfitLossCard stats={stats} />
      <TabBar activeTab={activeTab} onChange={setActiveTab} />
      {activeTab === "portfolio" && <PortfolioTab {...portfolioProps} holdings={holdings} />}
      {activeTab === "chart" && <PortfolioChart holdings={allHoldings} />}
      {activeTab === "screening" && <StockScreening />}
      {activeTab === "ai" && <AIAdviceChat holdings={allHoldings} />}
    </div>
  )
}
```

---

## 移行方針

1. `services/` を先に作成し、既存コードのfetchをservices関数に置き換えるテストをする
2. フックを機能ごとに作成し、コンポーネントから移植する
3. コンポーネントを `features/` 配下へ移動する
4. `page.tsx` をフック呼び出しのみに絞り込む
5. `src/components/`（旧）が空になったら削除する

各ステップはアプリが動作する状態を維持しながら進める。

---

## 成功基準

- `page.tsx` が50行以下になる
- 各コンポーネントが直接`fetch`を呼ばない
- 各フックが単一の機能ドメインに閉じている
- 既存の全機能（ポートフォリオCRUD・スクリーニング・AI・チャート）が動作し続ける
