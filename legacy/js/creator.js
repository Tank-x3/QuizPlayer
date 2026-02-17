document.addEventListener('DOMContentLoaded', () => {
    let isDirty = false;
    let loadedFileName = null;

    // === HTML要素取得 ===
    const quizForm = document.getElementById('quiz-form');
    // ... (省略)
    const questionsContainer = document.getElementById('questions-container');
    const questionCountEl = document.getElementById('question-count');
    // ... (省略)
    const resultMessagesContainer = document.getElementById('result-messages-container');
    // ... (省略)
    const newQuizBtn = document.getElementById('new-quiz-btn');
    const loadJsonFileBtn = document.getElementById('load-json-file');
    const saveJsonBtn = document.getElementById('save-json-btn');
    const addQuestionBtn = document.getElementById('add-question-btn');
    const addResultMessageBtn = document.getElementById('add-result-message-btn');

    const questionTemplate = document.getElementById('question-template');
    const optionTemplate = document.getElementById('option-template');
    const resultMessageTemplate = document.getElementById('result-message-template');

    // === イベントリスナー ===
    newQuizBtn.addEventListener('click', handleNewQuiz);
    loadJsonFileBtn.addEventListener('change', handleFileLoad);
    saveJsonBtn.addEventListener('click', handleSave);
    addQuestionBtn.addEventListener('click', addQuestion);
    addResultMessageBtn.addEventListener('click', () => addResultMessage());
    quizForm.addEventListener('input', () => { isDirty = true; });
    window.addEventListener('beforeunload', (e) => {
        if (isDirty) { e.preventDefault(); e.returnValue = ''; }
    });

    // === 初期化 ===
    resetForm();

    // =============================
    // === 関数定義 ===
    // =============================

    function handleNewQuiz() {
        if (isDirty && !confirm('編集中の内容が破棄されますが、よろしいですか？')) return;
        resetForm();
    }

    function resetForm() {
        quizForm.reset();
        questionsContainer.innerHTML = '';
        resultMessagesContainer.innerHTML = '';
        loadedFileName = null;
        addQuestion();
        addResultMessage({ score: 100 });
        addResultMessage({ score: 0 });
        updateAllMessageCalculations();
        isDirty = false;
    }

    function addQuestion() {
        const clone = questionTemplate.content.cloneNode(true);
        const questionBlock = clone.querySelector('.question-block');
        questionBlock.querySelector('.delete-question-btn').addEventListener('click', () => {
            questionBlock.remove();
            updateQuestionNumbers();
        });
        questionBlock.querySelector('.add-option-btn').addEventListener('click', (e) => {
            addOption(e.target.previousElementSibling);
        });
        const optionsContainer = questionBlock.querySelector('.options-container');
        addOption(optionsContainer);
        addOption(optionsContainer);
        questionsContainer.appendChild(clone);
        updateQuestionNumbers();
    }

    function addOption(container) { /* ... (変更なし) ... */ }
    function addOption(container) {
        const clone = optionTemplate.content.cloneNode(true);
        const optionBlock = clone.querySelector('.option-block');
        optionBlock.querySelector('.delete-option-btn').addEventListener('click', () => {
            optionBlock.remove();
            isDirty = true;
        });
        container.appendChild(clone);
        isDirty = true;
    }

    function addResultMessage(data = { score: '', message: '' }) {
        const clone = resultMessageTemplate.content.cloneNode(true);
        const block = clone.querySelector('.result-message-block');
        const scoreInput = block.querySelector('.result-score');
        const countInput = block.querySelector('.result-count');

        scoreInput.value = data.score !== undefined ? data.score : '';
        block.querySelector('.result-message').value = data.message || '';

        block.querySelector('.delete-result-message-btn').addEventListener('click', () => {
            block.remove();
            isDirty = true;
        });

        scoreInput.addEventListener('change', () => updateResultMessageFields(block, 'score'));
        countInput.addEventListener('change', () => updateResultMessageFields(block, 'count'));
        // 整数以外をペーストされた場合などを考慮
        scoreInput.addEventListener('input', e => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });

        resultMessagesContainer.appendChild(clone);
    }

    function updateQuestionNumbers() {
        const total = questionsContainer.children.length;
        questionCountEl.textContent = total;
        questionsContainer.querySelectorAll('.question-title').forEach((title, index) => {
            title.textContent = `問題 ${index + 1}`;
        });
        updateAllMessageCalculations(); // 問題数変更時にメッセージ基準を再計算
        isDirty = true;
    }

    // ★★★ 動的連携のコアロジック ★★★
    function updateResultMessageFields(block, changedSource) {
        const scoreInput = block.querySelector('.result-score');
        const countInput = block.querySelector('.result-count');
        const totalQuestions = questionsContainer.children.length || 1; // 0除算を避ける

        if (changedSource === 'score') {
            const score = parseInt(scoreInput.value, 10) || 0;
            const count = Math.ceil(totalQuestions * score / 100);
            countInput.value = count;
        } else { // 'count'
            let count = parseInt(countInput.value, 10) || 0;

            if (count > totalQuestions) {
                const required = count - totalQuestions;
                if (confirm(`正解数が総問題数を超えています。\n不足している ${required} 問分の問題フォームを自動で追加しますか？`)) {
                    for (let i = 0; i < required; i++) {
                        addQuestion();
                    }
                } else {
                    count = totalQuestions;
                    countInput.value = count;
                }
            }
            const newTotal = questionsContainer.children.length || 1;
            const score = Math.floor(count / newTotal * 100);
            scoreInput.value = score;
        }
        isDirty = true;
    }

    function updateAllMessageCalculations() {
        resultMessagesContainer.querySelectorAll('.result-message-block').forEach(block => {
            updateResultMessageFields(block, 'score');
        });
    }

    function handleFileLoad(event) { /* ... (変更なし) ... */ }
    function handleFileLoad(event) {
        if (isDirty && !confirm('編集中の内容が破棄されますが、よろしいですか？')) {
            loadJsonFileBtn.value = '';
            return;
        }
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                let data = JSON.parse(e.target.result);
                // Check for NotebookLM formats
                // Old: { quiz: [...] }
                // New: { questions: [...] } (and ideally no resultMessages which suggests internal format)
                if ((data.quiz && Array.isArray(data.quiz)) ||
                    (data.questions && Array.isArray(data.questions) && !data.resultMessages)) {
                    data = convertNotebookLMData(data, file.name);
                }
                loadDataToForm(data);
                loadedFileName = file.name;
                isDirty = false;
            } catch (error) {
                console.error("File loading or parsing error:", error);
                alert('JSONファイルの読み込みまたは解析に失敗しました。');
                loadedFileName = null;
            }
        };
        reader.readAsText(file);
        loadJsonFileBtn.value = '';
    }

    function convertNotebookLMData(notebookData, fileName) { /* ... (変更なし) ... */ }
    function convertNotebookLMData(notebookData, fileName) {
        // Determine source array
        const questionsSource = notebookData.questions || notebookData.quiz || [];

        // Determine title
        let title = fileName.replace(/\.[^/.]+$/, "");
        if (notebookData.title) {
            title = notebookData.title;
        }

        const siteData = {
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
        return siteData;
    }

    function loadDataToForm(data) {
        quizForm.reset();
        questionsContainer.innerHTML = '';
        resultMessagesContainer.innerHTML = '';

        document.getElementById('quiz-title').value = data.title || '';
        document.getElementById('quiz-category').value = data.category || '';
        document.getElementById('quiz-difficulty').value = data.difficulty || '';
        document.getElementById('quiz-description').value = data.description || '';
        document.getElementById('quiz-detailed-description').value = data.detailedDescription || '';

        if (data.questions) {
            data.questions.forEach(q => {
                const clone = questionTemplate.content.cloneNode(true);
                const questionBlock = clone.querySelector('.question-block');
                questionBlock.querySelector('.question-statement').value = q.statement || '';
                questionBlock.querySelector('.question-hint').value = q.hint || '';
                const optionsContainer = questionBlock.querySelector('.options-container');
                if (q.options) {
                    q.options.forEach(opt => {
                        const optClone = optionTemplate.content.cloneNode(true);
                        const optionBlock = optClone.querySelector('.option-block');
                        optionBlock.querySelector('.correct-option-checkbox').checked = opt.isCorrect || false;
                        optionBlock.querySelector('.option-text').value = opt.text || '';
                        optionBlock.querySelector('.option-explanation').value = opt.explanation || '';
                        optionBlock.querySelector('.delete-option-btn').addEventListener('click', () => { optionBlock.remove(); isDirty = true; });
                        optionsContainer.appendChild(optClone);
                    });
                }
                questionBlock.querySelector('.delete-question-btn').addEventListener('click', () => { questionBlock.remove(); updateQuestionNumbers(); });
                questionBlock.querySelector('.add-option-btn').addEventListener('click', (e) => addOption(e.target.previousElementSibling));
                questionsContainer.appendChild(clone);
            });
        }
        updateQuestionNumbers();

        if (data.resultMessages) data.resultMessages.forEach(msg => addResultMessage(msg));
        updateAllMessageCalculations();
    }

    function handleSave() {
        if (!validateForm()) {
            alert('入力内容にエラーがあります。赤枠やオレンジ枠の項目を確認してください。\n（正解数の基準が重複している箇所はオレンジ枠で表示されます）');
            return;
        }
        const quizData = buildJsonObject();
        const jsonString = JSON.stringify(quizData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        let fileName;
        if (loadedFileName) {
            fileName = loadedFileName;
        } else {
            const invalidChars = /[\\/:*?"<>|\s]/g;
            fileName = (quizData.title || 'quiz').replace(invalidChars, '_') + '.json';
        }
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        loadedFileName = fileName;
        isDirty = false;
    }
    function buildJsonObject() {
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

    // ★★★ バリデーション強化 ★★★
    function validateForm() {
        let isValid = true;
        quizForm.querySelectorAll('.invalid, .duplicate').forEach(el => {
            el.classList.remove('invalid');
            el.classList.remove('duplicate');
        });
        quizForm.querySelectorAll('input[required], textarea[required]').forEach(input => {
            if (!input.value.trim()) {
                input.classList.add('invalid');
                isValid = false;
            }
        });
        questionsContainer.querySelectorAll('.question-block').forEach(block => {
            if (block.querySelectorAll('.correct-option-checkbox:checked').length === 0) {
                block.style.border = '2px solid red';
                isValid = false;
            } else {
                block.style.border = '1px solid #ddd';
            }
        });

        // 正解数の重複チェック
        const counts = new Map();
        resultMessagesContainer.querySelectorAll('.result-message-block').forEach(block => {
            const count = block.querySelector('.result-count').value;
            if (!counts.has(count)) {
                counts.set(count, []);
            }
            counts.get(count).push(block);
        });
        counts.forEach((blocks, count) => {
            if (blocks.length > 1) {
                blocks.forEach(b => b.classList.add('duplicate'));
                isValid = false;
            }
        });

        return isValid;
    }
});