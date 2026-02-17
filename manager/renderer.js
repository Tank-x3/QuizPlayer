const api = window.electronAPI;

// === State ===
let currentQuizFilename = null;
let currentCategories = []; // Array of strings
const SYSTEM_FILES = ['quiz_list.json', 'categories.json'];

// === DOM Elements ===
// Tabs
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

// Quiz Editor
const quizFileList = document.getElementById('quiz-file-list');
const refreshFilesBtn = document.getElementById('refresh-files-btn');
const createNewQuizBtn = document.getElementById('create-new-quiz-btn');
const saveQuizBtn = document.getElementById('save-quiz-btn');
const deleteQuizBtn = document.getElementById('delete-quiz-btn');
const currentFilenameEl = document.getElementById('current-filename');

// Form
const quizForm = document.getElementById('quiz-form');
const questionsContainer = document.getElementById('questions-container');
const resultMessagesContainer = document.getElementById('result-messages-container');
const questionTemplate = document.getElementById('question-template');
const optionTemplate = document.getElementById('option-template');
const resultMessageTemplate = document.getElementById('result-message-template');
const categorySuggestions = document.getElementById('category-suggestions');

// Category Manager
const categoryListEl = document.getElementById('category-list');
const newCategoryInput = document.getElementById('new-category-input');
const addCategoryBtn = document.getElementById('add-category-btn');
const saveCategoriesBtn = document.getElementById('save-categories-btn');

// Integrity Checker
const runCheckBtn = document.getElementById('run-check-btn');
const fixQuizListBtn = document.getElementById('fix-quiz-list-btn');
const checkResultsEl = document.getElementById('check-results');
const autoFixArea = document.getElementById('auto-fix-area');


// === Initialization ===
document.addEventListener('DOMContentLoaded', async () => {
  // Tabs
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');

      if (tab.dataset.tab === 'category-manager') {
        loadCategories();
      }
    });
  });

  // Quiz Editor Events
  refreshFilesBtn.addEventListener('click', loadQuizList);
  createNewQuizBtn.addEventListener('click', () => {
    if (confirmIfDirty()) resetForm();
  });
  saveQuizBtn.addEventListener('click', saveCurrentQuiz);
  deleteQuizBtn.addEventListener('click', deleteCurrentQuiz);
  document.getElementById('import-json-file').addEventListener('change', handleFileImport);

  document.getElementById('add-question-btn').addEventListener('click', addQuestion);
  document.getElementById('add-result-message-btn').addEventListener('click', () => addResultMessage());

  // Category Manager Events
  addCategoryBtn.addEventListener('click', addNewCategory);
  saveCategoriesBtn.addEventListener('click', saveCategories);

  // Integrity Checker Events
  runCheckBtn.addEventListener('click', runIntegrityCheck);
  fixQuizListBtn.addEventListener('click', fixQuizList);

  // Initial Load
  await loadCategories(); // For suggestions
  await loadQuizList();
  resetForm();
});


// ============================================================
// === Quiz Editor Logic ===
// ============================================================

async function loadQuizList() {
  try {
    const files = await api.listFiles();
    const quizFiles = files.filter(f => !SYSTEM_FILES.includes(f));

    quizFileList.innerHTML = '';
    quizFiles.forEach(file => {
      const div = document.createElement('div');
      div.className = 'file-list-item';
      div.textContent = file;
      div.addEventListener('click', () => {
        if (confirmIfDirty()) loadQuiz(file);
      });
      quizFileList.appendChild(div);
    });
  } catch (e) {
    console.error(e);
    alert('ファイル一覧の取得に失敗しました');
  }
}

async function loadQuiz(filename) {
  try {
    const data = await api.readFile(filename);
    currentQuizFilename = filename;
    currentFilenameEl.textContent = filename;

    // Highlight in list
    document.querySelectorAll('.file-list-item').forEach(el => {
      el.classList.toggle('selected', el.textContent === filename);
    });

    // Form Population
    populateForm(data);

  } catch (e) {
    console.error(e);
    alert(`読み込みエラー: ${filename}\n${e.message}`);
  }
}

function resetForm() {
  currentQuizFilename = null;
  currentFilenameEl.textContent = '(新規)';
  quizForm.reset();
  questionsContainer.innerHTML = '';
  resultMessagesContainer.innerHTML = '';

  // Default Messages
  addResultMessage({ score: 100, message: 'パーフェクト！' });
  addResultMessage({ score: 0, message: '再挑戦お待ちしています！' });

  // Default Question
  addQuestion();

  document.querySelectorAll('.file-list-item').forEach(el => el.classList.remove('selected'));
}

async function saveCurrentQuiz() {
  if (!validateForm()) return;

  const quizData = buildQuizObject();

  let filename = currentQuizFilename;
  if (!filename) {
    // Generate filename from title
    const invalidChars = /[\\/:*?"<>|\s]/g;
    filename = (quizData.title || 'quiz').replace(invalidChars, '_') + '.json';
  }

  try {
    await api.writeFile(filename, quizData);
    alert('保存しました');

    // Update list if new
    if (currentQuizFilename !== filename) {
      currentQuizFilename = filename;
      await loadQuizList();
      // Reselect the new file
      loadQuiz(filename);
    }

  } catch (e) {
    console.error(e);
    alert('保存エラー: ' + e.message);
  }
}

async function deleteCurrentQuiz() {
  if (!currentQuizFilename) return;
  if (!confirm(`本当に ${currentQuizFilename} を削除しますか？\nこの操作は取り消せません。`)) return;

  try {
    await api.deleteFile(currentQuizFilename);
    alert('削除しました');
    resetForm();
    await loadQuizList();
  } catch (e) {
    alert('削除エラー: ' + e.message);
  }
}


// --- Import Logic ---

function handleFileImport(event) {
  if (confirmIfDirty()) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let data = JSON.parse(e.target.result);
        // Check for NotebookLM formats (Logic from legacy/creator.js)
        if ((data.quiz && Array.isArray(data.quiz)) ||
          (data.questions && Array.isArray(data.questions) && !data.resultMessages)) {
          data = convertNotebookLMData(data, file.name);
        }

        resetForm(); // Clear current
        populateForm(data);
        currentQuizFilename = null; // Staged as new
        currentFilenameEl.textContent = `${file.name} (未保存)`;

        document.getElementById('import-json-file').value = ''; // Reset input
      } catch (error) {
        console.error("File loading or parsing error:", error);
        alert('JSONファイルの読み込みまたは解析に失敗しました。');
      }
    };
    reader.readAsText(file);
  } else {
    event.target.value = '';
  }
}

function convertNotebookLMData(notebookData, fileName) {
  const questionsSource = notebookData.questions || notebookData.quiz || [];
  let title = fileName.replace(/\.[^/.]+$/, "");
  if (notebookData.title) title = notebookData.title;

  return {
    title: title,
    category: "",
    difficulty: "",
    description: "",
    detailedDescription: "",
    resultMessages: [
      { score: 100, message: "パーフェクト！" },
      { score: 0, message: "再挑戦お待ちしています！" }
    ],
    questions: questionsSource.map(q => ({
      type: "single-choice",
      statement: q.question || "",
      hint: q.hint || "",
      options: (q.answerOptions || []).map(opt => ({
        text: opt.text || "",
        isCorrect: opt.isCorrect || false,
        explanation: opt.rationale || ""
      }))
    }))
  };
}

function populateForm(data) {
  document.getElementById('quiz-title').value = data.title || '';
  document.getElementById('quiz-category').value = data.category || '';
  document.getElementById('quiz-difficulty').value = data.difficulty || '';
  document.getElementById('quiz-description').value = data.description || '';
  document.getElementById('quiz-detailed-description').value = data.detailedDescription || '';

  questionsContainer.innerHTML = '';
  if (data.questions) {
    data.questions.forEach(q => addQuestionData(q));
  }
  updateQuestionCounts();

  resultMessagesContainer.innerHTML = '';
  if (data.resultMessages) {
    data.resultMessages.forEach(msg => addResultMessage(msg));
  }
}


// --- Form Helpers ---

function addQuestion() {
  addQuestionData({});
}

function addQuestionData(q) {
  const clone = questionTemplate.content.cloneNode(true);
  const block = clone.querySelector('.question-block');

  block.querySelector('.question-statement').value = q.statement || '';
  block.querySelector('.question-hint').value = q.hint || '';

  const optionsContainer = block.querySelector('.options-container');
  const options = q.options || [];

  if (options.length === 0) {
    // Default options for new question
    addOption(optionsContainer);
    addOption(optionsContainer);
  } else {
    options.forEach(opt => addOption(optionsContainer, opt));
  }

  block.querySelector('.delete-question-btn').addEventListener('click', () => {
    block.remove();
    updateQuestionCounts();
  });
  block.querySelector('.add-option-btn').addEventListener('click', () => addOption(optionsContainer));

  questionsContainer.appendChild(clone);
  updateQuestionCounts();
}

function addOption(container, optData = {}) {
  const clone = optionTemplate.content.cloneNode(true);
  const block = clone.querySelector('.option-block');

  block.querySelector('.option-text').value = optData.text || '';
  block.querySelector('.option-explanation').value = optData.explanation || '';
  block.querySelector('.correct-option-checkbox').checked = optData.isCorrect || false;

  block.querySelector('.delete-option-btn').addEventListener('click', () => block.remove());
  container.appendChild(clone);
}

function addResultMessage(data = {}) {
    const clone = resultMessageTemplate.content.cloneNode(true);
    const block = clone.querySelector('.result-message-block');
    
    // Initial values
    const scoreInput = block.querySelector('.result-score');
    const countInput = block.querySelector('.result-count');
    
    scoreInput.value = data.score !== undefined ? data.score : '';
    block.querySelector('.result-message').value = data.message || '';
    
    // Calculate initial count based on score (if count not provided, though data model usually has score)
    const totalQuestions = questionsContainer.children.length || 1;
    if (data.score !== undefined) {
        countInput.value = Math.ceil(totalQuestions * data.score / 100);
    }

    block.querySelector('.delete-result-message-btn').addEventListener('click', () => block.remove());
    
    // Add Event Listeners for Sync
    scoreInput.addEventListener('input', () => updateResultMessageFields(block, 'score'));
    countInput.addEventListener('input', () => updateResultMessageFields(block, 'count'));

    resultMessagesContainer.appendChild(clone);
}

function updateResultMessageFields(block, changedSource) {
    const scoreInput = block.querySelector('.result-score');
    const countInput = block.querySelector('.result-count');
    const totalQuestions = questionsContainer.children.length || 1;

    if (changedSource === 'score') {
        const score = parseInt(scoreInput.value, 10) || 0;
        const count = Math.ceil(totalQuestions * score / 100);
        countInput.value = count;
    } else { // 'count'
        const count = parseInt(countInput.value, 10) || 0;
        const score = Math.floor(count / totalQuestions * 100);
        scoreInput.value = score; // Note: legacy had logic to add questions if count > total, skipping for simplicity unless requested
    }
}

function updateAllMessageCalculations() {
    resultMessagesContainer.querySelectorAll('.result-message-block').forEach(block => {
        updateResultMessageFields(block, 'score');
    });
}

function updateQuestionCounts() {
  const count = questionsContainer.children.length;
  document.getElementById('question-count').textContent = count;
  updateAllMessageCalculations(); // Recalculate when question count changes
}

function buildQuizObject() {
  const data = {
    title: document.getElementById('quiz-title').value,
    category: document.getElementById('quiz-category').value,
    difficulty: document.getElementById('quiz-difficulty').value,
    description: document.getElementById('quiz-description').value,
    detailedDescription: document.getElementById('quiz-detailed-description').value,
    resultMessages: [],
    questions: []
  };

  resultMessagesContainer.querySelectorAll('.result-message-block').forEach(block => {
    data.resultMessages.push({
      score: parseInt(block.querySelector('.result-score').value, 10),
      message: block.querySelector('.result-message').value
    });
  });

  questionsContainer.querySelectorAll('.question-block').forEach(block => {
    const question = {
      type: "single-choice",
      statement: block.querySelector('.question-statement').value,
      hint: block.querySelector('.question-hint').value,
      options: []
    };
    block.querySelectorAll('.option-block').forEach(optBlock => {
      question.options.push({
        text: optBlock.querySelector('.option-text').value,
        isCorrect: optBlock.querySelector('.correct-option-checkbox').checked,
        explanation: optBlock.querySelector('.option-explanation').value
      });
    });
    data.questions.push(question);
  });

  return data;
}

function validateForm() {
  if (!document.getElementById('quiz-title').value.trim()) {
    alert('タイトルを入力してください');
    return false;
  }
  // Simple validation for now
  return true;
}

function confirmIfDirty() {
  // Basic "dirty" check could be implemented, skipping for now
  return true;
}


// ============================================================
// === Category Manager Logic ===
// ============================================================

async function loadCategories() {
  try {
    // Load existing categories from file
    let categories = [];
    try {
      categories = await api.readFile('categories.json');
    } catch (e) {
      console.warn('categories.json not found, creating new');
      // If main file fails, maybe try to infer from all quizzes
    }

    currentCategories = Array.isArray(categories) ? categories : [];
    renderCategoryList();
    updateCategorySuggestions();
  } catch (e) {
    console.error(e);
    alert('カテゴリ読み込みエラー');
  }
}

function renderCategoryList() {
  categoryListEl.innerHTML = '';
  currentCategories.forEach((cat, index) => {
    const li = document.createElement('li');
    li.innerHTML = `
            <span>${cat}</span>
            <div>
                <button class="cat-up-btn" ${index === 0 ? 'disabled' : ''}>↑</button>
                <button class="cat-down-btn" ${index === currentCategories.length - 1 ? 'disabled' : ''}>↓</button>
                <button class="cat-del-btn" style="color: red;">×</button>
            </div>
        `;

    li.querySelector('.cat-up-btn').addEventListener('click', () => moveCategory(index, -1));
    li.querySelector('.cat-down-btn').addEventListener('click', () => moveCategory(index, 1));
    li.querySelector('.cat-del-btn').addEventListener('click', () => deleteCategory(index));

    categoryListEl.appendChild(li);
  });
}

function updateCategorySuggestions() {
  categorySuggestions.innerHTML = '';
  currentCategories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat;
    categorySuggestions.appendChild(option);
  });
}

function moveCategory(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= currentCategories.length) return;

  const temp = currentCategories[index];
  currentCategories[index] = currentCategories[newIndex];
  currentCategories[newIndex] = temp;
  renderCategoryList();
}

function deleteCategory(index) {
  if (confirm(`カテゴリ "${currentCategories[index]}" を削除しますか？`)) {
    currentCategories.splice(index, 1);
    renderCategoryList();
  }
}

function addNewCategory() {
  const name = newCategoryInput.value.trim();
  if (name && !currentCategories.includes(name)) {
    currentCategories.push(name);
    newCategoryInput.value = '';
    renderCategoryList();
  }
}

async function saveCategories() {
  try {
    await api.writeFile('categories.json', currentCategories);
    alert('カテゴリ順序を保存しました');
    updateCategorySuggestions();
  } catch (e) {
    alert('保存エラー: ' + e.message);
  }
}


// ============================================================
// === Integrity Checker Logic ===
// ============================================================

async function runIntegrityCheck() {
  checkResultsEl.innerHTML = 'チェック中...';
  try {
    const files = await api.listFiles();
    const quizFiles = files.filter(f => !SYSTEM_FILES.includes(f));

    let quizList = [];
    try {
      quizList = await api.readFile('quiz_list.json');
    } catch (e) {
      console.warn('quiz_list.json missing');
    }

    const missingFiles = quizList.filter(f => !files.includes(f));
    const orphanFiles = quizFiles.filter(f => !quizList.includes(f));

    let html = '';

    if (missingFiles.length === 0 && orphanFiles.length === 0) {
      html += '<div class="check-result ok">整合性は保たれています (quiz_list.json とファイルシステムが一致)</div>';
      autoFixArea.style.display = 'none';
    } else {
      if (missingFiles.length > 0) {
        html += `<div class="check-result error">見つからないファイル (quiz_list.jsonにあるが存在しない): <ul>${missingFiles.map(f => `<li>${f}</li>`).join('')}</ul></div>`;
      }
      if (orphanFiles.length > 0) {
        html += `<div class="check-result warning">未登録ファイル (フォルダにあるがquiz_list.jsonにない): <ul>${orphanFiles.map(f => `<li>${f}</li>`).join('')}</ul></div>`;
      }
      autoFixArea.style.display = 'block';
    }

    // Category Consistency Check
    const categoryWarnings = [];
    // Note: Reading all files might be slow if many, but fine for local tool
    for (const file of quizFiles) {
      try {
        const data = await api.readFile(file);
        if (data.category && !currentCategories.includes(data.category)) {
          categoryWarnings.push({
            msg: `${file}: カテゴリ "${data.category}" はカテゴリリストに登録されていません`,
            cat: data.category
          });
        }
      } catch (e) {
        // Ignore read errors here
      }
    }

    if (categoryWarnings.length > 0) {
      html += `<div class="check-result warning">カテゴリ不整合: 
                <ul>${categoryWarnings.map(w => {
        return `<li>${w.msg} <button onclick="fixCategory('${w.cat}')">カテゴリに追加</button></li>`;
      }).join('')}</ul>
            </div>`;
    }

    checkResultsEl.innerHTML = html;

  } catch (e) {
    checkResultsEl.innerHTML = `<div class="check-result error">エラー発生: ${e.message}</div>`;
  }
}

// Global for inline onclick
window.fixCategory = async (categoryName) => {
  if (!currentCategories.includes(categoryName)) {
    currentCategories.push(categoryName);
    await api.writeFile('categories.json', currentCategories);
    alert(`カテゴリ "${categoryName}" を追加しました`);
    loadCategories(); // Reload UI
    runIntegrityCheck(); // Re-run check
  }
};

async function fixQuizList() {
  if (!confirm('quiz_list.json をファイルシステムの現状に合わせて更新しますか？')) return;

  try {
    const files = await api.listFiles();
    const quizFiles = files.filter(f => !SYSTEM_FILES.includes(f));

    // Sort explicitly if needed, or keeping file system order (often alphabetical)
    quizFiles.sort((a, b) => a.localeCompare(b, 'ja'));

    await api.writeFile('quiz_list.json', quizFiles);
    alert('quiz_list.json を更新しました');
    runIntegrityCheck(); // Re-run check
  } catch (e) {
    alert('修正エラー: ' + e.message);
  }
}
