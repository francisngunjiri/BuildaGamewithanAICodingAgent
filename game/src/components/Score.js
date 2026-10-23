import { hudManager } from './HUDManager.js';

// --- Scoring Constants ---
export const SCORE_PER_SECOND = 0.1;
export const SCORE_PER_KILL = 10;

// --- State Variables ---
export let currentScore = 0;

function renderScore() {
    hudManager.setScore(currentScore);
}

export function addSurvivalScore(deltaTime) {
    currentScore += SCORE_PER_SECOND * deltaTime;
    renderScore();
}

export function awardKillPoints() {
    currentScore += SCORE_PER_KILL;
    renderScore();
}

export function resetScore() {
    currentScore = 0;
    renderScore();
}
