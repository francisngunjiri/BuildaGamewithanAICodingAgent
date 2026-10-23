import * as THREE from 'three';

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const MIN_PITCH = THREE.MathUtils.degToRad(15);
const MAX_PITCH = THREE.MathUtils.degToRad(60);
const PLAYER_CAMERA_DISTANCE = Math.hypot(5, 9);
const OVERVIEW_CAMERA_DISTANCE = 16;

export class CameraMovementController {
    constructor({ camera, overviewCamera, player, renderer, onDash }) {
        this.camera = camera;
        this.overviewCamera = overviewCamera;
        this.player = player;
        this.renderer = renderer;
        this.onDash = onDash;
        this.azimuth = 0;
        this.pitch = Math.atan2(5, 9);
        this.keyboard = new Set();
        this.attackPressed = false;
        this.joystickInput = new THREE.Vector2();
        this.pointerId = null;
        this.previousPointer = new THREE.Vector2();

        this.joystick = document.querySelector('.virtual-joystick');
        this.stick = document.querySelector('.joystick-stick');
        this.lookZone = document.querySelector('#look-zone');
        this.touchControls = document.querySelector('#touch-controls');
        this.touchEnabled = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        if (this.touchEnabled && this.touchControls) this.touchControls.hidden = false;
        this.joystick?.addEventListener('pointerdown', this.startJoystick);
        this.joystick?.addEventListener('pointermove', this.moveJoystick);
        this.joystick?.addEventListener('pointerup', this.endJoystick);
        this.joystick?.addEventListener('pointercancel', this.endJoystick);
        this.lookZone?.addEventListener('pointerdown', this.startLook);
        this.lookZone?.addEventListener('pointermove', this.moveLook);
        this.lookZone?.addEventListener('pointerup', this.endLook);
        this.lookZone?.addEventListener('pointercancel', this.endLook);
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        window.addEventListener('blur', this.onBlur);
        window.addEventListener('resize', this.onResize);
        this.onResize();
        this.camera.position.set(0, 6.5, -9);
        this.overviewCamera.position.set(0, 10, -16);
        this.camera.lookAt(0, 1.5, 0);
        this.overviewCamera.lookAt(0, 1.5, 0);
    }

    onResize = () => {
        const aspect = window.innerWidth / window.innerHeight;
        this.camera.aspect = aspect;
        this.overviewCamera.aspect = aspect;
        this.camera.updateProjectionMatrix();
        this.overviewCamera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    };

    onKeyDown = (event) => {
        const key = event.key.toLowerCase();
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
            event.preventDefault();
            this.keyboard.add(key);
        }
        if (key === 'shift') this.onDash?.();
        if (key === ' ') {
            event.preventDefault();
            this.attackPressed = true;
        }
    };

    onKeyUp = (event) => {
        this.keyboard.delete(event.key.toLowerCase());
    };

    onBlur = () => {
        this.keyboard.clear();
        this.joystickInput.set(0, 0);
    };

    startJoystick = (event) => {
        event.preventDefault();
        this.pointerId = event.pointerId;
        this.joystick.setPointerCapture(event.pointerId);
        this.updateJoystick(event);
    };

    moveJoystick = (event) => {
        if (event.pointerId !== this.pointerId) return;
        this.updateJoystick(event);
    };

    updateJoystick(event) {
        const rect = this.joystick.getBoundingClientRect();
        const dx = event.clientX - (rect.left + rect.width / 2);
        const dy = event.clientY - (rect.top + rect.height / 2);
        const limit = rect.width * 0.34;
        const distance = Math.hypot(dx, dy);
        const scale = distance > limit ? limit / distance : 1;
        const x = dx * scale;
        const y = dy * scale;
        this.stick.style.transform = `translate(${x}px, ${y}px)`;
        this.joystickInput.set(x / limit, -y / limit).clampLength(0, 1);
    }

    endJoystick = (event) => {
        if (event.pointerId !== this.pointerId) return;
        if (this.joystick.hasPointerCapture(event.pointerId)) this.joystick.releasePointerCapture(event.pointerId);
        this.pointerId = null;
        this.joystickInput.set(0, 0);
        this.stick.style.transform = 'translate(0, 0)';
    };

    startLook = (event) => {
        event.preventDefault();
        this.lookZone.setPointerCapture(event.pointerId);
        this.lookPointerId = event.pointerId;
        this.previousPointer.set(event.clientX, event.clientY);
    };

    moveLook = (event) => {
        if (event.pointerId !== this.lookPointerId) return;
        const deltaX = event.clientX - this.previousPointer.x;
        const deltaY = event.clientY - this.previousPointer.y;
        this.previousPointer.set(event.clientX, event.clientY);
        this.azimuth -= deltaX * 0.006;
        this.pitch = THREE.MathUtils.clamp(this.pitch + deltaY * 0.004, MIN_PITCH, MAX_PITCH);
    };

    endLook = (event) => {
        if (event.pointerId !== this.lookPointerId) return;
        if (this.lookZone.hasPointerCapture(event.pointerId)) this.lookZone.releasePointerCapture(event.pointerId);
        this.lookPointerId = null;
    };

    getInputAxes() {
        const keyboardX = Number(this.keyboard.has('d') || this.keyboard.has('arrowright'))
            - Number(this.keyboard.has('a') || this.keyboard.has('arrowleft'));
        const keyboardZ = Number(this.keyboard.has('w') || this.keyboard.has('arrowup'))
            - Number(this.keyboard.has('s') || this.keyboard.has('arrowdown'));

        if (keyboardX || keyboardZ) return new THREE.Vector2(keyboardX, keyboardZ).clampLength(0, 1);
        return this.joystickInput.clone();
    }

    getMovementDirection(activeCamera = this.camera) {
        const input = this.getInputAxes();
        if (input.lengthSq() === 0) return new THREE.Vector3();

        activeCamera.updateMatrixWorld();
        const forward = activeCamera.getWorldDirection(new THREE.Vector3());
        forward.y = 0;
        if (forward.lengthSq() < 1e-6) forward.set(0, 0, 1);
        forward.normalize();

        const right = WORLD_UP.clone().cross(forward).normalize();
        return right.multiplyScalar(input.x)
            .add(forward.multiplyScalar(input.y))
            .normalize();
    }

    consumeAttackPress() {
        const pressed = this.attackPressed;
        this.attackPressed = false;
        return pressed;
    }

    update(deltaTime, state, isDashing = false) {
        const focus = new THREE.Vector3(
            this.player.position.x,
            this.player.position.y + 1.5,
            this.player.position.z
        );
        const follow = (camera, distance, fov) => {
            camera.fov = THREE.MathUtils.lerp(camera.fov, isDashing ? fov + 4 : fov, Math.min(1, 8 * deltaTime));
            camera.updateProjectionMatrix();
            const horizontal = Math.cos(this.pitch) * distance;
            const desiredPosition = new THREE.Vector3(
                focus.x + Math.sin(this.azimuth) * horizontal,
                focus.y + Math.sin(this.pitch) * distance,
                focus.z - Math.cos(this.azimuth) * horizontal
            );
            if (state === 'MENU' || state === 'DIFFICULTY_SELECT') {
                const orbit = performance.now() * 0.00015;
                desiredPosition.x = focus.x + Math.sin(orbit) * distance;
                desiredPosition.z = focus.z + Math.cos(orbit) * distance;
            }
            camera.position.lerp(desiredPosition, Math.min(1, 8 * deltaTime));
            camera.lookAt(focus);
            camera.updateMatrixWorld();
        };

        follow(this.camera, PLAYER_CAMERA_DISTANCE, 70);
        follow(this.overviewCamera, OVERVIEW_CAMERA_DISTANCE, 70);
    }

    destroy() {
        this.joystick?.removeEventListener('pointerdown', this.startJoystick);
        this.joystick?.removeEventListener('pointermove', this.moveJoystick);
        this.joystick?.removeEventListener('pointerup', this.endJoystick);
        this.joystick?.removeEventListener('pointercancel', this.endJoystick);
        this.lookZone?.removeEventListener('pointerdown', this.startLook);
        this.lookZone?.removeEventListener('pointermove', this.moveLook);
        this.lookZone?.removeEventListener('pointerup', this.endLook);
        this.lookZone?.removeEventListener('pointercancel', this.endLook);
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        window.removeEventListener('blur', this.onBlur);
        window.removeEventListener('resize', this.onResize);
    }
}
