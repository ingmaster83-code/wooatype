/*
 * leaderboard.js — Firebase Firestore 기반 테마별 순위표.
 *
 * window.WOOATYPE_FIREBASE_CONFIG 가 설정되지 않은 동안에는(초기 배포 단계)
 * 모든 함수가 안전하게 "미설정" 상태로 동작한다 — 에러를 던지지 않고
 * 순위표 UI 쪽에서 "순위표 준비 중" 문구를 보여줄 수 있게 null/빈 배열을 반환.
 */
(function (global) {
  'use strict';

  var app = null;
  var db = null;
  var ready = false;

  function isConfigured() {
    return !!(global.WOOATYPE_FIREBASE_CONFIG && global.WOOATYPE_FIREBASE_CONFIG.apiKey);
  }

  function init() {
    if (ready || !isConfigured()) return ready;
    try {
      app = firebase.initializeApp(global.WOOATYPE_FIREBASE_CONFIG);
      db = firebase.firestore();
      ready = true;
    } catch (e) {
      console.warn('[wooatype] Firebase 초기화 실패:', e);
      ready = false;
    }
    return ready;
  }

  // 닉네임: 공백 제거, 20자 제한, XSS 방지를 위해 렌더링 시 textContent만 사용(이 파일에선 저장만)
  function sanitizeNickname(name) {
    var n = (name || '').trim().slice(0, 20);
    return n || '익명';
  }

  /**
   * 점수 등록. 성공 시 resolve(true), 실패/미설정 시 resolve(false).
   */
  function submitScore(theme, nickname, cpm, accuracy) {
    if (!init()) return Promise.resolve(false);
    if (!theme || typeof cpm !== 'number' || cpm <= 0 || cpm > 3000) return Promise.resolve(false);

    return db.collection('scores').add({
      theme: theme,
      nickname: sanitizeNickname(nickname),
      cpm: Math.round(cpm),
      accuracy: Math.round(accuracy * 10) / 10,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    }).then(function () { return true; })
      .catch(function (e) { console.warn('[wooatype] 점수 등록 실패:', e); return false; });
  }

  /**
   * 테마별 상위 N개 순위 조회. 실패/미설정 시 빈 배열 resolve.
   */
  function fetchTop(theme, limit) {
    limit = limit || 20;
    if (!init()) return Promise.resolve([]);

    return db.collection('scores')
      .where('theme', '==', theme)
      .orderBy('cpm', 'desc')
      .limit(limit)
      .get()
      .then(function (snap) {
        var rows = [];
        snap.forEach(function (doc) {
          var d = doc.data();
          rows.push({ nickname: d.nickname, cpm: d.cpm, accuracy: d.accuracy });
        });
        return rows;
      })
      .catch(function (e) {
        console.warn('[wooatype] 순위표 조회 실패:', e);
        return [];
      });
  }

  // ── 기간별(일간/주간/월간) 순위 ──────────────────────────────────────
  // Firestore는 range 필터(createdAt >=)를 쓰면 orderBy도 그 필드로 시작해야 해서
  // cpm 기준으로 바로 정렬 조회가 안 된다. 그래서 기간 내 최근 N건을 createdAt
  // 기준으로 가져온 뒤 클라이언트에서 cpm으로 다시 정렬한다 — 트래픽이 아주 많지
  // 않은 한(기간 내 제출이 FETCH_CAP건을 안 넘는 한) 실제 1등과 결과가 같다.
  var FETCH_CAP = 30;
  var CACHE_TTL_MS = 5 * 60 * 1000; // 5분 — 같은 브라우저에서 반복 조회 방지

  function periodCutoff(period) {
    var now = new Date();
    if (period === 'daily') {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()); // 오늘 00:00
    }
    var days = period === 'weekly' ? 7 : 30;
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }

  function cacheKey(theme, period) { return 'wooatype_lb_' + theme + '_' + period; }

  function readCache(theme, period) {
    try {
      var raw = localStorage.getItem(cacheKey(theme, period));
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (Date.now() - parsed.t > CACHE_TTL_MS) return null;
      return parsed.rows;
    } catch (e) { return null; }
  }

  function writeCache(theme, period, rows) {
    try {
      localStorage.setItem(cacheKey(theme, period), JSON.stringify({ t: Date.now(), rows: rows }));
    } catch (e) { /* 저장 공간 부족 등은 무시 */ }
  }

  /**
   * 테마+기간별 상위 N개 순위 조회(daily/weekly/monthly). 5분간 브라우저 캐시.
   * 실패/미설정 시 빈 배열 resolve.
   */
  function fetchTopByPeriod(theme, period, limit) {
    limit = limit || 10;
    var cached = readCache(theme, period);
    if (cached) return Promise.resolve(cached.slice(0, limit));

    if (!init()) return Promise.resolve([]);
    var cutoff = periodCutoff(period);

    return db.collection('scores')
      .where('theme', '==', theme)
      .where('createdAt', '>=', cutoff)
      .orderBy('createdAt', 'desc')
      .limit(FETCH_CAP)
      .get()
      .then(function (snap) {
        var rows = [];
        snap.forEach(function (doc) {
          var d = doc.data();
          rows.push({ nickname: d.nickname, cpm: d.cpm, accuracy: d.accuracy });
        });
        rows.sort(function (a, b) { return b.cpm - a.cpm; });
        writeCache(theme, period, rows);
        return rows.slice(0, limit);
      })
      .catch(function (e) {
        console.warn('[wooatype] 기간별 순위표 조회 실패:', e);
        return [];
      });
  }

  global.WootypeLeaderboard = {
    isConfigured: isConfigured,
    submitScore: submitScore,
    fetchTop: fetchTop,
    fetchTopByPeriod: fetchTopByPeriod,
  };
})(window);
