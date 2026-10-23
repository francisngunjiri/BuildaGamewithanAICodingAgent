export class TouchControls {
    constructor(onMove, onDash, onPound) {
        this.enabled = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        this.onMove = onMove;
        this.onDash = onDash;
        this.onPound = onPound;
        this.element = document.querySelector('#touch-controls');
        if (!this.enabled || !this.element) return;
        this.element.hidden = false;
        this.joystick = this.element.querySelector('.virtual-joystick');
        this.stick = this.element.querySelector('.joystick-stick');
        this.joystick.addEventListener('pointerdown', this.startJoystick);
        this.joystick.addEventListener('pointermove', this.moveJoystick);
        this.joystick.addEventListener('pointerup', this.endJoystick);
        this.joystick.addEventListener('pointercancel', this.endJoystick);
        this.element.querySelector('[data-action="dash"]').addEventListener('pointerdown', onDash);
        this.element.querySelector('[data-action="pound"]').addEventListener('pointerdown', onPound);
    }

    startJoystick = (event) => {
        event.preventDefault();
        this.joystick.setPointerCapture(event.pointerId);
        this.moveJoystick(event);
    };

    moveJoystick = (event) => {
        if (!this.joystick.hasPointerCapture(event.pointerId)) return;
        const rect = this.joystick.getBoundingClientRect();
        const dx = event.clientX - (rect.left + rect.width / 2);
        const dy = event.clientY - (rect.top + rect.height / 2);
        const limit = rect.width * 0.34;
        const length = Math.min(limit, Math.hypot(dx, dy)) || 1;
        const x = dx / Math.hypot(dx, dy) * length;
        const y = dy / Math.hypot(dx, dy) * length;
        this.stick.style.transform = `translate(${x}px, ${y}px)`;
        this.onMove(dx / limit, -dy / limit);
    };

    endJoystick = (event) => {
        if (this.joystick.hasPointerCapture(event.pointerId)) this.joystick.releasePointerCapture(event.pointerId);
        this.stick.style.transform = 'translate(0, 0)';
        this.onMove(0, 0);
    };

    destroy() {
        if (this.joystick) {
            this.joystick.removeEventListener('pointerdown', this.startJoystick);
            this.joystick.removeEventListener('pointermove', this.moveJoystick);
            this.joystick.removeEventListener('pointerup', this.endJoystick);
            this.joystick.removeEventListener('pointercancel', this.endJoystick);
        }
    }
}
