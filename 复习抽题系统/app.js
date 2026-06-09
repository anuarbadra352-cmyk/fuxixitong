const state = {
  allQuestions: [],
  filteredQuestions: [],
  currentQuestion: null,
  answerVisible: false,
};

const typeOrder = ["choice", "multi_choice", "judge", "blank", "short_answer", "application", "unknown"];
const fallbackTypeNames = {
  choice: "选择题",
  multi_choice: "多项选择题",
  judge: "判断题",
  blank: "填空题",
  short_answer: "简答题",
  application: "综合应用题",
  unknown: "未知题型",
};

const elements = {
  loadStatus: document.querySelector("#loadStatus"),
  totalCount: document.querySelector("#totalCount"),
  usableCount: document.querySelector("#usableCount"),
  reviewCount: document.querySelector("#reviewCount"),
  filteredCount: document.querySelector("#filteredCount"),
  sourceFilter: document.querySelector("#sourceFilter"),
  typeFilter: document.querySelector("#typeFilter"),
  includeReview: document.querySelector("#includeReview"),
  reviewOnly: document.querySelector("#reviewOnly"),
  questionMeta: document.querySelector("#questionMeta"),
  reviewAlert: document.querySelector("#reviewAlert"),
  questionText: document.querySelector("#questionText"),
  optionsList: document.querySelector("#optionsList"),
  answerBox: document.querySelector("#answerBox"),
  answerText: document.querySelector("#answerText"),
  randomButton: document.querySelector("#randomButton"),
  answerButton: document.querySelector("#answerButton"),
  nextButton: document.querySelector("#nextButton"),
};

async function loadQuestions() {
  try {
    const response = await fetch("data/questions.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const questions = await response.json();
    if (!Array.isArray(questions)) {
      throw new Error("questions.json 不是数组格式");
    }

    state.allQuestions = questions;
    populateFilters();
    updateFilteredQuestions();
    setLoadStatus(`已加载 ${questions.length} 道题`, "ready");
  } catch (error) {
    setLoadStatus("题库加载失败", "error");
    elements.questionMeta.textContent = "无法读取 data/questions.json。请用本地服务器打开页面，例如：python -m http.server 8000。";
    elements.questionText.textContent = error.message;
    elements.randomButton.disabled = true;
  }
}

function setLoadStatus(text, status) {
  elements.loadStatus.textContent = text;
  elements.loadStatus.classList.remove("ready", "error");
  if (status) {
    elements.loadStatus.classList.add(status);
  }
}

function populateFilters() {
  const sources = [...new Set(state.allQuestions.map((question) => question.source).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "zh-CN")
  );

  const types = [...new Set(state.allQuestions.map((question) => question.type).filter(Boolean))].sort(
    (a, b) => typeOrder.indexOf(a) - typeOrder.indexOf(b)
  );

  for (const source of sources) {
    const option = document.createElement("option");
    option.value = source;
    option.textContent = source;
    elements.sourceFilter.appendChild(option);
  }

  for (const type of types) {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = getTypeName({ type });
    elements.typeFilter.appendChild(option);
  }
}

function updateFilteredQuestions() {
  const source = elements.sourceFilter.value;
  const type = elements.typeFilter.value;
  const includeReview = elements.includeReview.checked;
  const reviewOnly = elements.reviewOnly.checked;

  state.filteredQuestions = state.allQuestions.filter((question) => {
    if (reviewOnly && !question.needsReview) return false;
    if (!reviewOnly && !includeReview && question.needsReview) return false;
    if (source !== "all" && question.source !== source) return false;
    if (type !== "all" && question.type !== type) return false;
    return true;
  });

  renderStats();
  elements.randomButton.disabled = state.filteredQuestions.length === 0;
}

function renderStats() {
  const total = state.allQuestions.length;
  const review = state.allQuestions.filter((question) => question.needsReview).length;
  const usable = total - review;

  elements.totalCount.textContent = total;
  elements.usableCount.textContent = usable;
  elements.reviewCount.textContent = review;
  elements.filteredCount.textContent = state.filteredQuestions.length;
}

function pickRandomQuestion() {
  if (state.filteredQuestions.length === 0) {
    state.currentQuestion = null;
    state.answerVisible = false;
    renderEmptyQuestion("当前筛选条件下没有可抽取的题目。", "可以尝试切换来源、题型，或开启“包含待校对题”。");
    return;
  }

  const randomIndex = Math.floor(Math.random() * state.filteredQuestions.length);
  state.currentQuestion = state.filteredQuestions[randomIndex];
  state.answerVisible = false;
  renderQuestion();
}

function renderQuestion() {
  const question = state.currentQuestion;
  if (!question) return;

  const metaParts = [
    question.id,
    getTypeName(question),
    question.source,
    question.section,
  ].filter(Boolean);

  elements.questionMeta.textContent = metaParts.join(" · ");
  elements.questionText.textContent = question.question || "题干为空，请检查原始题库。";
  elements.reviewAlert.classList.toggle("hidden", !question.needsReview);
  renderOptions(question.options || []);
  renderAnswer();

  elements.answerButton.disabled = false;
  elements.answerButton.textContent = "显示答案";
  elements.nextButton.disabled = false;
}

function renderOptions(options) {
  elements.optionsList.replaceChildren();

  for (const optionText of options) {
    const item = document.createElement("li");
    item.textContent = optionText;
    elements.optionsList.appendChild(item);
  }
}

function renderAnswer() {
  if (!state.currentQuestion || !state.answerVisible) {
    elements.answerBox.classList.add("hidden");
    elements.answerText.textContent = "";
    return;
  }

  elements.answerText.textContent = state.currentQuestion.answer || "暂无答案，请检查 data/questions-review.json。";
  elements.answerBox.classList.remove("hidden");
}

function toggleAnswer() {
  if (!state.currentQuestion) return;
  state.answerVisible = !state.answerVisible;
  elements.answerButton.textContent = state.answerVisible ? "隐藏答案" : "显示答案";
  renderAnswer();
}

function renderEmptyQuestion(title, message) {
  elements.questionMeta.textContent = message;
  elements.questionText.textContent = title;
  elements.optionsList.replaceChildren();
  elements.reviewAlert.classList.add("hidden");
  elements.answerBox.classList.add("hidden");
  elements.answerButton.disabled = true;
  elements.nextButton.disabled = true;
}

function getTypeName(question) {
  return question.typeName || fallbackTypeNames[question.type] || question.type || "未知题型";
}

function handleFilterChange() {
  if (elements.reviewOnly.checked) {
    elements.includeReview.checked = true;
    elements.includeReview.disabled = true;
  } else {
    elements.includeReview.disabled = false;
  }

  updateFilteredQuestions();
  state.currentQuestion = null;
  state.answerVisible = false;
  const message = elements.reviewOnly.checked ? "当前只会抽取需要校对的题目。" : "请点击“随机抽题”开始。";
  renderEmptyQuestion("筛选条件已更新", message);
}

elements.sourceFilter.addEventListener("change", handleFilterChange);
elements.typeFilter.addEventListener("change", handleFilterChange);
elements.includeReview.addEventListener("change", handleFilterChange);
elements.reviewOnly.addEventListener("change", handleFilterChange);
elements.randomButton.addEventListener("click", pickRandomQuestion);
elements.nextButton.addEventListener("click", pickRandomQuestion);
elements.answerButton.addEventListener("click", toggleAnswer);

loadQuestions();
