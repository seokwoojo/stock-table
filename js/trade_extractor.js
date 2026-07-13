// ─────────────────────────────────────────────────────────────────────
// trade_extractor.js
// 카카오톡 증권사 체결 알림에서 거래 정보를 추출하는 모듈
// Python trade_extractor.py를 JavaScript로 포팅
// ─────────────────────────────────────────────────────────────────────

const BROKERS = [
  'NH투자증권', '한국투자증권', '삼성증권', '미래에셋증권', '키움증권',
  'KB증권', '신한투자증권', '하나증권', '대신증권', '유안타증권',
  '유진투자증권', 'SK증권', 'DB금융투자', '교보증권', '현대차증권',
  'IBK투자증권', '카카오페이증권', '토스증권', '한화투자증권', '메리츠증권',
];

function spaced(label) {
  return label.split('').join('\\s*');
}

const LABELS = {
  order_date:     spaced('주문일자'),
  account_name:   spaced('계좌명'),
  side:           spaced('매매구분'),
  exec_type:      spaced('체결종류'),
  country:        spaced('거래국가'),
  stock_name:     spaced('종목명'),
  stock_code:     spaced('종목코드'),
  order_qty:      spaced('주문수량'),
  total_exec_qty: spaced('총체결수량'),
  exec_qty:       spaced('체결수량'),
  currency:       spaced('거래통화'),
  exec_price:     '체\\s*결\\s*(?:단\\s*가|가\\s*격)',
  order_no:       spaced('주문번호'),
};

const COLON = '\\s*[:：]\\s*';

function extractFields(text) {
  const matches = [];
  for (const [key, pattern] of Object.entries(LABELS)) {
    const re = new RegExp(pattern + COLON, 'g');
    let m;
    while ((m = re.exec(text)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length, key });
    }
  }
  matches.sort((a, b) => a.start - b.start);

  const fields = {};
  for (let i = 0; i < matches.length; i++) {
    const { end, key } = matches[i];
    const valueEnd = i + 1 < matches.length ? matches[i + 1].start : text.length;
    const value = text.slice(end, valueEnd).replace(/\s+/g, ' ').trim().replace(/^[*•\-\t ]+|[*•\-\t ]+$/g, '');
    if (value && !(key in fields)) {
      fields[key] = value;
    }
  }
  return fields;
}

function toInt(s) {
  if (!s) return null;
  const digits = s.replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : null;
}

function toPrice(s, isOverseas) {
  if (!s) return null;
  s = s.trim();
  if (isOverseas) {
    const v = parseFloat(s.replace(/,/g, ''));
    return isNaN(v) ? null : v;
  } else {
    const cleaned = s.replace(/[,.](?=\d{3}(?:\D|$))/g, '');
    const digits = cleaned.replace(/[^\d.]/g, '');
    const v = digits.includes('.') ? parseFloat(digits) : parseInt(digits, 10);
    return isNaN(v) ? null : v;
  }
}

function splitNameCode(name, explicitCode) {
  let code = explicitCode || null;
  let clean = name;

  // '종목명(490590)' 형태
  const m1 = clean.match(/\((\d{4,6})\)\s*$/);
  if (m1 && !code) {
    code = m1[1];
    clean = clean.slice(0, m1.index).trim();
  }

  // '(SGOV US)이름' 형태 (해외)
  const m2 = clean.match(/^\(([A-Za-z.]+)\s+[A-Za-z]+\)\s*(.+)$/);
  if (m2) {
    if (!code) code = m2[1];
    clean = m2[2].trim();
  }

  return [clean || null, code];
}

function normalizeDate(s, year) {
  if (!s) return null;
  const m = s.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (!m) return s;
  const y = year || new Date().getFullYear();
  return `${y}-${String(parseInt(m[1])).padStart(2,'0')}-${String(parseInt(m[2])).padStart(2,'0')}`;
}

function parseText(text, year) {
  const fields = extractFields(text);

  const broker = BROKERS.find(b => text.includes(b)) || '알수없음';

  const sideRaw = fields.side || fields.exec_type || '';
  const side = sideRaw.includes('매도') ? '매도' : (sideRaw.includes('매수') ? '매수' : null);

  const currency = fields.currency || null;
  const country = fields.country || '';
  const isOverseas = (currency && currency.toUpperCase() !== 'KRW') || (country !== '' && country !== '한국');
  const finalCurrency = currency || (isOverseas ? 'USD' : 'KRW');

  const [stockName, stockCode] = splitNameCode(
    fields.stock_name || '',
    fields.stock_code || null
  );

  const qty = toInt(fields.exec_qty || fields.total_exec_qty || fields.order_qty || null);
  const price = toPrice(fields.exec_price || null, isOverseas);

  return {
    broker,
    side,
    market: isOverseas ? '해외' : '국내',
    stock_name: stockName,
    stock_code: stockCode,
    quantity: qty,
    price,
    currency: finalCurrency,
    order_date: normalizeDate(fields.order_date || null, year),
    account_name: fields.account_name || null,
    order_no: fields.order_no || null,
  };
}

// Claude API로 파싱 (이미지 또는 텍스트가 복잡할 때)
async function extractWithClaude(text, apiKey) {
  const prompt = `아래는 증권사 카카오톡 체결 알림 텍스트입니다.
거래 정보를 추출하여 JSON으로만 응답하세요. 설명 없이 JSON만.

텍스트:
${text}

응답 형식:
{
  "broker": "증권사명",
  "side": "매수 또는 매도",
  "market": "국내 또는 해외",
  "stock_name": "종목명",
  "stock_code": "종목코드 또는 티커",
  "quantity": 수량(정수),
  "price": 체결단가(숫자),
  "currency": "KRW 또는 USD",
  "order_date": "YYYY-MM-DD 또는 null",
  "account_name": "계좌명 또는 null",
  "order_no": "주문번호 또는 null"
}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  const text2 = json.content[0].text.trim().replace(/```json|```/g, '').trim();
  return JSON.parse(text2);
}

// 메인 추출 함수
async function extractTrade(text, useClaudeAI = false, apiKey = null) {
  // 1차: 정규식 파싱
  const result = parseText(text);

  // 파싱 실패하거나 Claude AI 사용 요청 시
  if (useClaudeAI && apiKey && (!result.stock_name || !result.quantity || !result.price)) {
    try {
      return await extractWithClaude(text, apiKey);
    } catch(e) {
      console.error('Claude 파싱 실패:', e);
    }
  }

  return result;
}
