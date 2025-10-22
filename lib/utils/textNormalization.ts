/**
 * テキスト正規化ユーティリティ
 * 半角カタカナ→全角カタカナ、全角数字→半角数字の変換
 */

/**
 * 半角カタカナを全角カタカナに変換
 */
export function convertHalfWidthKanaToFullWidth(str: string): string {
  const kanaMap: { [key: string]: string } = {
    'ｶﾞ': 'ガ', 'ｷﾞ': 'ギ', 'ｸﾞ': 'グ', 'ｹﾞ': 'ゲ', 'ｺﾞ': 'ゴ',
    'ｻﾞ': 'ザ', 'ｼﾞ': 'ジ', 'ｽﾞ': 'ズ', 'ｾﾞ': 'ゼ', 'ｿﾞ': 'ゾ',
    'ﾀﾞ': 'ダ', 'ﾁﾞ': 'ヂ', 'ﾂﾞ': 'ヅ', 'ﾃﾞ': 'デ', 'ﾄﾞ': 'ド',
    'ﾊﾞ': 'バ', 'ﾋﾞ': 'ビ', 'ﾌﾞ': 'ブ', 'ﾍﾞ': 'ベ', 'ﾎﾞ': 'ボ',
    'ﾊﾟ': 'パ', 'ﾋﾟ': 'ピ', 'ﾌﾟ': 'プ', 'ﾍﾟ': 'ペ', 'ﾎﾟ': 'ポ',
    'ｳﾞ': 'ヴ', 'ﾜﾞ': 'ヷ', 'ｦﾞ': 'ヺ',
    'ｱ': 'ア', 'ｲ': 'イ', 'ｳ': 'ウ', 'ｴ': 'エ', 'ｵ': 'オ',
    'ｶ': 'カ', 'ｷ': 'キ', 'ｸ': 'ク', 'ｹ': 'ケ', 'ｺ': 'コ',
    'ｻ': 'サ', 'ｼ': 'シ', 'ｽ': 'ス', 'ｾ': 'セ', 'ｿ': 'ソ',
    'ﾀ': 'タ', 'ﾁ': 'チ', 'ﾂ': 'ツ', 'ﾃ': 'テ', 'ﾄ': 'ト',
    'ﾅ': 'ナ', 'ﾆ': 'ニ', 'ﾇ': 'ヌ', 'ﾈ': 'ネ', 'ﾉ': 'ノ',
    'ﾊ': 'ハ', 'ﾋ': 'ヒ', 'ﾌ': 'フ', 'ﾍ': 'ヘ', 'ﾎ': 'ホ',
    'ﾏ': 'マ', 'ﾐ': 'ミ', 'ﾑ': 'ム', 'ﾒ': 'メ', 'ﾓ': 'モ',
    'ﾔ': 'ヤ', 'ﾕ': 'ユ', 'ﾖ': 'ヨ',
    'ﾗ': 'ラ', 'ﾘ': 'リ', 'ﾙ': 'ル', 'ﾚ': 'レ', 'ﾛ': 'ロ',
    'ﾜ': 'ワ', 'ｦ': 'ヲ', 'ﾝ': 'ン',
    'ｧ': 'ァ', 'ｨ': 'ィ', 'ｩ': 'ゥ', 'ｪ': 'ェ', 'ｫ': 'ォ',
    'ｯ': 'ッ', 'ｬ': 'ャ', 'ｭ': 'ュ', 'ｮ': 'ョ',
    '｡': '。', '｢': '「', '｣': '」', '､': '、', '･': '・',
    'ｰ': 'ー', 'ﾞ': '゛', 'ﾟ': '゜'
  }

  let result = str
  // 濁点・半濁点付き文字を先に変換
  Object.keys(kanaMap).forEach(key => {
    if (key.length > 1) {
      result = result.replace(new RegExp(key, 'g'), kanaMap[key])
    }
  })
  // 単一文字を変換
  Object.keys(kanaMap).forEach(key => {
    if (key.length === 1) {
      result = result.replace(new RegExp(key, 'g'), kanaMap[key])
    }
  })

  return result
}

/**
 * 全角数字を半角数字に変換
 */
export function convertFullWidthNumberToHalfWidth(str: string): string {
  return str.replace(/[０-９]/g, (s) => {
    return String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
  })
}

/**
 * 全角英字を半角英字に変換
 */
export function convertFullWidthAlphabetToHalfWidth(str: string): string {
  return str.replace(/[Ａ-Ｚａ-ｚ]/g, (s) => {
    return String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
  })
}

/**
 * 全角記号を半角記号に変換（一部）
 */
export function convertFullWidthSymbolsToHalfWidth(str: string): string {
  const symbolMap: { [key: string]: string } = {
    '　': ' ',  // 全角スペース→半角スペース
    '－': '-',
    '＿': '_',
    '／': '/',
    '＠': '@',
    '．': '.',
    '，': ',',
    '（': '(',
    '）': ')',
  }

  let result = str
  Object.keys(symbolMap).forEach(key => {
    result = result.replace(new RegExp(key, 'g'), symbolMap[key])
  })
  return result
}

/**
 * フリガナ用の正規化（半角カタカナ→全角カタカナ）
 */
export function normalizeKana(str: string): string {
  return convertHalfWidthKanaToFullWidth(str)
}

/**
 * 数値入力用の正規化（全角数字→半角数字、全角記号→半角記号）
 */
export function normalizeNumericInput(str: string): string {
  let result = str
  result = convertFullWidthNumberToHalfWidth(result)
  result = convertFullWidthSymbolsToHalfWidth(result)
  return result
}

/**
 * 汎用テキスト正規化（全角英数字→半角英数字、一部記号変換）
 */
export function normalizeText(str: string): string {
  let result = str
  result = convertFullWidthNumberToHalfWidth(result)
  result = convertFullWidthAlphabetToHalfWidth(result)
  result = convertFullWidthSymbolsToHalfWidth(result)
  return result
}
