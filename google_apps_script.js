/**
 * 투자 대시보드 v02 - Google Apps Script
 * 
 * [배포 방법]
 * 1. https://script.google.com 접속
 * 2. 새 프로젝트 생성
 * 3. 이 코드 전체 붙여넣기
 * 4. 상단 메뉴 → 배포 → 새 배포
 * 5. 유형: 웹 앱
 * 6. 실행 계정: 나(본인)
 * 7. 액세스 권한: 모든 사용자
 * 8. 배포 클릭 → URL 복사
 * 9. 대시보드 설정에서 해당 URL 입력
 */

// ── 종목 코드로 현재가 + 종목명 조회 ──
function getStockInfo(code) {
  try {
    // 국내 주식 / 국내 상장 ETF: KRX:코드
    const ticker = 'KRX:' + code;

    // 현재가
    const price = GoogleFinance(ticker, 'price');
    // 종목명
    const name  = GoogleFinance(ticker, 'name');

    if (!price || price === '#N/A') {
      return { error: '종목 코드를 찾을 수 없습니다: ' + code };
    }

    return {
      code:  code,
      name:  name,
      price: price,
    };
  } catch(e) {
    return { error: e.message };
  }
}

// ── 여러 종목 한번에 조회 ──
function getMultipleStocks(codes) {
  const results = {};
  codes.forEach(code => {
    results[code] = getStockInfo(code);
  });
  return results;
}

// ── HTTP 요청 처리 (GET) ──
function doGet(e) {
  const params = e.parameter;
  let result;

  // ?codes=005930,069500,379800 형식으로 여러 종목
  if (params.codes) {
    const codes = params.codes.split(',').map(c => c.trim()).filter(Boolean);
    result = getMultipleStocks(codes);

  // ?code=005930 형식으로 단일 종목
  } else if (params.code) {
    result = getStockInfo(params.code);

  } else {
    result = { error: 'code 또는 codes 파라미터가 필요합니다' };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── 매일 오후 3시 30분 자동 업데이트 트리거용 ──
// Apps Script 트리거에서 이 함수를 오후 3~4시 사이로 설정
function scheduledUpdate() {
  // 현재 시간 확인 (KST)
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const hour   = kst.getUTCHours();
  const minute = kst.getUTCMinutes();

  // 3:25 ~ 3:35 사이에만 실행 (트리거 오차 고려)
  if (!(hour === 15 && minute >= 25 && minute <= 35)) return;

  Logger.log('정규장 종료 후 가격 업데이트 실행: ' + kst.toISOString());
  // 필요 시 여기서 스프레드시트에 가격 기록 가능
}

/**
 * [트리거 설정 방법]
 * 1. Apps Script 편집기 왼쪽 메뉴 → 시계 아이콘(트리거)
 * 2. 트리거 추가
 * 3. 실행할 함수: scheduledUpdate
 * 4. 이벤트 소스: 시간 기반
 * 5. 시간 기반 트리거 유형: 시간의 타이머
 * 6. 시간 간격: 1시간마다
 * → scheduledUpdate 함수 내부에서 3:30 체크 후 실행
 */
