/**
 * 투자 대시보드 v02 - Google Apps Script
 * 국내 주식 / 국내 상장 ETF 주가 조회
 *
 * [배포 방법]
 * 1. https://script.google.com → 기존 내용 전체 삭제 후 붙여넣기
 * 2. 배포 → 배포 관리 → 편집 → 새 버전 → 배포
 */

function getStockInfo(code) {
  try {
    const paddedCode = code.toString().padStart(6, '0');

    // 현재가: polling API
    const apiUrl = 'https://polling.finance.naver.com/api/realtime?query=SERVICE_ITEM:' + paddedCode;
    const res = UrlFetchApp.fetch(apiUrl, {
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://finance.naver.com' }
    });
    const json = JSON.parse(res.getContentText('UTF-8'));
    const item = json && json.result && json.result.areas &&
                 json.result.areas[0] && json.result.areas[0].datas &&
                 json.result.areas[0].datas[0];

    if (!item) return { error: '종목을 찾을 수 없습니다: ' + paddedCode };
    const price = Number(item.nv) || 0;

    // 종목명: sise 페이지 EUC-KR 디코딩
    const nameUrl = 'https://finance.naver.com/item/sise.naver?code=' + paddedCode;
    const nameRes = UrlFetchApp.fetch(nameUrl, {
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://finance.naver.com' }
    });
    const blob = Utilities.newBlob(nameRes.getContent());
    const html = blob.getDataAsString('EUC-KR');
    const nameMatch = html.match(/<title>([^<:]+)/);
    const name = nameMatch ? nameMatch[1].trim() : paddedCode;

    return { code: paddedCode, name: name, price: price };

  } catch(e) {
    Logger.log('error: ' + e.message);
    return { error: e.message };
  }
}

function getMultipleStocks(codes) {
  const results = {};
  codes.forEach(function(code) {
    results[code] = getStockInfo(code.trim());
    Utilities.sleep(300);
  });
  return results;
}

function testStock() {
  Logger.log(JSON.stringify(getStockInfo('005930')));
  Logger.log(JSON.stringify(getStockInfo('360750')));
  Logger.log(JSON.stringify(getStockInfo('416180')));
}

function doGet(e) {
  const params = e.parameter;
  let result;
  if (params.codes) {
    const codes = params.codes.split(',').map(function(c){ return c.trim(); }).filter(Boolean);
    result = getMultipleStocks(codes);
  } else if (params.code) {
    result = getStockInfo(params.code);
  } else {
    result = { error: 'code 또는 codes 파라미터가 필요합니다' };
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function scheduledUpdate() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  if (kst.getUTCHours() === 15 && kst.getUTCMinutes() >= 25 && kst.getUTCMinutes() <= 40) {
    Logger.log('3:30 자동 업데이트 실행');
  }
}
