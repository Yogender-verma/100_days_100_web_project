/**
 * Web-based Pixel Art Studio
 */

// --- Settings Management ---
function getGridColor() {
    return localStorage.getItem('pixel_grid_color') || '#000000';
}
function setGridColor(color) {
    localStorage.setItem('pixel_grid_color', color);
}

// Apply settings globally
document.documentElement.style.setProperty('--grid-color', getGridColor());


// --- Settings Page Logic ---
if (window.location.pathname.includes('settings.html')) {
    const inputGridColor = document.getElementById('setting-grid-color');
    inputGridColor.value = getGridColor();

    inputGridColor.addEventListener('change', (e) => {
        setGridColor(e.target.value);
        document.documentElement.style.setProperty('--grid-color', e.target.value);
    });

    document.getElementById('btn-reset-settings').addEventListener('click', () => {
        setGridColor('#000000');
        inputGridColor.value = '#000000';
        document.documentElement.style.setProperty('--grid-color', '#000000');
    });
}


// --- Studio Logic ---
if (window.location.pathname.includes('studio.html')) {
    
    // DOM Elements
    const canvas = document.getElementById('art-canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const gridOverlay = document.getElementById('grid-overlay');
    
    const colorPicker = document.getElementById('color-picker');
    const gridSizeSelect = document.getElementById('grid-size');
    const toggleGrid = document.getElementById('toggle-grid');
    
    const toolBtns = document.querySelectorAll('.tool-btn');
    const btnClear = document.getElementById('btn-clear');
    const btnDownload = document.getElementById('btn-download');

    // State
    let currentTool = 'pen'; // 'pen', 'eraser', 'bucket'
    let isDrawing = false;
    
    // Canvas virtual resolution (e.g. 32x32 pixels)
    // The actual CSS size is 512x512, handled by `.canvas-wrapper` width/height
    let gridResolution = parseInt(gridSizeSelect.value);
    
    // Initialize Canvas
    function initCanvas() {
        gridResolution = parseInt(gridSizeSelect.value);
        canvas.width = gridResolution;
        canvas.height = gridResolution;
        
        // Clear canvas (transparent by default)
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        updateGridOverlay();
    }

    function updateGridOverlay() {
        if (toggleGrid.checked) {
            // Draw CSS gradient grid
            // E.g., if wrapper is 512px and grid is 32, each block is 16px
            const blockPercent = 100 / gridResolution;
            const gc = getGridColor();
            
            gridOverlay.style.backgroundImage = `
                linear-gradient(to right, ${gc} 1px, transparent 1px),
                linear-gradient(to bottom, ${gc} 1px, transparent 1px)
            `;
            // Calculate size based on percent
            gridOverlay.style.backgroundSize = `${blockPercent}% ${blockPercent}%`;
            gridOverlay.style.opacity = "0.2";
        } else {
            gridOverlay.style.backgroundImage = 'none';
        }
    }

    // Tools setup
    toolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            toolBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTool = btn.id.replace('tool-', '');
        });
    });

    gridSizeSelect.addEventListener('change', initCanvas);
    toggleGrid.addEventListener('change', updateGridOverlay);
    
    btnClear.addEventListener('click', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    // --- Drawing Logic ---

    // Convert hex color to RGBA array [R, G, B, A]
    function hexToRgba(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [
            parseInt(result[1], 16),
            parseInt(result[2], 16),
            parseInt(result[3], 16),
            255
        ] : [0,0,0,255];
    }

    function getMouseCoords(e) {
        const rect = canvas.getBoundingClientRect();
        // Calculate scaling factor between actual DOM size and internal canvas resolution
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);
        return { x, y };
    }

    function drawPixel(x, y) {
        if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) return;
        
        if (currentTool === 'eraser') {
            ctx.clearRect(x, y, 1, 1);
        } else if (currentTool === 'pen') {
            ctx.fillStyle = colorPicker.value;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    // Event Listeners for Drawing
    canvas.addEventListener('mousedown', (e) => {
        const { x, y } = getMouseCoords(e);
        if (currentTool === 'bucket') {
            floodFill(x, y, hexToRgba(colorPicker.value));
        } else {
            isDrawing = true;
            drawPixel(x, y);
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;
        if (currentTool === 'bucket') return; // Don't drag-fill
        const { x, y } = getMouseCoords(e);
        drawPixel(x, y);
    });

    canvas.addEventListener('mouseup', () => { isDrawing = false; });
    canvas.addEventListener('mouseleave', () => { isDrawing = false; });


    // --- Flood Fill Algorithm (Breadth-First Search) ---
    
    function colorsMatch(a, b) {
        return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
    }

    function floodFill(startX, startY, fillColorRgba) {
        // 1. Get raw image data
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data; // Uint8ClampedArray [r,g,b,a, r,g,b,a...]
        
        // 2. Get target color at (startX, startY)
        const getPixelIndex = (x, y) => (y * canvas.width + x) * 4;
        
        const startIdx = getPixelIndex(startX, startY);
        const targetColor = [
            data[startIdx],
            data[startIdx + 1],
            data[startIdx + 2],
            data[startIdx + 3]
        ];
        
        // If target color is already fill color, do nothing
        if (colorsMatch(targetColor, fillColorRgba)) return;

        // 3. Setup BFS Queue
        const queue = [[startX, startY]];
        
        // Setup visited map to prevent infinite loops (using a flat array for speed)
        const visited = new Uint8Array(canvas.width * canvas.height);
        
        // Directions: Up, Right, Down, Left
        const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
        
        while (queue.length > 0) {
            const [x, y] = queue.shift();
            const idx = getPixelIndex(x, y);
            
            // Set new color
            data[idx] = fillColorRgba[0];
            data[idx + 1] = fillColorRgba[1];
            data[idx + 2] = fillColorRgba[2];
            data[idx + 3] = fillColorRgba[3];
            
            // Check neighbors
            for (let i = 0; i < 4; i++) {
                const nx = x + dirs[i][0];
                const ny = y + dirs[i][1];
                
                // Bounds check
                if (nx >= 0 && nx < canvas.width && ny >= 0 && ny < canvas.height) {
                    const flatIdx = ny * canvas.width + nx;
                    
                    if (!visited[flatIdx]) {
                        const nIdx = getPixelIndex(nx, ny);
                        const neighborColor = [
                            data[nIdx],
                            data[nIdx + 1],
                            data[nIdx + 2],
                            data[nIdx + 3]
                        ];
                        
                        if (colorsMatch(neighborColor, targetColor)) {
                            visited[flatIdx] = 1; // Mark as visited immediately before pushing to queue
                            queue.push([nx, ny]);
                        }
                    }
                }
            }
        }
        
        // 4. Put modified data back to canvas
        ctx.putImageData(imgData, 0, 0);
    }


    // --- Export ---
    btnDownload.addEventListener('click', () => {
        // Instead of downloading a tiny 32x32 image, let's create a temporary canvas to scale it up for export (e.g. to 512x512)
        const exportSize = 512;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = exportSize;
        tempCanvas.height = exportSize;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Disable smoothing to keep it crisp
        tempCtx.imageSmoothingEnabled = false;
        
        // Draw the current small canvas onto the large temp canvas
        tempCtx.drawImage(canvas, 0, 0, exportSize, exportSize);
        
        // Trigger download
        const dataURL = tempCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `pixel_art_${Date.now()}.png`;
        link.href = dataURL;
        link.click();
    });

    // Boot
    initCanvas();
}
