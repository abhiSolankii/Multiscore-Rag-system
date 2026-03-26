/**
 * speechReader.js
 * Web Speech API utility for reading text aloud.
 * Returns a stop function to halt speech mid-reading.
 */

let currentUtterance = null;

const stripMarkdown = (text) => {
  return text
    .replace(/\*\*|__/g, '') // bold
    .replace(/\*|_/g, '') // italic
    .replace(/#+\s/g, '') // headers
    .replace(/`([^`]+)`/g, '$1') // inline code
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // links
    .replace(/^\s*[\-\*]\s/gm, '') // list markers
    .replace(/^\s*\d+\.\s/gm, '') // numbered list markers
    .replace(/>\s/g, '') // blockquotes
    .replace(/\[\[Chunk\s\d+\]\]/gi, '') // citations (extra safety)
    .trim();
};

export const speakText = (text, { onEnd } = {}) => {
  if (!('speechSynthesis' in window)) {
    alert('Text-to-speech is not supported in this browser.');
    return;
  }

  // Stop any ongoing speech first
  stopSpeech();

  const cleanText = stripMarkdown(text);
  currentUtterance = new SpeechSynthesisUtterance(cleanText);
  currentUtterance.rate = 1;
  currentUtterance.pitch = 1;
  currentUtterance.lang = 'en-US';

  // Try to pick a better sounding voice
  const voices = window.speechSynthesis.getVoices();
  const betterVoice = voices.find(v => v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel'));
  if (betterVoice) {
    currentUtterance.voice = betterVoice;
  }

  if (onEnd) {
    currentUtterance.onend = onEnd;
    currentUtterance.onerror = onEnd;
  }

  window.speechSynthesis.speak(currentUtterance);
};

export const stopSpeech = () => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    currentUtterance = null;
  }
};

export const isSpeaking = () =>
  'speechSynthesis' in window && window.speechSynthesis.speaking;
