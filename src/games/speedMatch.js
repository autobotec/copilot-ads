import { sound } from '../audio.js';
import { TRANSLATIONS } from '../i18n.js';

export class SpeedMatchGame {
  constructor(containerEl, onScoreUpdate, onGameOver, lang = 'es') {
    this.container = containerEl;
    this.onScoreUpdate = onScoreUpdate;
    this.onGameOver = onGameOver;
    this.lang = lang;
    this.cards = [];
    this.flippedCards = [];
    this.matchedPairs = 0;
    this.moves = 0;
    this.timer = 40;
    this.timerInterval = null;
    this.isLocked = false;
    this.score = 0;
  }

  get t() {
    return TRANSLATIONS[this.lang] || TRANSLATIONS.es;
  }

  setLanguage(newLang) {
    this.lang = newLang;
    const timerLabel = this.container.querySelector('#matchTimerLabel');
    const movesLabel = this.container.querySelector('#matchMovesLabel');
    const pairsLabel = this.container.querySelector('#matchPairsLabel');
    const btnRestart = this.container.querySelector('#btnRestartMatch');
    const btnExit = this.container.querySelector('#btnExitMatch');

    if (timerLabel) timerLabel.textContent = `${this.t.matchTime} ${this.timer}s`;
    if (movesLabel) movesLabel.textContent = `${this.t.matchMoves} ${this.moves}`;
    if (pairsLabel) pairsLabel.textContent = `${this.t.matchPairs} ${this.matchedPairs}/6`;
    if (btnRestart) btnRestart.textContent = this.t.restart;
    if (btnExit) btnExit.textContent = this.t.returnToGames;
  }

  start() {
    this.matchedPairs = 0;
    this.moves = 0;
    this.timer = 40;
    this.flippedCards = [];
    this.isLocked = false;
    this.score = 0;
    clearInterval(this.timerInterval);

    const icons = ['⚡', '🎨', '🚀', '💎', '🍕', '🎵'];
    const deck = [...icons, ...icons];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    this.cards = deck.map((icon, index) => ({
      id: index,
      icon,
      isFlipped: false,
      isMatched: false
    }));

    this.render();
    this.startTimer();
  }

  render() {
    const t = this.t;
    this.container.innerHTML = `
      <div class="speed-match-wrap">
        <div class="match-status-bar">
          <div class="match-badge">${t.matchTitle}</div>
          <div class="match-timer" id="matchTimerLabel">${t.matchTime} ${this.timer}s</div>
          <div class="match-moves" id="matchMovesLabel">${t.matchMoves} ${this.moves}</div>
          <div class="match-pairs" id="matchPairsLabel">${t.matchPairs} 0/6</div>
        </div>

        <div class="cards-grid" id="cardsGrid">
          ${this.cards.map(c => `
            <button class="match-card" data-id="${c.id}" aria-label="Card">
              <div class="match-card-inner">
                <div class="match-card-front">
                  <span class="card-splash-icon">🎨</span>
                </div>
                <div class="match-card-back">
                  <span class="card-symbol">${c.icon}</span>
                </div>
              </div>
            </button>
          `).join('')}
        </div>

        <div class="match-controls">
          <button class="simon-btn-secondary" id="btnRestartMatch">${t.restart}</button>
          <button class="simon-btn-primary" id="btnExitMatch">${t.returnToGames}</button>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const cardBtns = this.container.querySelectorAll('.match-card');
    cardBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id, 10);
        this.handleCardClick(id, btn);
      });
    });

    const btnRestart = this.container.querySelector('#btnRestartMatch');
    if (btnRestart) {
      btnRestart.addEventListener('click', () => {
        sound.playTap();
        this.start();
      });
    }

    const btnExit = this.container.querySelector('#btnExitMatch');
    if (btnExit) {
      btnExit.addEventListener('click', () => {
        sound.playTap();
        clearInterval(this.timerInterval);
        if (this.onGameOver) this.onGameOver(this.score, true);
      });
    }
  }

  startTimer() {
    const timerLabel = this.container.querySelector('#matchTimerLabel');
    this.timerInterval = setInterval(() => {
      this.timer--;
      if (timerLabel) timerLabel.textContent = `${this.t.matchTime} ${this.timer}s`;

      if (this.timer <= 5 && this.timer > 0) {
        sound.playTick();
        if (timerLabel) timerLabel.classList.add('warning');
      }

      if (this.timer <= 0) {
        clearInterval(this.timerInterval);
        sound.playWrong();
        if (this.onGameOver) this.onGameOver(this.score, false);
      }
    }, 1000);
  }

  handleCardClick(cardId, cardEl) {
    if (this.isLocked) return;
    const card = this.cards.find(c => c.id === cardId);
    if (!card || card.isFlipped || card.isMatched) return;

    sound.playCardFlip();
    card.isFlipped = true;
    cardEl.classList.add('flipped');
    this.flippedCards.push({ card, el: cardEl });

    if (this.flippedCards.length === 2) {
      this.moves++;
      const movesLabel = this.container.querySelector('#matchMovesLabel');
      if (movesLabel) movesLabel.textContent = `${this.t.matchMoves} ${this.moves}`;

      this.checkMatch();
    }
  }

  checkMatch() {
    this.isLocked = true;
    const [first, second] = this.flippedCards;

    if (first.card.icon === second.card.icon) {
      setTimeout(() => {
        sound.playCorrect();
        first.card.isMatched = true;
        second.card.isMatched = true;
        first.el.classList.add('matched');
        second.el.classList.add('matched');

        this.matchedPairs++;
        const pts = 80;
        this.score += pts;
        if (this.onScoreUpdate) this.onScoreUpdate(this.score, pts);

        const pairsLabel = this.container.querySelector('#matchPairsLabel');
        if (pairsLabel) pairsLabel.textContent = `${this.t.matchPairs} ${this.matchedPairs}/6`;

        this.flippedCards = [];
        this.isLocked = false;

        if (this.matchedPairs === 6) {
          clearInterval(this.timerInterval);
          const timeBonus = this.timer * 10;
          this.score += timeBonus;
          sound.playFanfare();
          if (this.onScoreUpdate) this.onScoreUpdate(this.score, timeBonus);

          setTimeout(() => {
            if (this.onGameOver) this.onGameOver(this.score, true);
          }, 1500);
        }
      }, 400);
    } else {
      setTimeout(() => {
        sound.playWrong();
        first.card.isFlipped = false;
        second.card.isFlipped = false;
        first.el.classList.remove('flipped');
        second.el.classList.remove('flipped');
        this.flippedCards = [];
        this.isLocked = false;
      }, 850);
    }
  }
}
