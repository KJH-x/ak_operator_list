import { customPinyin, pinyin as pinyinPro } from 'pinyin-pro'

// Mirrors the custom dictionary in Ak-Data/interactiveCommonPinyin.py so both
// the build-time index and the runtime search produce the same pinyin.
const OVERRIDES: Record<string, string> = {
  卡: 'kǎ',
  阿: 'ā',
  艾: 'ài',
  娜: 'nà',
  角: 'jiǎo',
  露: 'lù',
  行: 'xíng',
  色: 'sè',
  提: 'tí',
  蛇: 'shé',
  铅: 'qiān',
  若: 'ruò',
  百: 'bǎi',
  折: 'zhé',
  吽: 'hōng',
  红: 'hóng',
  亚叶: 'yà yè',
  薄绿: 'bó lù',
  谜图: 'mí tú',
  波卜: 'bō bo',
  嵯峨: 'cuó é',
  焰尾: 'yàn wěi',
  伺夜: 'sì yè',
  摩根: 'mó gēn',
  暮落: 'mù luò',
  末药: 'mò yào',
  左乐: 'zuǒ lè',
  贾维: 'jiǎ wéi',
  地灵: 'dì líng',
  柏喙: 'bǎi huì',
  仇白: 'qiú bái',
  空爆: 'kōng bào',
  澄闪: 'chéng shǎn',
  刻俄柏: 'kè é bó',
  车尔尼: 'chē ěr nǐ',
  塞雷娅: 'sài léi yà',
  玫兰莎: 'méi lán shā',
  龙舌兰: 'lóng shé lán',
  见行者: 'jiàn xíng zhě',
  史都华德: 'shǐ dū huá dé',
  齐尔查克: 'qí ěr chá kè',
  维什戴尔: 'wéi shí dài ěr',
  新约能天使: 'xīn yuē néng tiān shǐ',
  蕾缪安: 'lěi miù ān',
}

customPinyin(OVERRIDES)

export function pinyinFor(value: string): string {
  return String(pinyinPro(value, { toneType: 'none', separator: '' }) ?? value)
    .normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/[\s\p{P}\p{S}]+/gu, '')
}

export function initialsFor(value: string): string {
  return String(pinyinPro(value, { toneType: 'none', pattern: 'first', separator: '' }) ?? value)
    .normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/[\s\p{P}\p{S}]+/gu, '')
}

