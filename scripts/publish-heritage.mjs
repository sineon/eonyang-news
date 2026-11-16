// 문화유산과 인물만 발행하며, 공연 목록이나 소식지 호수는 수정하지 않는다.
import fs from 'node:fs';
import { refreshHeritage } from './heritage-features.mjs';

const [flag, value] = process.argv.slice(2);
const date = new Date(value + 'T00:00:00Z');
if (flag !== '--date' || !/^\d{4}-\d{2}-\d{2}$/.test(value ?? '') ||
    Number.isNaN(+date) || date.toISOString().slice(0, 10) !== value) {
  throw new Error('사용법: node scripts/publish-heritage.mjs --date YYYY-MM-DD (한국 날짜)');
}
const file = new URL('../index.html', import.meta.url);
const current = fs.readFileSync(file, 'utf8');
const html = refreshHeritage(current, date);
if (html === null) throw new Error(`${value.slice(0, 7)} 문화유산 원고가 없습니다.`);
if (html !== current) fs.writeFileSync(file, html, 'utf8');
console.log(`${value.slice(0, 7)} 문화유산과 인물: ${html === current ? '이미 반영됨' : 'index.html 갱신'}`);
