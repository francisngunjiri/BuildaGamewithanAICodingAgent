import * as THREE from 'three';
import { camera } from './Camera.js';

export class JuiceManager {
    constructor(cameraRef) {
        this.camera = cameraRef;
        this.scene = null;
        this.baseCameraPosition = this.camera ? this.camera.position.clone() : new THREE.Vector3(300, -300, 300);
        this.shakeState = {
            active: false,
            intensity: 0,
            duration: 0,
            elapsed: 0,
            offset: new THREE.Vector3()
        };
        this.hitStopRemaining = 0;
        this.particles = [];
        this.squashStates = [];
    }

    bindScene(scene) {
        this.scene = scene;
    }

    triggerShake(intensity = 0.15, durationMs = 100) {
        if (!this.camera) return;
        this.shakeState.active = true;
        this.shakeState.intensity = intensity;
        this.shakeState.duration = Math.max(0.001, durationMs / 1000);
        this.shakeState.elapsed = 0;
        this.shakeState.offset.set(0, 0, 0);
        this.baseCameraPosition.copy(this.camera.position);
    }

    triggerHitStop(durationSeconds = 0.05) {
        this.hitStopRemaining = Math.max(this.hitStopRemaining, durationSeconds);
    }

    isHitStopActive() {
        return this.hitStopRemaining > 0.0001;
    }

    triggerLandingDust(position, count = 14) {
        if (!this.scene) return;
        const ringPositions = [];
        const color = new THREE.Color(0xf5d76e);

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const radius = 5 + Math.random() * 22;
            ringPositions.push(
                Math.cos(angle) * radius,
                Math.sin(angle) * radius,
                0
            );
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(ringPositions, 3));
        const material = new THREE.PointsMaterial({
            color,
            size: 2.0,
            transparent: true,
            opacity: 0.85,
            depthWrite: false
        });

        const points = new THREE.Points(geometry, material);
        points.position.copy(position);
        points.position.z = 0.3;
        this.scene.add(points);

        this.particles.push({
            mesh: points,
            velocity: new THREE.Vector3((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 0.8, 0),
            lifetime: 0.45,
            maxLifetime: 0.45,
            type: 'dust'
        });
    }

    triggerDashSparks(position, direction, count = 8) {
        if (!this.scene) return;
        const baseDirection = direction && direction.lengthSq() > 0 ? direction.clone().normalize() : new THREE.Vector3(1, 0, 0);
        const spawnColor = new THREE.Color(0xffd166);

        for (let i = 0; i < count; i++) {
            const geometry = new THREE.BufferGeometry();
            const particles = new Float32Array(3);
            particles[0] = 0;
            particles[1] = 0;
            particles[2] = 0;
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(particles, 3));

            const material = new THREE.PointsMaterial({
                color: spawnColor,
                size: 1.6,
                transparent: true,
                opacity: 0.9,
                depthWrite: false
            });

            const points = new THREE.Points(geometry, material);
            points.position.copy(position);
            points.position.z = 0.5;
            this.scene.add(points);

            const spread = baseDirection.clone().multiplyScalar(-1).add(new THREE.Vector3((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, 0));
            this.particles.push({
                mesh: points,
                velocity: spread.normalize().multiplyScalar(10 + Math.random() * 18),
                lifetime: 0.18 + Math.random() * 0.12,
                maxLifetime: 0.18 + Math.random() * 0.12,
                type: 'spark'
            });
        }
    }

    triggerSquashStretch(mesh, mode = 'land') {
        if (!mesh) return;
        const startScale = mesh.scale.clone();
        let targetScale;

        if (mode === 'land') {
            targetScale = new THREE.Vector3(1.2, 0.75, 1.2);
        } else {
            targetScale = new THREE.Vector3(1.1, 1.25, 1.25);
        }

        this.squashStates.push({
            mesh,
            startScale,
            targetScale,
            elapsed: 0,
            duration: mode === 'land' ? 0.12 : 0.08,
            mode
        });
    }

    update(deltaTime) {
        if (this.hitStopRemaining > 0) {
            this.hitStopRemaining = Math.max(0, this.hitStopRemaining - deltaTime);
        }

        this._updateShake(deltaTime);
        this._updateParticles(deltaTime);
        this._updateSquash(deltaTime);
    }

    _updateShake(deltaTime) {
        if (!this.camera) return;
        if (!this.shakeState.active) return;

        this.baseCameraPosition.copy(this.camera.position);
        this.shakeState.elapsed += deltaTime;
        const t = Math.min(this.shakeState.elapsed / this.shakeState.duration, 1);
        const decay = 1 - t;
        const x = (Math.random() - 0.5) * this.shakeState.intensity * 2 * decay;
        const y = (Math.random() - 0.5) * this.shakeState.intensity * 2 * decay;
        const z = (Math.random() - 0.5) * this.shakeState.intensity * 0.75 * decay;
        this.shakeState.offset.set(x, y, z);
        this.camera.position.copy(this.baseCameraPosition).add(this.shakeState.offset);

        if (t >= 1) {
            this.shakeState.active = false;
            this.camera.position.copy(this.baseCameraPosition);
        }
    }

    _updateParticles(deltaTime) {
        if (!this.scene || !this.particles.length) return;

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.lifetime -= deltaTime;
            particle.mesh.position.addScaledVector(particle.velocity, deltaTime);

            if (particle.type === 'dust') {
                particle.mesh.scale.setScalar(1 + (particle.maxLifetime - particle.lifetime) * 3);
            }

            const alpha = Math.max(0, particle.lifetime / particle.maxLifetime);
            if (particle.mesh.material) {
                particle.mesh.material.opacity = alpha;
            }

            if (particle.lifetime <= 0) {
                this.scene.remove(particle.mesh);
                if (particle.mesh.geometry) particle.mesh.geometry.dispose();
                if (particle.mesh.material) {
                    if (Array.isArray(particle.mesh.material)) {
                        particle.mesh.material.forEach((mat) => mat.dispose());
                    } else {
                        particle.mesh.material.dispose();
                    }
                }
                this.particles.splice(i, 1);
            }
        }
    }

    _updateSquash(deltaTime) {
        for (let i = this.squashStates.length - 1; i >= 0; i--) {
            const state = this.squashStates[i];
            state.elapsed += deltaTime;
            const t = Math.min(state.elapsed / state.duration, 1);
            const eased = state.mode === 'land' ? 1 - Math.pow(1 - t, 3) : 1 - Math.pow(1 - t, 2);

            const x = THREE.MathUtils.lerp(state.startScale.x, state.targetScale.x, eased);
            const y = THREE.MathUtils.lerp(state.startScale.y, state.targetScale.y, eased);
            const z = THREE.MathUtils.lerp(state.startScale.z, state.targetScale.z, eased);
            state.mesh.scale.set(x, y, z);

            if (t >= 1) {
                state.mesh.scale.copy(state.startScale);
                this.squashStates.splice(i, 1);
            }
        }
    }
}

export const juiceManager = new JuiceManager(camera);
