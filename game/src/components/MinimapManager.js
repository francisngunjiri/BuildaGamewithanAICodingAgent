export class MinimapManager {
    constructor(canvas, player) {
        this.canvas = canvas;
        this.context = canvas.getContext('2d');
        this.player = player;
        this.range = 44;
        this.clock = 0;
        this.hazards = [];
        this.objectives = [];
    }

    setMarkers({ hazards = this.hazards, objectives = this.objectives } = {}) {
        this.hazards = hazards;
        this.objectives = objectives;
    }

    update(deltaTime, enemies = []) {
        this.clock += deltaTime;
        const { canvas, context: ctx, player } = this;
        const width = canvas.width;
        const height = canvas.height;
        const radius = width / 2;
        const centerX = width / 2;
        const centerY = height / 2;
        const scale = (radius - 8) / this.range;
        ctx.clearRect(0, 0, width, height);
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius - 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = 'rgba(7, 17, 24, 0.88)';
        ctx.fillRect(0, 0, width, height);

        const dot = (position, color, size = 4, pulse = false) => {
            const x = centerX + (position.x - player.position.x) * scale;
            const y = centerY + (position.z - player.position.z) * scale;
            if (Math.hypot(x - centerX, y - centerY) > radius - 10) return;
            ctx.beginPath();
            ctx.arc(x, y, size + (pulse ? Math.sin(this.clock * 8) * 1.4 : 0), 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = pulse ? 9 : 4;
            ctx.fill();
            ctx.shadowBlur = 0;
        };

        ctx.strokeStyle = 'rgba(137, 192, 194, 0.14)';
        ctx.lineWidth = 1;
        for (const r of [radius * 0.33, radius * 0.66]) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
            ctx.stroke();
        }
        enemies.forEach((enemy) => dot(enemy.mesh.position, '#ff4d55', 4.2, true));
        this.hazards.forEach((hazard) => dot(hazard, '#ff4d55', 3.5, true));
        this.objectives.forEach((objective) => dot(objective, '#ffc857', 4));

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(-(player.userData.facingAngle ?? 0) - Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.lineTo(7, 7);
        ctx.lineTo(0, 4);
        ctx.lineTo(-7, 7);
        ctx.closePath();
        ctx.fillStyle = '#43f0a5';
        ctx.shadowColor = '#43f0a5';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.restore();

        ctx.restore();
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius - 2, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(102, 232, 207, 0.8)';
        ctx.lineWidth = 3;
        ctx.stroke();
    }
}
