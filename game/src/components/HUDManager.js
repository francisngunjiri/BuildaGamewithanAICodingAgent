const STORAGE_KEY = 'tode_game_highscore';

export class HUDManager {
    constructor() {
        this.root = document.querySelector('#game-hud');
        this.scoreValue = document.querySelector('.score-value');
        this.bestValue = document.querySelector('.best-value');
        this.comboValue = document.querySelector('.combo-value');
        this.healthFill = document.querySelector('.health-bar-fill');
        this.healthText = document.querySelector('.health-value');
        this.staminaRing = document.querySelector('.stamina-ring');
        this.staminaText = document.querySelector('.stamina-text');
        this.staminaTextValue = document.querySelector('.stamina-value');
        this.highScoreBanner = document.querySelector('.high-score-banner');

        this.comboMultiplier = 1.0;
        this.comboTimer = 0;
        this.bestScore = this.readBestScore();
        this.scoreValue.dataset.value = '0';
        this.scoreValue.textContent = '00000';
        this.renderBest();
        this.renderCombo();
        this.updateHealth(1);
        this.updateStamina(1);
    }

    readBestScore() {
        try {
            const value = Number.parseFloat(localStorage.getItem(STORAGE_KEY) || '0');
            return Number.isFinite(value) ? value : 0;
        } catch (error) {
            return 0;
        }
    }

    writeBestScore(value) {
        const normalized = Math.max(0, Math.floor(value));
        try {
            localStorage.setItem(STORAGE_KEY, String(normalized));
        } catch (error) {
            // ignore storage access issues in restricted browsers
        }
        this.bestScore = Math.max(this.bestScore, normalized);
        this.renderBest();
    }

    renderBest() {
        if (this.bestValue) this.bestValue.textContent = this.formatNumber(this.bestScore);
    }

    formatNumber(value) {
        return String(Math.max(0, Math.floor(value))).padStart(5, '0');
    }

    updateHealth(percent) {
        const clamped = Math.max(0, Math.min(1, percent));
        if (this.healthFill) this.healthFill.style.width = `${clamped * 100}%`;
        if (this.healthText) this.healthText.textContent = `${Math.round(clamped * 100)}%`;
    }

    updateStamina(percent) {
        const clamped = Math.max(0, Math.min(1, percent));
        const angle = clamped * 360;

        if (this.staminaRing) {
            this.staminaRing.style.setProperty('--stamina-angle', `${angle}deg`);
            this.staminaRing.style.background = `conic-gradient(#63e6be 0deg, #63e6be ${angle}deg, rgba(255,255,255,0.1) ${angle}deg)`;
        }

        const textValue = Math.round(clamped * 100);
        if (this.staminaText) this.staminaText.textContent = `${textValue}%`;
        if (this.staminaTextValue) this.staminaTextValue.textContent = `${textValue}%`;
    }

    addScore(points) {
        if (!this.scoreValue) return;
        const current = Number.parseInt(this.scoreValue.dataset.value || '0', 10) + points;
        this.scoreValue.dataset.value = String(current);
        this.scoreValue.textContent = this.formatNumber(current);
        return current;
    }

    setScore(value) {
        if (!this.scoreValue) return;
        this.scoreValue.dataset.value = String(Math.max(0, Math.floor(value)));
        this.scoreValue.textContent = this.formatNumber(this.scoreValue.dataset.value);
    }

    getScore() {
        return Number.parseInt(this.scoreValue?.dataset.value || '0', 10) || 0;
    }

    registerNearMiss() {
        this.comboMultiplier = Math.min(4.0, Number((this.comboMultiplier + 0.5).toFixed(1)));
        this.comboTimer = 3.5;
        this.renderCombo();
    }

    resetCombo() {
        this.comboMultiplier = 1.0;
        this.comboTimer = 0;
        this.renderCombo();
    }

    updateCombo(deltaTime) {
        if (this.comboTimer > 0) {
            this.comboTimer -= deltaTime;
        }

        if (this.comboTimer <= 0 && this.comboMultiplier > 1.0) {
            this.comboMultiplier = Math.max(1.0, Number((this.comboMultiplier - 0.5 * deltaTime / 0.5).toFixed(1)));
        }

        if (this.comboMultiplier <= 1.0) {
            this.comboMultiplier = 1.0;
            this.comboTimer = 0;
        }

        this.renderCombo();
    }

    renderCombo() {
        if (!this.comboValue) return;
        this.comboValue.textContent = `${this.comboMultiplier.toFixed(1)}x`;

        const hue = Math.min(50, Math.max(0, (this.comboMultiplier - 1) * 50));
        const color = `hsl(${hue} 90% 65%)`;
        this.comboValue.style.color = color;
        this.comboValue.style.textShadow = `0 0 12px ${color}`;
    }

    showHighScoreBanner() {
        if (!this.highScoreBanner) return;
        this.highScoreBanner.classList.add('visible');
        clearTimeout(this.bannerTimer);
        this.bannerTimer = setTimeout(() => {
            this.highScoreBanner.classList.remove('visible');
        }, 1800);
    }

    spawnFloatingScore(worldPosition, scoreValue, camera) {
        if (!this.root || !camera) return;

        const projected = worldPosition.clone();
        projected.project(camera);
        const x = (projected.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-projected.y * 0.5 + 0.5) * window.innerHeight;

        const popup = document.createElement('div');
        popup.className = 'floating-score';
        popup.textContent = `+${scoreValue}`;
        popup.style.left = `${x}px`;
        popup.style.top = `${y}px`;
        this.root.appendChild(popup);

        requestAnimationFrame(() => {
            popup.style.transform = `translate(-50%, -80px)`;
            popup.style.opacity = '0';
        });

        setTimeout(() => popup.remove(), 600);
    }

    updateSavedBestFromScore(score) {
        const currentBest = this.readBestScore();
        if (score > currentBest) {
            this.writeBestScore(score);
            this.showHighScoreBanner();
        }
    }
}

export const hudManager = new HUDManager();
