const statusEl = document.getElementById("status");
const questionEl = document.getElementById("question");
const answerEl = document.getElementById("answer");

let entries = [];
let selectedIndex = null;
let charUnits = [];
let nextCharIndex = 0;
let nextJamoIndex = 0;
let renderedSegments = [];

const CHO = [
  "ᄀ",
  "ᄁ",
  "ᄂ",
  "ᄃ",
  "ᄄ",
  "ᄅ",
  "ᄆ",
  "ᄇ",
  "ᄈ",
  "ᄉ",
  "ᄊ",
  "ᄋ",
  "ᄌ",
  "ᄍ",
  "ᄎ",
  "ᄏ",
  "ᄐ",
  "ᄑ",
  "ᄒ"
];

const JUNG = [
  "ᅡ",
  "ᅢ",
  "ᅣ",
  "ᅤ",
  "ᅥ",
  "ᅦ",
  "ᅧ",
  "ᅨ",
  "ᅩ",
  "ᅪ",
  "ᅫ",
  "ᅬ",
  "ᅭ",
  "ᅮ",
  "ᅯ",
  "ᅰ",
  "ᅱ",
  "ᅲ",
  "ᅳ",
  "ᅴ",
  "ᅵ"
];

const JONG = [
  "",
  "ᆨ",
  "ᆩ",
  "ᆪ",
  "ᆫ",
  "ᆬ",
  "ᆭ",
  "ᆮ",
  "ᆯ",
  "ᆰ",
  "ᆱ",
  "ᆲ",
  "ᆳ",
  "ᆴ",
  "ᆵ",
  "ᆶ",
  "ᆷ",
  "ᆸ",
  "ᆹ",
  "ᆺ",
  "ᆻ",
  "ᆼ",
  "ᆽ",
  "ᆾ",
  "ᆿ",
  "ᇀ",
  "ᇁ",
  "ᇂ"
];

const HANGUL_BASE = 0xac00;
const HANGUL_LAST = 0xd7a3;

function decompose(char) {
  const code = char.codePointAt(0);
  if (code >= HANGUL_BASE && code <= HANGUL_LAST) {
    const syllableIndex = code - HANGUL_BASE;
    const choIndex = Math.floor(syllableIndex / (21 * 28));
    const jungIndex = Math.floor((syllableIndex % (21 * 28)) / 28);
    const jongIndex = syllableIndex % 28;
    const parts = [CHO[choIndex], JUNG[jungIndex]];
    const jongChar = JONG[jongIndex];
    if (jongChar) {
      parts.push(jongChar);
    }
    return parts;
  }
  return [char];
}

function resetStateWithEntry(index) {
  const entry = entries[index];
  if (!entry) {
    statusEl.textContent = `선택할 수 없는 인덱스입니다: ${index}`;
    return;
  }

  selectedIndex = index;
  questionEl.textContent = "";
  answerEl.textContent = "";
  renderedSegments = [];
  nextCharIndex = 0;
  nextJamoIndex = 0;
  charUnits = Array.from(entry.answer || "", (char, position) => ({
    char,
    jamo: decompose(char),
    index: position
  }));

  if (!charUnits.length) {
    statusEl.textContent = `#${index} 번 답변은 비어 있습니다.`;
  } else {
    statusEl.textContent = `#${index} 번 답변을 선택했습니다. 아무 키(한/영)를 누르면 출력됩니다.`;
  }
}

function updateAnswerDisplay() {
  answerEl.textContent = renderedSegments.map((segment) => segment.text).join("");
}

function outputNextUnit() {
  if (selectedIndex === null) {
    statusEl.textContent = "먼저 Ctrl + Alt + 숫자로 항목을 선택해 주세요.";
    return;
  }

  if (!charUnits.length) {
    statusEl.textContent = "출력할 답변이 없습니다.";
    return;
  }

  if (nextCharIndex >= charUnits.length) {
    statusEl.textContent = "모든 문자를 이미 출력했습니다.";
    return;
  }

  const current = charUnits[nextCharIndex];
  const nextJamo = current.jamo[nextJamoIndex];
  renderedSegments.push({ text: nextJamo, charIndex: current.index });
  updateAnswerDisplay();
  nextJamoIndex += 1;
  if (nextJamoIndex >= current.jamo.length) {
    nextCharIndex += 1;
    nextJamoIndex = 0;
  }
}

function rewindOneCharacter() {
  if (selectedIndex === null || !charUnits.length) {
    return;
  }

  if (nextJamoIndex > 0) {
    // Remove partial segments of the current character
    const currentIndex = charUnits[nextCharIndex].index;
    while (renderedSegments.length && renderedSegments[renderedSegments.length - 1].charIndex === currentIndex) {
      renderedSegments.pop();
    }
    nextJamoIndex = 0;
    updateAnswerDisplay();
    statusEl.textContent = "현재 글자를 처음부터 다시 출력합니다.";
    return;
  }

  if (nextCharIndex === 0) {
    statusEl.textContent = "더 이상 앞으로 이동할 수 없습니다.";
    return;
  }

  const previousIndex = charUnits[nextCharIndex - 1].index;
  while (renderedSegments.length && renderedSegments[renderedSegments.length - 1].charIndex === previousIndex) {
    renderedSegments.pop();
  }
  nextCharIndex -= 1;
  nextJamoIndex = 0;
  updateAnswerDisplay();
  statusEl.textContent = "이전 글자를 다시 출력합니다.";
}

function fastForwardOneCharacter() {
  if (selectedIndex === null || !charUnits.length) {
    return;
  }

  if (nextCharIndex >= charUnits.length) {
    statusEl.textContent = "이미 모든 글자를 출력했습니다.";
    return;
  }

  const target = charUnits[nextCharIndex];
  for (let i = nextJamoIndex; i < target.jamo.length; i += 1) {
    renderedSegments.push({ text: target.jamo[i], charIndex: target.index });
  }
  nextCharIndex += 1;
  nextJamoIndex = 0;
  updateAnswerDisplay();
  statusEl.textContent = "다음 글자를 모두 출력했습니다.";
}

function showQuestion() {
  if (selectedIndex === null) {
    statusEl.textContent = "먼저 항목을 선택해 주세요.";
    return;
  }
  const entry = entries[selectedIndex];
  questionEl.textContent = entry?.question ?? "";
  statusEl.textContent = `#${selectedIndex} 번 질문을 표시했습니다.`;
}

function handleKeydown(event) {
  if (event.ctrlKey && event.altKey) {
    if (/^Digit[0-9]$/.test(event.code)) {
      event.preventDefault();
      const digit = Number(event.code.replace("Digit", ""));
      resetStateWithEntry(digit);
      return;
    }

    if (event.code === "Backquote") {
      event.preventDefault();
      showQuestion();
      return;
    }

    if (event.code === "Minus") {
      event.preventDefault();
      rewindOneCharacter();
      return;
    }

    if (event.code === "Equal") {
      event.preventDefault();
      fastForwardOneCharacter();
      return;
    }
  }

  if (event.key.length === 1 && /[A-Za-z가-힣]/.test(event.key)) {
    event.preventDefault();
    outputNextUnit();
  }
}

document.addEventListener("keydown", handleKeydown);

async function loadEntries() {
  try {
    const response = await fetch("qa.json");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    entries = Array.isArray(data) ? data : data.entries ?? [];
    if (!entries.length) {
      statusEl.textContent = "JSON에 항목이 없습니다.";
      return;
    }
    statusEl.textContent = "Ctrl + Alt + 숫자로 항목을 선택하세요.";
  } catch (error) {
    statusEl.textContent = `JSON을 불러오지 못했습니다: ${error.message}`;
  }
}

loadEntries();
