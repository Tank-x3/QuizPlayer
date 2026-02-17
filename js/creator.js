document.addEventListener('DOMContentLoaded', () => {
    let isDirty = false;
    let loadedFileName = null;

    // === HTML要素取得 ===
    const quizForm = document.getElementById('quiz-form');
    const newQuizBtn = document.getElementById('new-quiz-btn');
    const loadJsonFileBtn = document.getElementById('load-json-file');
    const saveJsonBtn = document.getElementById('save-json-btn');
    const questionsContainer = document.getElementById('questions-container');
    const addQuestionBtn = document.getElementById('add-question-btn');
    const resultMessagesContainer = document.getElementById('result-messages-container');
    const addResultMessageBtn = document.getElementById('add-result-message-btn');

    // === テンプレート取得 ===
    const questionTemplate = document.getElementById('question-template');
    const optionTemplate = document.getElementById('option-template');
    const resultMessageTemplate = document.getElementById('result-message-template');

    // === イベントリスナー ===
    newQuizBtn.addEventListener('click', handleNewQuiz);
    loadJsonFileBtn.addEventListener('change', handleFileLoad);
    saveJsonBtn.addEventListener('click', handleSave);
    addQuestionBtn.addEventListener('click', addQuestion);
    addResultMessageBtn.addEventListener('click', addResultMessage);
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
        addResultMessage({ score: 100, message: "全問正解！" });
        addResultMessage({ score: 0, message: "残念！" });
        isDirty = false;
    }

    function addQuestion() {
        const clone = questionTemplate.content.cloneNode(true);
        const questionBlock = clone.querySelector('.question-block');
        questionBlock.querySelector('.delete-question-btn').addEventListener('click', () => {
            questionBlock.remove();
            updateQuestionNumbers();
            isDirty = true;
        });
        questionBlock.querySelector('.add-option-btn').addEventListener('click', (e) => {
            addOption(e.target.previousElementSibling);
        });
        const optionsContainer = questionBlock.querySelector('.options-container');
        addOption(optionsContainer); // 選択肢1
        addOption(optionsContainer); // 選択肢2
        questionsContainer.appendChild(clone);
        updateQuestionNumbers();
        isDirty = true;
    }

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
        block.querySelector('.result-score').value = data.score;
        block.querySelector('.result-message').value = data.message;
        block.querySelector('.delete-result-message-btn').addEventListener('click', () => {
            block.remove();
            isDirty = true;
        });
        resultMessagesContainer.appendChild(clone);
        isDirty = true;
    }
    
    function updateQuestionNumbers() {
        questionsContainer.querySelectorAll('.question-title').forEach((title, index) => {
            title.textContent = `問題 ${index + 1}`;
        });
    }

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
                if (data.quiz && Array.isArray(data.quiz)) {
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
    function convertNotebookLMData(notebookData, fileName) {
        const siteData = {
            title: fileName.replace(/\.[^/.]+$/, ""),
            category: "",
            difficulty: "",
            description: "",
            detailedDescription: "",
            resultMessages: [
                { score: 100, message: "パーフェクト！" },
                { score: 0, message: "再挑戦お待ちしています！" }
            ],
            questions: notebookData.quiz.map(q => ({
                type: "single-choice",
                statement: q.question || "",
                hint: q.hint || "",
                options: q.answerOptions.map(opt => ({
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

        if (data.resultMessages) data.resultMessages.forEach(msg => addResultMessage(msg));

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
                
                questionBlock.querySelector('.delete-question-btn').addEventListener('click', () => { questionBlock.remove(); updateQuestionNumbers(); isDirty = true; });
                questionBlock.querySelector('.add-option-btn').addEventListener('click', (e) => addOption(e.target.previousElementSibling));
                questionsContainer.appendChild(clone);
            });
        }
        updateQuestionNumbers();
    }
    
    function handleSave() {
        if (!validateForm()) {
            alert('入力内容にエラーがあります。赤枠の項目を確認してください。\n（各問題に、正解の選択肢が1つ以上設定されている必要があります）');
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
    /** フォームからJSONオブジェクトを構築 */
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

    /** バリデーション処理 */
    function validateForm() {
        let isValid = true;
        quizForm.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
        quizForm.querySelectorAll('input[required], textarea[required]').forEach(input => {
            if (!input.value.trim()) {
                input.classList.add('invalid');
                isValid = false;
            }
        });
        questionsContainer.querySelectorAll('.question-block').forEach(block => {
            const checkedCheckboxes = block.querySelectorAll('.correct-option-checkbox:checked');
            // 正解が1つも設定されていない場合にエラー
            if (checkedCheckboxes.length === 0) {
                block.style.border = '2px solid red';
                isValid = false;
            } else {
                block.style.border = '1px solid #ddd';
            }
        });
        return isValid;
    }
});