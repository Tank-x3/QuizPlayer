document.addEventListener('DOMContentLoaded', () => {
    // === 状態管理 ===
    let allQuizData = [];
    let currentQuiz = null;
    let currentQuestionIndex = 0;
    let score = 0;
    let selectedOptionIndex = null;

    // === HTML要素取得 ===
    const quizListContainer = document.getElementById('quiz-list');
    const screens = document.querySelectorAll('.screen');
    const themeSwitch = document.getElementById('theme-switch-checkbox');

    // クイズプレイ画面要素
    const quizTitleEl = document.getElementById('quiz-title');
    const questionCounterEl = document.getElementById('question-counter');
    const questionStatementEl = document.getElementById('question-statement');
    const hintContainer = document.querySelector('.hint-container');
    const hintToggleBtn = document.querySelector('.hint-toggle');
    const hintContent = document.querySelector('.hint-content');
    const optionsContainer = document.getElementById('options-container');
    const submitAnswerBtn = document.getElementById('submit-answer-btn');

    // === イベントリスナー設定 ===
    submitAnswerBtn.addEventListener('click', handleSubmitAnswer);
    hintToggleBtn.addEventListener('click', () => {
        hintContent.style.display = hintContent.style.display === 'block' ? 'none' : 'block';
    });
    document.getElementById('start-quiz-btn').addEventListener('click', startQuiz);
    document.getElementById('retry-quiz-btn').addEventListener('click', startQuiz);
    document.getElementById('back-to-list-btn').addEventListener('click', () => showScreen('list-screen'));
    themeSwitch.addEventListener('change', toggleTheme);

    // === 初期化処理 ===
    initializeTheme();
    loadAllQuizzes(); // ★★★ ページ読み込み時にクイズを自動で読み込む

    // =============================
    // === 関数定義 ===
    // =============================

    /** 画面を切り替える */
    function showScreen(screenId) {
        screens.forEach(screen => {
            screen.classList.toggle('active', screen.id === screenId);
        });
    }

    /** 全てのクイズデータを自動で読み込む */
    async function loadAllQuizzes() {
        try {
            // 1. 読み込むべきファイルの一覧を取得
            const listResponse = await fetch('data/quiz_list.json');
            if (!listResponse.ok) throw new Error('quiz_list.jsonが見つかりません。');
            const fileList = await listResponse.json();

            // 2. 一覧にあるファイルを並行して全て取得
            const quizPromises = fileList.map(fileName => 
                fetch(`data/${fileName}`).then(res => {
                    if (!res.ok) throw new Error(`${fileName}の読み込みに失敗しました。`);
                    return res.json();
                })
            );
            
            allQuizData = await Promise.all(quizPromises);
            displayQuizList();

        } catch (error) {
            console.error('クイズデータの読み込みに失敗しました:', error);
            quizListContainer.innerHTML = '<p>クイズデータの読み込みに失敗しました。管理者にお問い合わせください。</p>';
        }
    }

    /** クイズ一覧表示処理 */
    function displayQuizList() {
        quizListContainer.innerHTML = '';
        if (allQuizData.length === 0) {
            quizListContainer.innerHTML = '<p>表示できるクイズがありません。</p>';
            return;
        }

        const quizzesByCategory = allQuizData.reduce((acc, quiz) => {
            const category = quiz.category || '未分類';
            if (!acc[category]) acc[category] = [];
            acc[category].push(quiz);
            return acc;
        }, {});

        Object.entries(quizzesByCategory).forEach(([category, quizzes]) => {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'quiz-category';
            categoryDiv.innerHTML = `<h3>${category}</h3>`;

            quizzes.forEach(quiz => {
                const quizCard = document.createElement('div');
                quizCard.className = 'quiz-card';
                quizCard.innerHTML = `
                    <h4>${quiz.title}</h4>
                    <div class="quiz-meta">
                        <span>問題数: ${quiz.questions.length}</span>
                        <span>難易度: ${quiz.difficulty || '指定なし'}</span>
                    </div>
                    <p>${quiz.description || ''}</p>
                `;
                quizCard.addEventListener('click', () => showStartScreen(quiz));
                categoryDiv.appendChild(quizCard);
            });
            quizListContainer.appendChild(categoryDiv);
        });
    }

    /** 開始画面表示処理 */
    function showStartScreen(quizData) {
        currentQuiz = quizData;
        document.getElementById('start-quiz-title').textContent = currentQuiz.title;
        document.getElementById('start-quiz-description').textContent = currentQuiz.detailedDescription || currentQuiz.description;
        showScreen('start-screen');
    }
    /** クイズ開始処理 */
    function startQuiz() {
        currentQuestionIndex = 0;
        score = 0;
        quizTitleEl.textContent = currentQuiz.title;
        showScreen('play-screen');
        displayQuestion();
    }

    /** 問題表示処理 */
    function displayQuestion() {
        selectedOptionIndex = null;
        submitAnswerBtn.textContent = '回答する';
        submitAnswerBtn.disabled = true;

        const question = currentQuiz.questions[currentQuestionIndex];
        questionCounterEl.textContent = `Q.${currentQuestionIndex + 1} / Q.${currentQuiz.questions.length}`;
        questionStatementEl.textContent = question.statement;
        
        if (question.hint && question.hint.trim() !== '') {
            hintContainer.style.display = 'block';
            hintContent.textContent = question.hint;
            hintContent.style.display = 'none';
        } else {
            hintContainer.style.display = 'none';
        }

        optionsContainer.innerHTML = '';
        question.options.forEach((option, index) => {
            const labelChar = String.fromCharCode('A'.charCodeAt(0) + index);
            const optionCard = document.createElement('div');
            optionCard.className = 'option-card';
            optionCard.dataset.index = index;
            optionCard.innerHTML = `<span class="option-label">${labelChar}.</span><span class="option-text">${option.text}</span>`;
            
            optionCard.addEventListener('click', () => {
                if (submitAnswerBtn.textContent !== '回答する') return;
                optionsContainer.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
                optionCard.classList.add('selected');
                selectedOptionIndex = index;
                submitAnswerBtn.disabled = false;
            });
            optionsContainer.appendChild(optionCard);
        });
    }

    /** 回答ボタン処理 */
    function handleSubmitAnswer() {
        if (submitAnswerBtn.textContent === '回答する') {
            checkAnswer();
        } else {
            goToNextQuestion();
        }
    }
    
    /** 回答チェック処理 */
    function checkAnswer() {
        const question = currentQuiz.questions[currentQuestionIndex];
        const optionsCards = optionsContainer.querySelectorAll('.option-card');

        optionsCards.forEach((card, index) => {
            card.style.cursor = 'default';
            const isSelected = (index === selectedOptionIndex);
            const isCorrectOption = question.options[index].isCorrect;

            if (isCorrectOption || (isSelected && !isCorrectOption)) {
                card.classList.add(isCorrectOption ? 'correct' : 'incorrect');
                const feedbackDiv = document.createElement('div');
                feedbackDiv.className = 'feedback-content';
                let iconText = isCorrectOption ? '✓ 正解' : '× 不正解';
                feedbackDiv.innerHTML = `<div class="feedback-icon">${iconText}</div><div>${question.options[index].explanation}</div>`;
                card.appendChild(feedbackDiv);
            }
        });

        if (question.options[selectedOptionIndex].isCorrect) {
            score++;
        }

        if (currentQuestionIndex < currentQuiz.questions.length - 1) {
            submitAnswerBtn.textContent = '次の問題へ';
        } else {
            submitAnswerBtn.textContent = '結果を見る';
        }
    }

    /** 次の問題へ進む処理 */
    function goToNextQuestion() {
        currentQuestionIndex++;
        if (currentQuestionIndex < currentQuiz.questions.length) {
            displayQuestion();
        } else {
            showResultScreen();
        }
    }
    /** 結果表示処理 */
    function showResultScreen() {
        const total = currentQuiz.questions.length;
        const percentage = total > 0 ? (score / total) * 100 : 0;

        document.getElementById('result-summary').textContent = `${total}問中 ${score}問正解！ (正解率: ${percentage.toFixed(1)}%)`;
        
        const resultMessageEl = document.getElementById('result-message');
        if (currentQuiz.resultMessages && currentQuiz.resultMessages.length > 0) {
            const sortedMessages = [...currentQuiz.resultMessages].sort((a, b) => b.score - a.score);
            const messageObj = sortedMessages.find(m => percentage >= m.score);
            resultMessageEl.textContent = messageObj ? messageObj.message : '';
        } else {
            resultMessageEl.textContent = '';
        }

        showScreen('result-screen');
    }

    /** テーマ（ダークモード）切り替え */
    function toggleTheme() {
        if (themeSwitch.checked) {
            document.body.classList.add('dark-mode');
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('theme', 'light');
        }
    }

    /** テーマの初期化 */
    function initializeTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            themeSwitch.checked = true;
            document.body.classList.add('dark-mode');
        } else {
            themeSwitch.checked = false;
            document.body.classList.remove('dark-mode');
        }
    }
});