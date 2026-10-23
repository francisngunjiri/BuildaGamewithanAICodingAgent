// --- Scoring Constants ---
export const SCORE_PER_SECOND = 0.1;
export const SCORE_PER_KILL = 10;

// --- State Variables ---
export let currentScore = 0; // Changed from let to export let so other systems can read it
const scoreElement = document.querySelector('.score');

function renderScore() {
    if (scoreElement) {
        scoreElement.textContent = `Score: ${Math.floor(currentScore)}`;
    }
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
