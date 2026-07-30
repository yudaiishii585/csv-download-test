'use strict';
/**
 * ひなた製菓 販売管理システム（研修用）のダミー売上データ。
 *
 * 乱数は使わず、条件から決まる値だけで組み立てている。
 * 同じ条件で検索すれば毎回まったく同じ数字が出るので、
 * 研修当日に「答え合わせ」ができる。
 *
 * このファイルはブラウザから読み込まれ、window.SalesData に公開される。
 */

(function (global) {

  // ── マスタ ──────────────────────────────────────────

  const STORES = ['本店', '駅前店', '催事', 'オンライン'];

  // カテゴリ名 → 商品リスト。単価は円。
  // ひなたバターサンドだけは 2026-01 から値上げ。
  const CATEGORIES = {
    '焼き菓子': [
      { name: '能登塩サブレ', price: 800 },
      { name: 'ひなたバターサンド', price: 1600, priceFrom2026: 1800 },
      { name: '加賀ミルフィユ', price: 2000 },
    ],
    '生菓子': [
      { name: '白山プリン', price: 480 },
      { name: '兼六ロール', price: 1400 },
      { name: 'いちごショート', price: 620 },
    ],
    'ギフト': [
      { name: '詰合せ 大', price: 4800 },
      { name: '詰合せ 小', price: 2600 },
      { name: 'のし対応セット', price: 3400 },
    ],
    '季節限定': [
      { name: '桜サブレ', price: 900 },
      { name: '氷菓詰合せ', price: 2200 },
      { name: '栗きんとん風', price: 1500 },
    ],
    'その他': [
      { name: '端材パック', price: 300 },
      { name: 'ドリンク', price: 200 },
      { name: '保冷剤', price: 100 },
    ],
  };

  // FY2025（2025年4月〜2026年3月）
  const MONTHS = [
    '2025-04', '2025-05', '2025-06', '2025-07', '2025-08', '2025-09',
    '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03',
  ];

  // 各月この3日分だけデータがある（1ファイルを見やすい行数に収めるため）
  const DAYS = [5, 15, 25];

  // カテゴリ名 → CSVファイル名用のローマ字
  const ROMAJI = {
    '焼き菓子': 'yakigashi',
    '生菓子': 'namagashi',
    'ギフト': 'gift',
    '季節限定': 'kisetsu',
    'その他': 'sonota',
  };

  // ── 数量の決め方 ────────────────────────────────────

  /**
   * FNV-1a ハッシュ。文字列を「毎回同じ数値」に変える。
   * ランダムに見えるが実際は完全に決まった値。
   */
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h;
  }

  /** 店舗の規模差 */
  const STORE_SCALE = { '本店': 1.0, '駅前店': 0.7, '催事': 0.9, 'オンライン': 0.5 };

  /** 季節限定は夏と年末に伸び、ギフトは12月に跳ねる */
  function seasonScale(category, month) {
    const m = Number(month.slice(5, 7));
    if (category === '季節限定') return (m === 7 || m === 8 || m === 12) ? 1.8 : 0.6;
    if (category === 'ギフト') return (m === 12) ? 2.4 : (m === 3 ? 1.3 : 0.8);
    if (category === '生菓子') return (m >= 6 && m <= 8) ? 0.7 : 1.1;
    return 1.0;
  }

  function quantityFor(month, day, store, category, product) {
    const base = 4 + (hash(month + '|' + day + '|' + store + '|' + product) % 22); // 4〜25
    const scaled = base * STORE_SCALE[store] * seasonScale(category, month);
    return Math.max(1, Math.round(scaled));
  }

  function priceFor(product, month) {
    if (product.priceFrom2026 && month >= '2026-01') return product.priceFrom2026;
    return product.price;
  }

  // ── 行の組み立て ────────────────────────────────────

  /**
   * 検索条件から明細行を作る。
   * @param {string} month    '2025-10' のような対象月（必須・1つだけ）
   * @param {string} category カテゴリ名（必須・1つだけ）
   * @param {string} store    店舗名。'すべて' なら全店舗
   */
  function buildRows(month, category, store) {
    const products = CATEGORIES[category];
    if (!products || MONTHS.indexOf(month) === -1) return [];

    const targetStores = (store && store !== 'すべて') ? [store] : STORES;
    const rows = [];

    for (const day of DAYS) {
      for (const s of targetStores) {
        for (const p of products) {
          const qty = quantityFor(month, day, s, category, p.name);
          const unit = priceFor(p, month);
          rows.push({
            date: month + '-' + String(day).padStart(2, '0'),
            store: s,
            category: category,
            product: p.name,
            quantity: qty,
            unitPrice: unit,
            amount: qty * unit,
          });
        }
      }
    }
    return rows;
  }

  // ── CSV ────────────────────────────────────────────

  const CSV_HEADER = ['日付', '店舗', 'カテゴリ', '商品名', '数量', '単価', '売上金額'];

  /**
   * 行の配列を CSV 文字列にする。
   * Excel でそのまま開けるように BOM 付き・改行は CRLF。
   */
  function toCsv(rows) {
    const escape = function (v) {
      const s = String(v);
      return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [CSV_HEADER.join(',')];
    for (const r of rows) {
      lines.push([r.date, r.store, r.category, r.product, r.quantity, r.unitPrice, r.amount]
        .map(escape).join(','));
    }
    return '﻿' + lines.join('\r\n') + '\r\n';
  }

  /** ダウンロード時のファイル名 */
  function csvFilename(month, category) {
    return '売上_' + month + '_' + category + '.csv';
  }

  global.SalesData = {
    STORES: STORES,
    CATEGORIES: CATEGORIES,
    MONTHS: MONTHS,
    ROMAJI: ROMAJI,
    buildRows: buildRows,
    toCsv: toCsv,
    csvFilename: csvFilename,
    categoryNames: function () { return Object.keys(CATEGORIES); },
  };

})(window);
