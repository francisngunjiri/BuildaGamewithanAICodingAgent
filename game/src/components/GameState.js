import { player, resetPlayerVitals, setStaminaRegenRate } from './Player.js';
import { activeEnemies, updateEnemyDynamicDifficulty, setEnemySpawnConfig } from './Enemy.js';
import { currentScore, resetScore } from './Score.js';
import { hudManager } from './HUDManager.js';

export const GAME_STATES = Object.freeze({
    MENU: 'MENU',
    DIFFICULTY_SELECT: 'DIFFICULTY_SELECT',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    GAMEOVER: 'GAMEOVER'
});

export const DIFFICULTY_SETTINGS = Object.freeze({
    EASY: { label: 'Easy', enemySpeed: 1.0, hazardInterval: 4.0, staminaRegen: 35 },
    MEDIUM: { label: 'Medium', enemySpeed: 1.5, hazardInterval: 2.5, staminaRegen: 25 },
    HARD: { label: 'Hard', enemySpeed: 2.2, hazardInterval: 1.2, staminaRegen: 15 }
});

export let isGameOver = false;
export let currentGameState = GAME_STATES.MENU;
export let selectedDifficulty = 'MEDIUM';

const gameOverElement = document.querySelector('.game-over');
const menuScreen = document.querySelector('#menu-screen');
const difficultyScreen = document.querySelector('#difficulty-screen');
const pauseOverlay = document.querySelector('#pause-overlay');

function syncUi() {
    const syncOverlay = (element, visible) => {
        if (!element) return;
        element.hidden = !visible;
        element.classList.toggle('hidden', !visible);
    };

    syncOverlay(menuScreen, currentGameState === GAME_STATES.MENU);
    syncOverlay(difficultyScreen, currentGameState === GAME_STATES.DIFFICULTY_SELECT);
    syncOverlay(pauseOverlay, currentGameState === GAME_STATES.PAUSED);
    if (gameOverElement) gameOverElement.style.display = currentGameState === GAME_STATES.GAMEOVER ? 'block' : 'none';
}

export function setGameState(nextState) {
    currentGameState = nextState;
    syncUi();
}

export function applyDifficultyConfig(level = selectedDifficulty) {
    selectedDifficulty = level;
    const config = DIFFICULTY_SETTINGS[level] || DIFFICULTY_SETTINGS.MEDIUM;
    setStaminaRegenRate(config.staminaRegen);
    updateEnemyDynamicDifficulty(config.enemySpeed);
    setEnemySpawnConfig(config.hazardInterval);
    return config;
}

export function triggerGameOver() {
    if (isGameOver) return;
    isGameOver = true;
    setGameState(GAME_STATES.GAMEOVER);
    player.visible = false;
    hudManager.updateSavedBestFromScore(currentScore);
}

export function resetGame(scene) {
    isGameOver = false;
    if (gameOverElement) gameOverElement.style.display = 'none';
    setGameState(GAME_STATES.PLAYING);

    player.position.set(0, 0, 0);
    player.userData.facingAngle = 0;
    player.visible = true;
    resetPlayerVitals();

    for (let enemy of activeEnemies) {
        scene.remove(enemy.mesh);
    }
    activeEnemies.length = 0;

    resetScore();
    hudManager.resetCombo();
    applyDifficultyConfig(selectedDifficulty);
}

export function togglePause() {
    if (currentGameState === GAME_STATES.PLAYING) {
        setGameState(GAME_STATES.PAUSED);
    } else if (currentGameState === GAME_STATES.PAUSED) {
        setGameState(GAME_STATES.PLAYING);
    }
}

export function startMenuFlow() {
    isGameOver = false;
    setGameState(GAME_STATES.MENU);
}

syncUi();
