// Star Map Visualization Module
// Renders an interactive star map with zoom, pan, and object plotting capabilities

class StarMap {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        // View state
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.showConstellations = true;
        
        // Interaction state
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        
        // Star catalog (brightest stars with RA/Dec)
        this.stars = this.generateStarCatalog();
        
        // Plotted objects (from search results)
        this.plottedObjects = [];
        
        // Constellation lines
        this.constellations = this.generateConstellationLines();
        
        // Setup canvas
        this.setupCanvas();
        this.setupEventListeners();
        
        // Initial render
        this.render();
    }
    
    setupCanvas() {
        // Set canvas size
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        this.canvas.width = rect.width - 40;
        this.canvas.height = 600;
        
        // Handle window resize
        window.addEventListener('resize', () => {
            const rect = container.getBoundingClientRect();
            this.canvas.width = rect.width - 40;
            this.canvas.height = 600;
            this.render();
        });
    }
    
    setupEventListeners() {
        // Mouse drag to pan
        this.canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.lastMouseX = e.offsetX;
            this.lastMouseY = e.offsetY;
            this.canvas.style.cursor = 'grabbing';
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                const dx = e.offsetX - this.lastMouseX;
                const dy = e.offsetY - this.lastMouseY;
                this.panX += dx;
                this.panY += dy;
                this.lastMouseX = e.offsetX;
                this.lastMouseY = e.offsetY;
                this.render();
            }
        });
        
        this.canvas.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.canvas.style.cursor = 'grab';
        });
        
        this.canvas.addEventListener('mouseleave', () => {
            this.isDragging = false;
            this.canvas.style.cursor = 'grab';
        });
        
        // Mouse wheel to zoom
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            this.zoom *= zoomFactor;
            this.zoom = Math.max(0.5, Math.min(5, this.zoom));
            this.render();
        });
        
        // Control buttons
        const resetBtn = document.getElementById('resetViewBtn');
        const toggleConstBtn = document.getElementById('toggleConstellationsBtn');
        const zoomInBtn = document.getElementById('zoomInBtn');
        const zoomOutBtn = document.getElementById('zoomOutBtn');
        
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetView());
        }
        if (toggleConstBtn) {
            toggleConstBtn.addEventListener('click', () => this.toggleConstellations());
        }
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => {
                this.zoom = Math.min(5, this.zoom * 1.2);
                this.render();
            });
        }
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => {
                this.zoom = Math.max(0.5, this.zoom / 1.2);
                this.render();
            });
        }
    }
    
    // Convert RA/Dec (hours, degrees) to canvas coordinates
    raDecToCanvas(ra, dec) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        // Convert RA from hours to degrees, then to radians
        const raRad = (ra * 15 - 180) * Math.PI / 180;
        const decRad = dec * Math.PI / 180;
        
        // Stereographic projection
        const cosDec = Math.cos(decRad);
        const x = centerX + this.panX + (Math.sin(raRad) * cosDec * this.canvas.width * this.zoom * 0.4);
        const y = centerY + this.panY - (Math.cos(raRad) * cosDec * this.canvas.width * this.zoom * 0.4);
        
        return { x, y };
    }
    
    // Generate a catalog of bright stars with approximate RA/Dec
    generateStarCatalog() {
        return [
            // Brightest stars with approximate coordinates
            { name: 'Sirius', ra: 6.75, dec: -16.7, mag: -1.46 },
            { name: 'Canopus', ra: 6.40, dec: -52.7, mag: -0.74 },
            { name: 'Arcturus', ra: 14.26, dec: 19.2, mag: -0.05 },
            { name: 'Vega', ra: 18.62, dec: 38.8, mag: 0.03 },
            { name: 'Capella', ra: 5.28, dec: 45.98, mag: 0.08 },
            { name: 'Rigel', ra: 5.24, dec: -8.2, mag: 0.18 },
            { name: 'Procyon', ra: 7.66, dec: 5.2, mag: 0.34 },
            { name: 'Betelgeuse', ra: 5.92, dec: 7.4, mag: 0.42 },
            { name: 'Achernar', ra: 1.63, dec: -57.2, mag: 0.46 },
            { name: 'Altair', ra: 19.85, dec: 8.87, mag: 0.76 },
            { name: 'Spica', ra: 13.42, dec: -11.16, mag: 0.98 },
            { name: 'Pollux', ra: 7.76, dec: 28.0, mag: 1.16 },
            { name: 'Fomalhaut', ra: 22.96, dec: -29.6, mag: 1.17 },
            { name: 'Deneb', ra: 20.69, dec: 45.28, mag: 1.25 },
            { name: 'Regulus', ra: 10.14, dec: 11.97, mag: 1.36 },
            // Add more stars for a richer map
            ...this.generateRandomStars(200, 0.5, 4.0)
        ];
    }
    
    // Generate additional random stars for background
    generateRandomStars(count, minMag, maxMag) {
        const stars = [];
        for (let i = 0; i < count; i++) {
            stars.push({
                name: `Star_${i}`,
                ra: Math.random() * 24,
                dec: (Math.random() - 0.5) * 180,
                mag: minMag + Math.random() * (maxMag - minMag)
            });
        }
        return stars;
    }
    
    // Generate simple constellation lines (connecting nearby bright stars)
    generateConstellationLines() {
        // Simple pattern: connect stars that are close to each other
        const lines = [];
        const brightStars = this.stars.filter(s => s.mag < 2.0 && s.name && !s.name.startsWith('Star_'));
        
        for (let i = 0; i < brightStars.length; i++) {
            for (let j = i + 1; j < brightStars.length; j++) {
                const s1 = brightStars[i];
                const s2 = brightStars[j];
                
                // Calculate angular distance
                const ra1 = s1.ra * 15 * Math.PI / 180;
                const dec1 = s1.dec * Math.PI / 180;
                const ra2 = s2.ra * 15 * Math.PI / 180;
                const dec2 = s2.dec * Math.PI / 180;
                
                const angularDist = Math.acos(
                    Math.sin(dec1) * Math.sin(dec2) +
                    Math.cos(dec1) * Math.cos(dec2) * Math.cos(ra1 - ra2)
                ) * 180 / Math.PI;
                
                // Connect stars within ~30 degrees
                if (angularDist < 30) {
                    lines.push({ star1: s1, star2: s2 });
                }
            }
        }
        return lines;
    }
    
    // Plot an object on the star map
    plotObject(name, ra, dec, type = 'Object') {
        // Remove existing plot for same object
        this.plottedObjects = this.plottedObjects.filter(obj => obj.name !== name);
        
        this.plottedObjects.push({ name, ra, dec, type });
        
        // Center view on the object
        const pos = this.raDecToCanvas(ra, dec);
        this.panX = -pos.x + this.canvas.width / 2;
        this.panY = -pos.y + this.canvas.height / 2;
        this.zoom = 2;
        
        this.render();
    }
    
    // Clear all plotted objects
    clearPlottedObjects() {
        this.plottedObjects = [];
        this.render();
    }
    
    render() {
        // Clear canvas
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw stars as a gradient
        const gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, 50);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 200, 0.8)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        // Draw constellation lines first (so stars appear on top)
        if (this.showConstellations) {
            this.ctx.strokeStyle = 'rgba(102, 126, 234, 0.3)';
            this.ctx.lineWidth = 1;
            
            this.constellations.forEach(line => {
                const pos1 = this.raDecToCanvas(line.star1.ra, line.star1.dec);
                const pos2 = this.raDecToCanvas(line.star2.ra, line.star2.dec);
                
                // Only draw if both points are on canvas
                if (this.isPointVisible(pos1) || this.isPointVisible(pos2)) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(pos1.x, pos1.y);
                    this.ctx.lineTo(pos2.x, pos2.y);
                    this.ctx.stroke();
                }
            });
        }
        
        // Draw stars
        this.stars.forEach(star => {
            const pos = this.raDecToCanvas(star.ra, star.dec);
            
            if (!this.isPointVisible(pos)) return;
            
            // Size based on magnitude (brighter = larger)
            const size = Math.max(0.5, (6 - star.mag) * 0.8);
            const alpha = Math.max(0.3, 1 - (star.mag - 0) / 5);
            
            this.ctx.save();
            this.ctx.translate(pos.x, pos.y);
            this.ctx.globalAlpha = alpha;
            this.ctx.fillStyle = `rgba(255, 255, ${255 - Math.max(0, star.mag) * 40}, 1)`;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
            
            // Label bright stars
            if (star.mag < 1.5 && star.name && !star.name.startsWith('Star_')) {
                this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                this.ctx.font = '10px sans-serif';
                this.ctx.fillText(star.name, pos.x + 5, pos.y - 5);
            }
        });
        
        // Draw plotted objects (from search)
        this.plottedObjects.forEach(obj => {
            const pos = this.raDecToCanvas(obj.ra, obj.dec);
            
            if (!this.isPointVisible(pos)) return;
            
            // Draw marker
            this.ctx.fillStyle = '#ff6b6b';
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 2;
            
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
            
            // Draw crosshair
            this.ctx.beginPath();
            this.ctx.moveTo(pos.x - 15, pos.y);
            this.ctx.lineTo(pos.x + 15, pos.y);
            this.ctx.moveTo(pos.x, pos.y - 15);
            this.ctx.lineTo(pos.x, pos.y + 15);
            this.ctx.stroke();
            
            // Label
            this.ctx.fillStyle = '#ff6b6b';
            this.ctx.font = 'bold 12px sans-serif';
            this.ctx.fillText(obj.name, pos.x + 12, pos.y - 12);
        });
    }
    
    isPointVisible(pos) {
        return pos.x > -50 && pos.x < this.canvas.width + 50 &&
               pos.y > -50 && pos.y < this.canvas.height + 50;
    }
    
    resetView() {
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.render();
    }
    
    toggleConstellations() {
        this.showConstellations = !this.showConstellations;
        const btn = document.getElementById('toggleConstellationsBtn');
        if (btn) {
            btn.textContent = this.showConstellations ? 'Toggle Constellations' : 'Show Constellations';
        }
        this.render();
    }
}

// Initialize star map when DOM is ready
let starMap;

document.addEventListener('DOMContentLoaded', () => {
    starMap = new StarMap('starMapCanvas');
});

// Export for use in app.js
window.starMap = starMap;

