const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const overlay = document.getElementById('fade-overlay');

let particles = [];
let targetPoints = [];
let width, height;
// Track animation state to smoothly transition from chaotic wander to forming the text
let animationProgress = 0;
let phase = 'wander'; // 'wander', 'assemble', 'hold'
const ASSEMBLY_DURATION = 4000; // ms
const HOLD_DURATION = 2000; // ms
const PARTICLE_COUNT = 800; // Adjusted based on performance and visual density
const MAX_DISTANCE = 40; // Max distance to draw connecting lines

let startTime = 0;
let assembleStartTime = 0;
let holdStartTime = 0;

function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    initTextPoints();
}

// Draw the text invisibly to extract the pixel coordinates
function initTextPoints() {
    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Set text style
    const fontSize = Math.min(width * 0.3, 300); // Responsive font size
    ctx.font = `bold italic ${fontSize}px "Playfair Display", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'white';

    // Draw text in the center
    ctx.fillText('SAI', width / 2, height / 2);

    // Extract pixel data
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    targetPoints = [];

    // Sample pixels (step size determines point density)
    const step = 6;
    for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
            // Check alpha channel
            const alpha = data[((width * y) + x) * 4 + 3];
            if (alpha > 128) {
                // Add some jitter to target points for organic look
                targetPoints.push({
                    x: x + (Math.random() - 0.5) * step,
                    y: y + (Math.random() - 0.5) * step
                });
            }
        }
    }

    // Clear canvas again after extraction
    ctx.clearRect(0, 0, width, height);

    initParticles();
}

class Particle {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        // Random wandering velocities
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        // Base size
        this.size = Math.random() * 1.5 + 0.5;

        // Target coordinates (will be assigned later if there are enough points)
        this.targetX = this.x;
        this.targetY = this.y;

        // Origin point for assembly transition interpolation
        this.originX = this.x;
        this.originY = this.y;
    }

    update(progress) {
        if (phase === 'wander') {
            this.x += this.vx;
            this.y += this.vy;

            // Bounce off walls
            if (this.x < 0 || this.x > width) this.vx *= -1;
            if (this.y < 0 || this.y > height) this.vy *= -1;

            // Constrain
            this.x = Math.max(0, Math.min(width, this.x));
            this.y = Math.max(0, Math.min(height, this.y));

        } else if (phase === 'assemble') {
            // Easing function (cubic in-out)
            const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

            // Interpolate position from origin to target
            this.x = this.originX + (this.targetX - this.originX) * ease;
            this.y = this.originY + (this.targetY - this.originY) * ease;

            // Add slight jitter/wiggle during assembly that dampens as it finishes
            const wiggle = (1 - ease) * 10;
            this.x += (Math.random() - 0.5) * wiggle;
            this.y += (Math.random() - 0.5) * wiggle;

        } else if (phase === 'hold') {
            // Keep at target but add micro-wobble to keep it "alive"
            this.x = this.targetX + Math.sin(Date.now() * 0.002 + this.targetX) * 1;
            this.y = this.targetY + Math.cos(Date.now() * 0.002 + this.targetY) * 1;
        }
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fill();
    }
}

function initParticles() {
    particles = [];
    const numParticles = Math.min(PARTICLE_COUNT, targetPoints.length);

    // Assign a target to each particle
    // Shuffle target points to distribute particles evenly across text
    const shuffledTargets = [...targetPoints].sort(() => 0.5 - Math.random());

    for (let i = 0; i < numParticles; i++) {
        const p = new Particle();
        if (i < shuffledTargets.length) {
            p.targetX = shuffledTargets[i].x;
            p.targetY = shuffledTargets[i].y;
        } else {
            // If we have more particles than target points, just assign random visible spots
            p.targetX = width / 2 + (Math.random() - 0.5) * 400;
            p.targetY = height / 2 + (Math.random() - 0.5) * 200;
        }
        particles.push(p);
    }
}

function drawLines() {
    ctx.lineWidth = 0.5;

    // Optimize line drawing using a spatial grid hash if necessary, 
    // but for <1000 points O(n^2) is acceptable in modern browsers
    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const distSq = dx * dx + dy * dy;

            if (distSq < MAX_DISTANCE * MAX_DISTANCE) {
                const distance = Math.sqrt(distSq);
                const opacity = 1 - (distance / MAX_DISTANCE);
                ctx.beginPath();
                ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.4})`;
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(particles[j].x, particles[j].y);
                ctx.stroke();
            }
        }
    }
}

function animate(timestamp) {
    if (!startTime) {
        startTime = timestamp;
        // Start black, fade in
        overlay.classList.add('black');
        setTimeout(() => overlay.classList.add('fade-in'), 100);
    }

    const elapsed = timestamp - startTime;

    // Phase logic
    if (phase === 'wander' && elapsed > 2500) {
        phase = 'assemble';
        assembleStartTime = timestamp;

        // Snapshot current positions as origins for the transition
        particles.forEach(p => {
            p.originX = p.x;
            p.originY = p.y;
        });
    } else if (phase === 'assemble') {
        const assembleElapsed = timestamp - assembleStartTime;
        animationProgress = Math.min(1, assembleElapsed / ASSEMBLY_DURATION);

        if (animationProgress >= 1) {
            phase = 'hold';
            holdStartTime = timestamp;
        }
    } else if (phase === 'hold') {
        const holdElapsed = timestamp - holdStartTime;
        if (holdElapsed > HOLD_DURATION && !overlay.classList.contains('fade-out')) {
            // Trigger transition to home page
            overlay.classList.remove('black', 'fade-in');
            overlay.classList.add('fade-out');

            // Redirect after fade out completes
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
        }
    }

    // Clear with slight trail effect
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(0, 0, width, height);

    particles.forEach(p => {
        p.update(animationProgress);
        p.draw();
    });

    drawLines();

    requestAnimationFrame(animate);
}

// Ensure fonts are loaded before initializing text points
document.fonts.ready.then(() => {
    window.addEventListener('resize', resize);
    resize();
    requestAnimationFrame(animate);
});
