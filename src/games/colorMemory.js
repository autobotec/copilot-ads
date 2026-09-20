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
    this.seqTimeout = null;
  }

  get t() {
    return TRANSLATIONS[this.lang] || TRANSLATIONS.es;
  }

  setLanguage(newLang) {
    this.lang = newLang;
    const t = this.t;

    const roundLabel = this.container.querySelector('#memoryRoundLabel');
    const scoreLabel = this.container.querySelector('#memoryScoreLabel');
    const btnRestart = this.container.querySelector('#btnRestartSimon');
    const btnExit = this.container.querySelector('#btnExitSimon');
    const centerStatus = this.container.querySelector('#simonCenterStatus');
    const hintLabel = this.container.querySelector('#memoryHint');
    const turnText = this.container.querySelector('#simonTurnText');

    if (roundLabel) roundLabel.textContent = `${t.simonLevel} ${this.round}`;
    if (scoreLabel) scoreLabel.textContent = `${t.simonPoints} ${this.score}`;
    if (btnRestart) {
      btnRestart.innerHTML = `<span>🔄</span> <span>${t.restart}</span>`;
    }
    if (btnExit) {
      btnExit.innerHTML = `<span>←</span> <span>${t.returnToGames}</span>`;
    }

    if (this.isPlayingSequence) {
      if (centerStatus) centerStatus.textContent = t.simonWatchCenter;
      if (turnText) turnText.textContent = t.simonWatchCenter;
      if (hintLabel) hintLabel.textContent = `${t.simonHintWatch} (${this.sequence.length})`;
    } else if (this.isInputAllowed) {
      if (centerStatus) centerStatus.textContent = t.simonTurnCenter;
      if (turnText) turnText.textContent = t.simonTurnCenter;
      if (hintLabel) hintLabel.textContent = t.simonHintTurn;
    }

    this.updateLabels();
  }

  updateLabels() {
    const yellowLabel = this.lang === 'en' ? "YELLOW" : "AMARILLO";
    const greenLabel = this.lang === 'en' ? "GREEN" : "VERDE";

    const quadYellow = this.container.querySelector('.quad-yellow .quad-text');
    const quadGreen = this.container.querySelector('.quad-green .quad-text');
    if (quadYellow) quadYellow.textContent = yellowLabel;
    if (quadGreen) quadGreen.textContent = greenLabel;
  }

  updateStateUI(mode) {
    const instructionBox = this.container.querySelector('#simonInstructionBox');
    const centerBadge = this.container.querySelector('#simonCenterBadge');
    const centerStatus = this.container.querySelector('#simonCenterStatus');
    const turnTag = this.container.querySelector('#simonTurnTag');
    const turnIcon = this.container.querySelector('#simonTurnIcon');
    const turnText = this.container.querySelector('#simonTurnText');
    const hintLabel = this.container.querySelector('#memoryHint');
    const t = this.t;

    if (!instructionBox || !centerBadge) return;

    instructionBox.classList.remove('is-watching', 'is-player-turn', 'is-success', 'is-fail');
    centerBadge.classList.remove('is-watching', 'is-player-turn', 'is-success', 'is-fail');

    if (mode === 'watch') {
      instructionBox.classList.add('is-watching');
      centerBadge.classList.add('is-watching');
      if (turnIcon) turnIcon.textContent = '👁️';
      if (turnText) turnText.textContent = t.simonWatchCenter;
      if (centerStatus) centerStatus.textContent = t.simonWatchCenter;
      if (hintLabel) hintLabel.textContent = `${t.simonHintWatch} (${this.sequence.length})`;
    } else if (mode === 'turn') {
      instructionBox.classList.add('is-player-turn');
      centerBadge.classList.add('is-player-turn');
      if (turnIcon) turnIcon.textContent = '👉';
      if (turnText) turnText.textContent = t.simonTurnCenter;
      if (centerStatus) centerStatus.textContent = t.simonTurnCenter;
      if (hintLabel) hintLabel.textContent = t.simonHintTurn;
    } else if (mode === 'success') {
      instructionBox.classList.add('is-success');
      centerBadge.classList.add('is-success');
      if (turnIcon) turnIcon.textContent = '🎉';
      if (turnText) turnText.textContent = t.simonGreatCenter;
      if (centerStatus) centerStatus.textContent = t.simonGreatCenter;
    } else if (mode === 'fail') {
      instructionBox.classList.add('is-fail');
      centerBadge.classList.add('is-fail');
      if (turnIcon) turnIcon.textContent = '❌';
      if (turnText) turnText.textContent = t.simonFailCenter;
      if (centerStatus) centerStatus.textContent = t.simonFailCenter;
    }
  }

  updateSequenceDots(activeFlashIndex = -1) {
    const dotsContainer = this.container.querySelector('#simonSeqDots');
    if (!dotsContainer) return;
    dotsContainer.innerHTML = '';

    const total = this.sequence.length;
    for (let i = 0; i < total; i++) {
      const dot = document.createElement('span');
      dot.className = 'simon-seq-dot';

      if (this.isPlayingSequence) {
        if (i === activeFlashIndex) {
          dot.classList.add('flashing');
        } else if (i < activeFlashIndex) {
          dot.classList.add('passed');
        }
      } else {
        if (i < this.playerStep) {
          dot.classList.add('completed');
        } else if (i === this.playerStep && this.isInputAllowed) {
          dot.classList.add('current');
        }
      }
      dotsContainer.appendChild(dot);
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
      <div class="splash-memory-wrap simon-arcade-env">
        
        <!-- STATION HUD: STATS, DYNAMIC INSTRUCTIONS & CONTROLS -->
        <div class="simon-hud-station">
          <div class="simon-hud-top">
            <div class="memory-badge-wrap">
              <span class="memory-badge-icon">🤖</span>
              <span class="memory-badge">${t.simonTitle}</span>
              <span class="simon-retro-tag">PRO ARCADE</span>
            </div>

            <div class="simon-stats-grid">
              <div class="simon-stat-card level-card">
                <span class="simon-stat-icon">🎯</span>
                <div class="simon-stat-data">
                  <span class="simon-stat-sub">FASE</span>
                  <span class="simon-stat-val" id="memoryRoundLabel">${t.simonLevel} 1</span>
                </div>
              </div>
              <div class="simon-stat-card score-card">
                <span class="simon-stat-icon">⭐</span>
                <div class="simon-stat-data">
                  <span class="simon-stat-sub">PUNTOS</span>
                  <span class="simon-stat-val" id="memoryScoreLabel">${t.simonPoints} 0</span>
                </div>
              </div>
            </div>
          </div>

          <!-- DYNAMIC STATUS & SEQUENCE PROGRESS BOX -->
          <div class="simon-instruction-card is-watching" id="simonInstructionBox">
            <div class="simon-turn-tag" id="simonTurnTag">
              <span class="simon-turn-icon" id="simonTurnIcon">👁️</span>
              <span class="simon-turn-text" id="simonTurnText">${t.simonWatchCenter}</span>
            </div>
            <p class="memory-hint" id="memoryHint">${t.simonHintWatch}</p>
            <div class="simon-sequence-progress" id="simonSeqDots" aria-label="Progreso"></div>
          </div>

          <!-- TACTILE ACTION BUTTONS -->
          <div class="memory-controls">
            <button class="simon-btn-secondary" id="btnRestartSimon">
              <span>🔄</span> <span>${t.restart}</span>
            </button>
            <button class="simon-btn-primary" id="btnExitSimon">
              <span>←</span> <span>${t.returnToGames}</span>
            </button>
          </div>
        </div>

        <!-- MAIN STAGE: MAXIMIZED HIGH-TECH SIMON CONSOLE -->
        <div class="simon-arena-stage">
          <div class="splash-simon-circle" id="simonCircle">
            
            <!-- 4 TACTILE QUADRANTS WITH GLYPHS & GLOW -->
            <button class="simon-quadrant quad-cyan" data-color="0" aria-label="Cyan">
              <span class="simon-splash-glow"></span>
              <span class="quad-label">
                <span class="quad-glyph">▲</span>
                <span class="quad-text">${cyanLabel}</span>
              </span>
            </button>

            <button class="simon-quadrant quad-pink" data-color="1" aria-label="Magenta">
              <span class="simon-splash-glow"></span>
              <span class="quad-label">
                <span class="quad-glyph">●</span>
                <span class="quad-text">${magentaLabel}</span>
              </span>
            </button>

            <button class="simon-quadrant quad-yellow" data-color="2" aria-label="Yellow">
              <span class="simon-splash-glow"></span>
              <span class="quad-label">
                <span class="quad-glyph">■</span>
                <span class="quad-text">${yellowLabel}</span>
              </span>
            </button>

            <button class="simon-quadrant quad-green" data-color="3" aria-label="Green">
              <span class="simon-splash-glow"></span>
              <span class="quad-label">
                <span class="quad-glyph">◆</span>
                <span class="quad-text">${greenLabel}</span>
              </span>
            </button>

            <!-- CENTER COPILOT DOME BADGE -->
            <div class="simon-center-badge is-watching" id="simonCenterBadge">
              <div class="simon-center-halo"></div>
              <div class="simon-center-icon" id="simonCenterIcon">🤖</div>
              <div class="simon-center-text" id="simonCenterStatus">${t.simonWatchCenter}</div>
            </div>
          </div>
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
    if (roundLabel) roundLabel.textContent = `${this.t.simonLevel} ${this.round}`;

    this.updateStateUI('watch');
    this.updateSequenceDots();

    if (this.seqTimeout) clearTimeout(this.seqTimeout);
    this.seqTimeout = setTimeout(() => {
      this.playSequence();
    }, 700);
  }

  async playSequence() {
    this.isPlayingSequence = true;
    for (let i = 0; i < this.sequence.length; i++) {
      if (!this.isPlayingSequence) return;
      const colorIdx = this.sequence[i];
      this.updateSequenceDots(i);
      await this.flashQuadrant(colorIdx, 450);
      await new Promise(r => setTimeout(r, 180));
    }
    this.isPlayingSequence = false;
    this.isInputAllowed = true;

    this.updateStateUI('turn');
    this.updateSequenceDots();
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
      this.updateSequenceDots();

      if (this.playerStep === this.sequence.length) {
        this.isInputAllowed = false;
        const roundPts = this.round * 50;
        this.score += roundPts;
        if (this.onScoreUpdate) this.onScoreUpdate(this.score, roundPts);

        const scoreLabel = this.container.querySelector('#memoryScoreLabel');
        const hintLabel = this.container.querySelector('#memoryHint');

        if (scoreLabel) scoreLabel.textContent = `${this.t.simonPoints} ${this.score}`;
        if (hintLabel) hintLabel.textContent = `${this.t.simonHintCorrect}! +${roundPts} Pts`;

        this.updateStateUI('success');
        sound.playCorrect();
        this.round++;

        if (this.seqTimeout) clearTimeout(this.seqTimeout);
        this.seqTimeout = setTimeout(() => this.nextRound(), 1200);
      }
    } else {
      this.isInputAllowed = false;
      sound.playWrong();

      const hintLabel = this.container.querySelector('#memoryHint');
      if (hintLabel) hintLabel.textContent = `${this.t.simonHintWrong} ${this.round}`;

      this.updateStateUI('fail');

      const circle = this.container.querySelector('#simonCircle');
      if (circle) {
        circle.classList.remove('shake');
        void circle.offsetWidth;
        circle.classList.add('shake');
      }

      if (this.seqTimeout) clearTimeout(this.seqTimeout);
      this.seqTimeout = setTimeout(() => {
        if (this.onGameOver) this.onGameOver(this.score, false);
      }, 1500);
    }
  }

  destroy() {
    this.isInputAllowed = false;
    this.isPlayingSequence = false;
    if (this.seqTimeout) clearTimeout(this.seqTimeout);
  }
}
