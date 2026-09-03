/*
 * typing-sound.js — Web Audio API로 합성한 효과음 (외부 음원 파일 없음).
 * 음소거 상태는 localStorage에 저장.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'wootype_muted';
  var ctx = null;

  function getCtx() {
    if (!ctx) {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      ctx = new AudioCtx();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function isMuted() {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch (e) { return false; }
  }

  function setMuted(v) {
    try { localStorage.setItem(STORAGE_KEY, v ? '1' : '0'); } catch (e) {}
  }

  function tone(freq, duration, type, gainPeak, delay) {
    if (isMuted()) return;
    var audioCtx = getCtx();
    if (!audioCtx) return;
    delay = delay || 0;
    var t0 = audioCtx.currentTime + delay;

    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(gainPeak || 0.15, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  function playKeystroke() {
    tone(1400 + Math.random() * 200, 0.03, 'square', 0.03);
  }

  function playCorrect(comboLevel) {
    // 콤보가 쌓일수록 음이 살짝 올라가는 상승 아르페지오
    var base = 523.25; // C5
    var steps = [0, 4, 7]; // 장3화음
    var pitchBoost = Math.min(comboLevel || 0, 8) * 15;
    steps.forEach(function (semi, i) {
      var freq = (base + pitchBoost) * Math.pow(2, semi / 12);
      tone(freq, 0.14, 'triangle', 0.11, i * 0.045);
    });
  }

  function playWrong() {
    tone(180, 0.22, 'sawtooth', 0.12);
    tone(140, 0.22, 'sawtooth', 0.09, 0.05);
  }

  function playCombo() {
    var notes = [659.25, 783.99, 987.77, 1318.51]; // E5 G5 B5 E6
    notes.forEach(function (freq, i) {
      tone(freq, 0.16, 'triangle', 0.13, i * 0.06);
    });
  }

  function playFinish() {
    var notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach(function (freq, i) {
      tone(freq, 0.3, 'sine', 0.14, i * 0.09);
    });
  }

  global.WootypeSound = {
    isMuted: isMuted,
    setMuted: setMuted,
    playKeystroke: playKeystroke,
    playCorrect: playCorrect,
    playWrong: playWrong,
    playCombo: playCombo,
    playFinish: playFinish,
  };
})(window);
