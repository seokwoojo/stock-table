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

  if (params.action === 'fear_greed_data') {
    // CNN Fear & Greed 원본 데이터만 반환 (브라우저에서 Claude 호출)
    try {
      var raw = fetchFearGreed();
      result = raw; // 원본 JSON 그대로 반환
    } catch(err) {
      result = { error: err.message };
    }
  } else if (params.action === 'fear_greed') {
    // Fear & Greed 리포트 생성 및 저장 (레거시)
    try {
      updateFearGreed();
      result = { message: 'Fear & Greed 업데이트 완료' };
    } catch(err) {
      result = { error: err.message };
    }
  } else if (params.codes) {
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

// ─────────────── Fear & Greed Index ───────────────
// alternative.me API 사용 (CNN API는 GAS IP 차단)
var ALT_FG_URL = "https://api.alternative.me/fng/?limit=2";

var RATING_KR_FG = {
  "extreme fear": "극도의 공포",
  "fear":         "공포",
  "neutral":      "중립",
  "greed":        "탐욕",
  "extreme greed":"극도의 탐욕"
};

function fetchFearGreed() {
  var res = UrlFetchApp.fetch(ALT_FG_URL, { muteHttpExceptions: true });
  return JSON.parse(res.getContentText("UTF-8"));
}

function parseFearGreed(raw) {
  var today = raw.data[0];
  var yesterday = raw.data[1] || today;
  var score  = parseInt(today.value);
  var rating = RATING_KR_FG[today.value_classification.toLowerCase()] || today.value_classification;
  var prevScore = parseInt(yesterday.value);
  return {
    score:      score,
    rating:     rating,
    prev_close: prevScore,
    prev_1_week:  0,  // 이 API는 제공 안 함
    prev_1_month: 0,
  };
}

function buildFGPrompt(d) {
  var diff    = Math.round((d.score - d.prev_close) * 10) / 10;
  var diffStr = diff >= 0 ? "▲" + diff : "▼" + Math.abs(diff);
  return "당신은 미국 주식시장 심리 분석 전문가입니다.\n" +
    "오늘의 CNN Fear & Greed Index 데이터를 바탕으로 한국어 시장 리포트를 작성해주세요.\n\n" +
    "[오늘 데이터]\n" +
    "- 전체 점수: " + d.score + " (" + d.rating + ")\n" +
    "- 전일 대비: " + d.prev_close + " → " + d.score + " (" + diffStr + ")\n" +
    "- 1주 전: " + d.prev_1_week + " / 1개월 전: " + d.prev_1_month + "\n\n" +
    "[세부지표] (0~100점, 높을수록 탐욕)\n" +
    "- 시장 모멘텀: " + d.momentum.score + "점 / " + d.momentum.rating + "\n" +
    "- 주가 강도: " + d.strength.score + "점 / " + d.strength.rating + "\n" +
    "- 주가 폭: " + d.breadth.score + "점 / " + d.breadth.rating + "\n" +
    "- 풋/콜 비율: " + d.put_call.score + "점 / " + d.put_call.rating + "\n" +
    "- VIX 변동성: " + d.vix.score + "점 / " + d.vix.rating + "\n" +
    "- 안전자산 수요: " + d.safe_haven.score + "점 / " + d.safe_haven.rating + "\n" +
    "- 정크본드 수요: " + d.junk_bond.score + "점 / " + d.junk_bond.rating + "\n\n" +
    "[작성 형식]\n" +
    "맨 앞에 두 줄 요약, --- 이후 전체 리포트:\n" +
    "📊 [첫째 줄 요약]\n📈 [둘째 줄 요약]\n---\n(전체 리포트)\n\n" +
    "[주의] 투자 권유 금지, 이모지/볼드체 사용, 마크다운 헤더 금지";
}

function callClaude(prompt) {
  var apiKey  = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
  var payload = JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }]
  });
  var res = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    payload: payload,
    muteHttpExceptions: true
  });
  var json = JSON.parse(res.getContentText("UTF-8"));
  if (json.error) throw new Error(json.error.message);
  return json.content[0].text;
}

function saveFGToFirestore(data, report) {
  var parts      = report.split("---");
  var summary    = parts.length > 1 ? parts[0].trim() : "";
  var fullReport = parts.length > 1 ? parts[1].trim() : report;
  var today      = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd");
  var projectId  = "stock-dashboard-ed29b";
  var url        = "https://firestore.googleapis.com/v1/projects/" + projectId +
                   "/databases/(default)/documents/fear_greed_reports/" + today;
  var token      = ScriptApp.getOAuthToken();
  var body       = JSON.stringify({
    fields: {
      score:      { doubleValue: data.score },
      rating:     { stringValue: data.rating },
      summary:    { stringValue: summary },
      report:     { stringValue: fullReport },
      date:       { stringValue: today },
      created_at: { stringValue: new Date().toISOString() }
    }
  });
  var resp = UrlFetchApp.fetch(url, {
    method: "PATCH",
    headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
    payload: body,
    muteHttpExceptions: true
  });
  Logger.log("Firestore 저장: " + resp.getResponseCode());
}

function updateFearGreed() {
  Logger.log("📡 Fear & Greed 데이터 수집...");
  var raw    = fetchFearGreed();
  var data   = parseFearGreed(raw);
  Logger.log("점수: " + data.score + " (" + data.rating + ")");
  Logger.log("✍️ Claude 리포트 생성...");
  var report = callClaude(buildFGPrompt(data));
  saveFGToFirestore(data, report);
  Logger.log("✅ 완료");
}
