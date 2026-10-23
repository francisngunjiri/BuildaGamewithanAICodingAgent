import { player } from './Player.js';
import { activeEnemies } from './Enemy.js';
import { currentScore, resetScore } from './Score.js';
import { hudManager } from './HUDManager.js';

export let isGameOver = false;

const gameOverElement = document.querySelector('.game-over');

export function triggerGameOver() {
    if (isGameOver) return;
    isGameOver = true;

    console.log("💀 Game Over! Tode has been captured.");

    if (gameOverElement) gameOverElement.style.display = 'block';
    player.visible = false;
    hudManager.updateSavedBestFromScore(currentScore);
}

export function resetGame(scene) {
    isGameOver = false;

    if (gameOverElement) gameOverElement.style.display = 'none';

    player.position.set(0, 0, 0);
    player.visible = true;

    for (let enemy of activeEnemies) {
        scene.remove(enemy.mesh);
    }
    activeEnemies.length = 0;

    resetScore();
    hudManager.resetCombo();
    hudManager.updateHealth(1);
    hudManager.updateStamina(1);
}
