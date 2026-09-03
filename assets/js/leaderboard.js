/*
 * leaderboard.js — Firebase Firestore 기반 테마별 순위표.
 *
 * window.WOOTYPE_FIREBASE_CONFIG 가 설정되지 않은 동안에는(초기 배포 단계)
 * 모든 함수가 안전하게 "미설정" 상태로 동작한다 — 에러를 던지지 않고
 * 순위표 UI 쪽에서 "순위표 준비 중" 문구를 보여줄 수 있게 null/빈 배열을 반환.
 */
(function (global) {
  'use strict';

  var app = null;
  var db = null;
  var ready = false;

  function isConfigured() {
    return !!(global.WOOTYPE_FIREBASE_CONFIG && global.WOOTYPE_FIREBASE_CONFIG.apiKey);
  }

  function init() {
    if (ready || !isConfigured()) return ready;
    try {
      app = firebase.initializeApp(global.WOOTYPE_FIREBASE_CONFIG);
      db = firebase.firestore();
      ready = true;
    } catch (e) {
      console.warn('[wootype] Firebase 초기화 실패:', e);
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
      .catch(function (e) { console.warn('[wootype] 점수 등록 실패:', e); return false; });
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
        console.warn('[wootype] 순위표 조회 실패:', e);
        return [];
      });
  }

  global.WootypeLeaderboard = {
    isConfigured: isConfigured,
    submitScore: submitScore,
    fetchTop: fetchTop,
  };
})(window);
