import { player } from './Player.js';
import { activeEnemies } from './Enemy.js';
import { resetScore } from './Score.js';

export let isGameOver = false;

const gameOverElement = document.querySelector('.game-over');

/**
 * Halts the world, hides Tode, and displays the defeat menu.
 */
export function triggerGameOver() {
    if (isGameOver) return;
    isGameOver = true;

    console.log("💀 Game Over! Tode has been captured.");

    // Display the Game Over overlay
    if (gameOverElement) gameOverElement.style.display = 'block';

    // Make the player character invisible/hidden
    player.visible = false;
}

/**
 * Wipes out enemies, resets player position, resets score, and resumes the loop.
 */
export function resetGame(scene) {
    isGameOver = false;

    // Remove the Game Over overlay
    if (gameOverElement) gameOverElement.style.display = 'none';

    // Reset player position to the starting point and make him visible
    player.position.set(0, 0, 0);
    player.visible = true;

    // Clear all existing enemies from the Three.js scene
    for (let enemy of activeEnemies) {
        scene.remove(enemy.mesh);
    }
    // Empty the tracking array completely
    activeEnemies.length = 0;

    // Reset the score values and update the UI container
    resetScore();
}
