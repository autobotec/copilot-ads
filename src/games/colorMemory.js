import { sound } from '../audio.js';
import { TRANSLATIONS } from '../i18n.js';

export class ColorMemoryGame {
  constructor(containerEl, onScoreUpdate, onGameOver, lang = 'es') {
    this.container = containerEl;
    this.onScoreUpdate = onScoreUpdate;
    this.onGameOver = onGameOver;
    this.lang = lang;
    this.sequence = [];
    this.playerStep = 0;
    this.round = 1;
    this.isPlayingSequence = false;
    this.isInputAllowed = false;
    this.score = 0;
  }

  get t() {
    return TRANSLATIONS[this.lang] || TRANSLATIONS.es;
  }

  setLanguage(newLang) {
    this.lang = newLang;
    const roundLabel = this.container.querySelector('#memoryRoundLabel');
    const scoreLabel = this.container.querySelector('#memoryScoreLabel');
    const btnRestart = this.container.querySelector('#btnRestartSimon');
    const btnExit = this.container.querySelector('#btnExitSimon');
    const centerStatus = this.container.querySelector('#simonCenterStatus');

    if (roundLabel) roundLabel.textContent = `${this.t.simonLevel} ${this.round}`;
    if (scoreLabel) scoreLabel.textContent = `${this.t.simonPoints} ${this.score}`;
    if (btnRestart) btnRestart.textContent = this.t.restart;
    if (btnExit) btnExit.textContent = this.t.returnToGames;
    if (centerStatus && !this.isPlayingSequence && this.isInputAllowed) {
      centerStatus.textContent = this.t.simonTurnCenter;
    }
  }

  start() {
    this.sequence = [];
    this.playerStep = 0;
    this.round = 1;
    this.score = 0;
    this.render();
    this.nextRound();
  }

  render() {
    const t = this.t;
    const cyanLabel = "CYAN";
    const magentaLabel = "MAGENTA";
    const yellowLabel = this.lang === 'en' ? "YELLOW" : "AMARILLO";
    const greenLabel = this.lang === 'en' ? "GREEN" : "VERDE";

    this.container.innerHTML = `
      <div class="splash-memory-wrap">
        <div class="memory-status-bar">
          <div class="memory-badge">${t.simonTitle}</div>
          <div class="memory-round" id="memoryRoundLabel">${t.simonLevel} 1</div>
          <div class="memory-score" id="memoryScoreLabel">${t.simonPoints} 0</div>
        </div>
        <p class="memory-hint" id="memoryHint">${t.simonHintWatch}</p>
        
        <div class="splash-simon-circle" id="simonCircle">
          <!-- 4 Color Quadrants -->
          <button class="simon-quadrant quad-cyan" data-color="0" aria-label="Cyan">
            <span class="simon-splash-glow"></span>
            <span class="quad-label">${cyanLabel}</span>
          </button>
          <button class="simon-quadrant quad-pink" data-color="1" aria-label="Magenta">
            <span class="simon-splash-glow"></span>
            <span class="quad-label">${magentaLabel}</span>
          </button>
          <button class="simon-quadrant quad-yellow" data-color="2" aria-label="Yellow">
            <span class="simon-splash-glow"></span>
            <span class="quad-label">${yellowLabel}</span>
          </button>
          <button class="simon-quadrant quad-green" data-color="3" aria-label="Green">
            <span class="simon-splash-glow"></span>
            <span class="quad-label">${greenLabel}</span>
          </button>
          <div class="simon-center-badge">
            <div class="simon-center-icon">🤖</div>
            <div class="simon-center-text" id="simonCenterStatus">${t.simonWatchCenter}</div>
          </div>
        </div>

        <div class="memory-controls">
          <button class="simon-btn-secondary" id="btnRestartSimon">${t.restart}</button>
          <button class="simon-btn-primary" id="btnExitSimon">${t.returnToGames}</button>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const quadrants = this.container.querySelectorAll('.simon-quadrant');
    quadrants.forEach(q => {
      q.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const colorIdx = parseInt(q.dataset.color, 10);
        this.handlePlayerInput(colorIdx, q);
      });
    });

    const btnRestart = this.container.querySelector('#btnRestartSimon');
    if (btnRestart) {
      btnRestart.addEventListener('click', () => {
        sound.playTap();
        this.start();
      });
    }

    const btnExit = this.container.querySelector('#btnExitSimon');
    if (btnExit) {
      btnExit.addEventListener('click', () => {
        sound.playTap();
        if (this.onGameOver) this.onGameOver(this.score, true);
      });
    }
  }

  nextRound() {
    this.isInputAllowed = false;
    this.playerStep = 0;
    this.sequence.push(Math.floor(Math.random() * 4));

    const roundLabel = this.container.querySelector('#memoryRoundLabel');
    const hintLabel = this.container.querySelector('#memoryHint');
    const centerStatus = this.container.querySelector('#simonCenterStatus');

    if (roundLabel) roundLabel.textContent = `${this.t.simonLevel} ${this.round}`;
    if (hintLabel) hintLabel.textContent = `${this.t.simonHintWatch} (${this.sequence.length})`;
    if (centerStatus) centerStatus.textContent = this.t.simonWatchCenter;

    setTimeout(() => {
      this.playSequence();
    }, 700);
  }

  async playSequence() {
    this.isPlayingSequence = true;
    for (let i = 0; i < this.sequence.length; i++) {
      const colorIdx = this.sequence[i];
      await this.flashQuadrant(colorIdx, 450);
      await new Promise(r => setTimeout(r, 180));
    }
    this.isPlayingSequence = false;
    this.isInputAllowed = true;

    const hintLabel = this.container.querySelector('#memoryHint');
    const centerStatus = this.container.querySelector('#simonCenterStatus');
    if (hintLabel) hintLabel.textContent = this.t.simonHintTurn;
    if (centerStatus) centerStatus.textContent = this.t.simonTurnCenter;
  }

  flashQuadrant(colorIdx, duration = 400) {
    return new Promise(resolve => {
      const quadrant = this.container.querySelector(`.simon-quadrant[data-color="${colorIdx}"]`);
      if (quadrant) {
        quadrant.classList.add('active');
        sound.playColorTone(colorIdx);
        setTimeout(() => {
          quadrant.classList.remove('active');
          resolve();
        }, duration);
      } else {
        resolve();
      }
    });
  }

  handlePlayerInput(colorIdx, quadrantEl) {
    if (!this.isInputAllowed || this.isPlayingSequence) return;

    sound.playColorTone(colorIdx);
    quadrantEl.classList.add('active');
    setTimeout(() => quadrantEl.classList.remove('active'), 250);

    const expectedColor = this.sequence[this.playerStep];

    if (colorIdx === expectedColor) {
      this.playerStep++;
      if (this.playerStep === this.sequence.length) {
        this.isInputAllowed = false;
        const roundPts = this.round * 50;
        this.score += roundPts;
        if (this.onScoreUpdate) this.onScoreUpdate(this.score, roundPts);

        const scoreLabel = this.container.querySelector('#memoryScoreLabel');
        const centerStatus = this.container.querySelector('#simonCenterStatus');
        const hintLabel = this.container.querySelector('#memoryHint');

        if (scoreLabel) scoreLabel.textContent = `${this.t.simonPoints} ${this.score}`;
        if (centerStatus) centerStatus.textContent = this.t.simonGreatCenter;
        if (hintLabel) hintLabel.textContent = `${this.t.simonHintCorrect}! +${roundPts} Pts`;

        sound.playCorrect();
        this.round++;
        setTimeout(() => this.nextRound(), 1200);
      }
    } else {
      this.isInputAllowed = false;
      sound.playWrong();
      const hintLabel = this.container.querySelector('#memoryHint');
      const centerStatus = this.container.querySelector('#simonCenterStatus');

      if (hintLabel) hintLabel.textContent = `${this.t.simonHintWrong} ${this.round}`;
      if (centerStatus) centerStatus.textContent = this.t.simonFailCenter;

      const circle = this.container.querySelector('#simonCircle');
      if (circle) circle.classList.add('shake');

      setTimeout(() => {
        if (this.onGameOver) this.onGameOver(this.score, false);
      }, 1500);
    }
  }

  destroy() {
    this.isInputAllowed = false;
    this.isPlayingSequence = false;
  }
}
