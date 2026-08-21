const expressionEl = document.getElementById('expression');
const currentEl = document.getElementById('current');
const clearBtn = document.getElementById('clearBtn');
const toastEl = document.getElementById('toast');

const OP_SYMBOLS = {
  add: '+',
  subtract: '−',
  multiply: '×',
  divide: '÷',
};

let currentInput = '0';
let previousValue = null;
let operator = null;
let overwrite = true;
let lastCalculationString = null;
let lastAnswer = null;

function formatNumber(num) {
  if (!Number.isFinite(num)) return 'Error';
  const str = num.toString();
  if (str.length > 12) {
    return Number(num.toPrecision(10)).toString();
  }
  return str;
}

function updateDisplay() {
  currentEl.textContent = currentInput;
  if (operator && previousValue !== null) {
    expressionEl.textContent = `${formatNumber(previousValue)} ${OP_SYMBOLS[operator]}`;
  } else {
    expressionEl.textContent = '';
  }
  clearBtn.textContent = (currentInput !== '0' || previousValue !== null) ? 'C' : 'AC';
}

function inputDigit(digit) {
  if (overwrite) {
    currentInput = digit === '.' ? '0.' : digit;
    overwrite = false;
  } else {
    if (digit === '.' && currentInput.includes('.')) return;
    if (currentInput.replace('-', '').replace('.', '').length >= 15) return;
    currentInput = currentInput === '0' && digit !== '.' ? digit : currentInput + digit;
  }
  updateDisplay();
}

function calculate(a, b, op) {
  switch (op) {
    case 'add': return a + b;
    case 'subtract': return a - b;
    case 'multiply': return a * b;
    case 'divide': return b === 0 ? NaN : a / b;
    default: return b;
  }
}

function chooseOperator(nextOperator) {
  const inputValue = parseFloat(currentInput);

  if (operator && !overwrite) {
    const result = calculate(previousValue, inputValue, operator);
    previousValue = result;
    currentInput = formatNumber(result);
  } else {
    previousValue = inputValue;
  }

  operator = nextOperator;
  overwrite = true;
  updateDisplay();
}

function resolvePendingOperation() {
  if (operator && previousValue !== null) {
    const inputValue = parseFloat(currentInput);
    const result = calculate(previousValue, inputValue, operator);
    const calcString = `${formatNumber(previousValue)} ${OP_SYMBOLS[operator]} ${formatNumber(inputValue)}`;

    currentInput = formatNumber(result);
    lastCalculationString = calcString;
    lastAnswer = result;

    previousValue = null;
    operator = null;
    overwrite = true;
    updateDisplay();
    return true;
  }
  return false;
}

function handleEquals() {
  const resolved = resolvePendingOperation();
  if (!resolved) {
    lastCalculationString = currentInput;
    lastAnswer = parseFloat(currentInput);
  }
}

function clearAll() {
  currentInput = '0';
  previousValue = null;
  operator = null;
  overwrite = true;
  updateDisplay();
}

function negate() {
  if (currentInput === '0') return;
  currentInput = currentInput.startsWith('-') ? currentInput.slice(1) : `-${currentInput}`;
  updateDisplay();
}

function percent() {
  const value = parseFloat(currentInput);
  let result;
  if (operator && previousValue !== null && (operator === 'add' || operator === 'subtract')) {
    result = previousValue * (value / 100);
  } else {
    result = value / 100;
  }
  currentInput = formatNumber(result);
  overwrite = true;
  updateDisplay();
}

function showToast(message, isError = false) {
  toastEl.textContent = message;
  toastEl.classList.toggle('toast--error', isError);
  toastEl.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.remove('show'), 2000);
}

async function saveCalculation() {
  let calculation = lastCalculationString;
  let answer = lastAnswer;

  if (operator && previousValue !== null) {
    resolvePendingOperation();
    calculation = lastCalculationString;
    answer = lastAnswer;
  } else if (calculation === null) {
    calculation = currentInput;
    answer = parseFloat(currentInput);
  }

  if (!Number.isFinite(answer)) {
    showToast('Nothing to save', true);
    return;
  }

  try {
    const res = await fetch('/api/calculations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ calculation, answer }),
    });
    if (!res.ok) throw new Error('Request failed');
    showToast('Saved!');
  } catch (err) {
    showToast('Failed to save', true);
  }
}

document.querySelectorAll('[data-digit]').forEach((btn) => {
  btn.addEventListener('click', () => inputDigit(btn.dataset.digit));
});

document.querySelectorAll('[data-action]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action;
    switch (action) {
      case 'add':
      case 'subtract':
      case 'multiply':
      case 'divide':
        chooseOperator(action);
        break;
      case 'equals':
        handleEquals();
        updateDisplay();
        break;
      case 'clear':
        clearAll();
        break;
      case 'negate':
        negate();
        break;
      case 'percent':
        percent();
        break;
      case 'decimal':
        inputDigit('.');
        break;
      case 'save':
        saveCalculation();
        break;
    }
  });
});

window.addEventListener('keydown', (e) => {
  if (e.key >= '0' && e.key <= '9') {
    inputDigit(e.key);
  } else if (e.key === '.') {
    inputDigit('.');
  } else if (e.key === '+') {
    chooseOperator('add');
  } else if (e.key === '-') {
    chooseOperator('subtract');
  } else if (e.key === '*') {
    chooseOperator('multiply');
  } else if (e.key === '/') {
    e.preventDefault();
    chooseOperator('divide');
  } else if (e.key === 'Enter' || e.key === '=') {
    handleEquals();
    updateDisplay();
  } else if (e.key === 'Escape') {
    clearAll();
  } else if (e.key === 'Backspace') {
    if (!overwrite && currentInput.length > 1) {
      currentInput = currentInput.slice(0, -1);
    } else {
      currentInput = '0';
      overwrite = true;
    }
    updateDisplay();
  } else if (e.key === '%') {
    percent();
  } else if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    saveCalculation();
  }
});

updateDisplay();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}
