/*
 * typing-engine.js — 우아타자 핵심 로직
 * 한글 음절을 초성/중성/종성으로 분해해서 "타수"(키 입력 수)를 계산한다.
 * (한컴타자 등 전통적인 한글 타자연습 프로그램과 동일한 방식 — 완성형 음절 1개 = 자모 2~3타)
 */
(function (global) {
  'use strict';

  var HANGUL_BASE = 0xAC00;
  var HANGUL_LAST = 0xD7A3;

  // 완성형 한글 한 글자를 입력하는 데 필요한 키 입력 수(초성+중성[+종성])를 반환.
  // 한글이 아닌 문자(영문/숫자/기호/공백)는 1타로 계산.
  function keystrokesOf(ch) {
    var code = ch.charCodeAt(0);
    if (code >= HANGUL_BASE && code <= HANGUL_LAST) {
      var offset = code - HANGUL_BASE;
      var jong = offset % 28;
      return jong === 0 ? 2 : 3;
    }
    return 1;
  }

  function countKeystrokes(str) {
    var total = 0;
    for (var i = 0; i < str.length; i++) {
      total += keystrokesOf(str[i]);
    }
    return total;
  }

  // "Janchi Guksu" 같은 여러 단어로 된 영문 항목은 스페이스바를 누르지 않아도
  // 입력이 끝난 것으로 인정한다 — 공백을 비교/타수 계산 대상에서 아예 제외.
  function stripSpaces(s) {
    return (s || '').replace(/\s+/g, '');
  }

  // Fisher-Yates 셔플
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function pickWords(wordPool, count) {
    var shuffled = shuffle(wordPool);
    if (count >= shuffled.length) return shuffled;
    return shuffled.slice(0, count);
  }

  /**
   * TypingGame: 한 라운드(선택한 단어 목록)를 진행하는 상태 머신.
   * options: { words: string[] }
   * callbacks: onWordChange(currentWord, index, total), onFinish(result)
   */
  function TypingGame(words) {
    this.words = words;
    this.index = 0;
    this.startedAt = null;
    this.finishedAt = null;
    this.totalKeystrokes = 0;   // 정답으로 입력 완료한 글자들의 타수 합
    this.wrongKeystrokes = 0;   // 오타로 인해 추가로 입력된 타수(정확도 계산용, 근사치)
    this.correctChars = 0;
    this.totalCharsTyped = 0;   // 정확도 계산용 분모(맞았든 틀렸든 확정 입력한 글자 수)
  }

  TypingGame.prototype.start = function () {
    this.startedAt = Date.now();
  };

  TypingGame.prototype.currentWord = function () {
    return this.words[this.index];
  };

  // 실제로 입력해야 하는(공백 제외) 목표 문자열 — 완료 판정·타수 계산 기준.
  TypingGame.prototype.currentTypeTarget = function () {
    return stripSpaces(this.currentWord());
  };

  TypingGame.prototype.isLast = function () {
    return this.index >= this.words.length - 1;
  };

  // 한 단어를 완료 처리(정확히 입력했다고 가정하고 다음으로 넘어갈 때 호출).
  // typedValue: 사용자가 최종적으로 입력창에 입력한 문자열(공백 트림 완료 상태)
  TypingGame.prototype.submitWord = function (typedValue) {
    var target = this.currentTypeTarget(); // 공백 제외한 목표 문자열
    var typed = stripSpaces(typedValue);
    var correct = typed === target;

    this.totalCharsTyped += target.length;
    if (correct) {
      this.correctChars += target.length;
      this.totalKeystrokes += countKeystrokes(target);
    } else {
      // 오답이어도 시도한 타수만큼은 반영(정확도 계산 근거)
      this.wrongKeystrokes += countKeystrokes(typed);
    }

    var done = this.isLast();
    if (!done) {
      this.index++;
    } else {
      this.finishedAt = Date.now();
    }
    return { correct: correct, done: done };
  };

  TypingGame.prototype.elapsedMs = function () {
    var end = this.finishedAt || Date.now();
    return end - (this.startedAt || end);
  };

  TypingGame.prototype.result = function () {
    var elapsedMin = Math.max(this.elapsedMs() / 60000, 1 / 60); // 최소 1초 보정
    var cpm = Math.round(this.totalKeystrokes / elapsedMin);
    var accuracy = this.totalCharsTyped > 0
      ? Math.round((this.correctChars / this.totalCharsTyped) * 1000) / 10
      : 100;
    return {
      cpm: cpm,
      accuracy: accuracy,
      elapsedSec: Math.round(this.elapsedMs() / 100) / 10,
      wordCount: this.words.length,
      totalKeystrokes: this.totalKeystrokes,
    };
  };

  global.WootypeEngine = {
    countKeystrokes: countKeystrokes,
    stripSpaces: stripSpaces,
    shuffle: shuffle,
    pickWords: pickWords,
    TypingGame: TypingGame,
  };
})(window);
