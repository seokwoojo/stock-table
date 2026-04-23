/**
 * 투자 대시보드 v02 - Google Apps Script
 * 네이버 금융에서 주가 데이터를 가져옵니다.
 *
 * [배포 방법]
 * 1. https://script.google.com 접속
 * 2. 새 프로젝트 생성 (기존 내용 전체 삭제 후 이 코드 붙여넣기)
 * 3. 상단 메뉴 → 배포 → 새 배포
 * 4. 유형: 웹 앱
 * 5. 실행 계정: 나(본인)
 * 6. 액세스 권한: 모든 사용자(익명 포함)
 * 7. 배포 클릭 → URL 복사 → 대시보드에 입력
 */

// ── 단일 종목 조회 (네이버 금융) ──
function getStockInfo(code) {
  try {
    const paddedCode = code.toString().padStart(6, '0');
    const url = 'https://finance.naver.com/item/main.naver?code=' + paddedCode;
    const res  = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const html = res.getContentText('EUC-KR');

    // 현재가: <strong id="_nowVal">숫자</strong>
    const priceMatch = html.match(/<strong id="_nowVal">([\d,]+)<\/strong>/);
    // 종목명: <title>종목명 : ...</title>
    const nameMatch  = html.match(/<title>([^:]+)\s*:/);

    if (!priceMatch) {
      return { error: '종목을 찾을 수 없습니다: ' + code };
    }

    const price = parseInt(priceMatch[1].replace(/,/g, ''), 10);
    const name  = nameMatch ? nameMatch[1].trim() : paddedCode;

    return { code: paddedCode, name: name, price: price };

  } catch(e) {
    return { error: e.message };
  }
}

// ── 여러 종목 한번에 조회 ──
function getMultipleStocks(codes) {
  const results = {};
  codes.forEach(function(code) {
    results[code] = getStockInfo(code.trim());
    Utilities.sleep(300); // 네이버 요청 간격 (너무 빠르면 차단)
  });
  return results;
}

// ── HTTP GET 요청 처리 ──
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

/**
 * [트리거 설정 - 오후 3:30 자동 갱신]
 * 1. 왼쪽 메뉴 시계 아이콘(트리거) 클릭
 * 2. 트리거 추가
 * 3. 실행 함수: scheduledUpdate
 * 4. 이벤트 소스: 시간 기반
 * 5. 유형: 시간의 타이머 → 1시간마다
 */
function scheduledUpdate() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const hour   = kst.getUTCHours();
  const minute = kst.getUTCMinutes();
  if (!(hour === 15 && minute >= 25 && minute <= 40)) return;
  Logger.log('3:30 자동 업데이트 실행: ' + kst.toISOString());
}
