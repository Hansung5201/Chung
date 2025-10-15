const display = document.getElementById("display");
const buttons = document.querySelectorAll(".buttons button");

let currentInput = "0";
let lastResult = null;
let justEvaluated = false;

const formatNumber = (value) => {
  if (value === "오류") {
    return value;
  }

  const normalizedValue = value.replace(/\*/g, "×").replace(/\//g, "÷");

  if (/^-?\d+(\.\d+)?$/.test(value)) {
    const [integer, decimal] = value.split(".");
    const formattedInteger = parseInt(integer, 10)
      .toLocaleString("ko-KR")
      .replace(/\u00a0/g, " ");

    return decimal !== undefined
      ? `${formattedInteger}.${decimal}`
      : formattedInteger;
  }

  return normalizedValue;
};

const updateDisplay = () => {
  display.textContent = formatNumber(currentInput);
};

const appendValue = (value) => {
  if (justEvaluated && /[0-9]/.test(value)) {
    currentInput = value;
  } else if (currentInput === "0" && value !== ".") {
    currentInput = value;
  } else {
    currentInput += value;
  }
  justEvaluated = false;
  updateDisplay();
};

const applyOperator = (operator) => {
  if (/[-+*/]$/.test(currentInput)) {
    currentInput = currentInput.slice(0, -1) + operator;
  } else {
    currentInput += operator;
  }
  justEvaluated = false;
  updateDisplay();
};

const calculate = () => {
  try {
    const sanitizedInput = currentInput.replace(/[^0-9+\-*/.]/g, "");
    if (!sanitizedInput) {
      return;
    }
    const result = Function(`"use strict"; return (${sanitizedInput})`)();
    if (Number.isFinite(result)) {
      lastResult = result;
      currentInput = result.toString();
      justEvaluated = true;
      updateDisplay();
    } else {
      throw new Error("Invalid result");
    }
  } catch (error) {
    currentInput = "오류";
    display.textContent = currentInput;
    setTimeout(() => {
      currentInput = lastResult !== null ? lastResult.toString() : "0";
      updateDisplay();
    }, 1200);
  }
};

const clearAll = () => {
  currentInput = "0";
  justEvaluated = false;
  updateDisplay();
};

const backspace = () => {
  if (justEvaluated) {
    clearAll();
    return;
  }
  if (currentInput.length === 1) {
    currentInput = "0";
  } else {
    currentInput = currentInput.slice(0, -1);
  }
  updateDisplay();
};

buttons.forEach((button) => {
  button.addEventListener("click", () => {
    const { value } = button.dataset;
    const { action } = button.dataset;

    if (value !== undefined) {
      if (/[-+*/]/.test(value)) {
        applyOperator(value);
      } else {
        appendValue(value);
      }
      return;
    }

    switch (action) {
      case "clear":
        clearAll();
        break;
      case "backspace":
        backspace();
        break;
      case "equals":
        calculate();
        break;
      default:
        break;
    }
  });
});

document.addEventListener("keydown", (event) => {
  const { key } = event;

  if ((/^[0-9.]$/.test(key) || ["+", "-", "*", "/"].includes(key))) {
    event.preventDefault();
    if (["+", "-", "*", "/"].includes(key)) {
      applyOperator(key);
    } else {
      appendValue(key);
    }
  } else if (key === "Enter" || key === "=") {
    event.preventDefault();
    calculate();
  } else if (key === "Backspace") {
    event.preventDefault();
    backspace();
  } else if (key === "Escape") {
    event.preventDefault();
    clearAll();
  }
});

updateDisplay();
