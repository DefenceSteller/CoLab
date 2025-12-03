// Canvas drawing utilities
export const drawElement = (ctx, element) => {
    const { type, from, to, color, size, fillColor } = element;
    
    ctx.save();
    ctx.lineWidth = size;
    ctx.strokeStyle = color;
    ctx.fillStyle = fillColor || color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    switch (type) {
        case 'pencil':
        case 'eraser':
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.stroke();
            break;
            
        case 'line':
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.stroke();
            break;
            
        case 'rectangle':
            const rectWidth = to.x - from.x;
            const rectHeight = to.y - from.y;
            ctx.beginPath();
            ctx.rect(from.x, from.y, rectWidth, rectHeight);
            ctx.stroke();
            if (fillColor && fillColor !== 'transparent') {
                ctx.fill();
            }
            break;
            
        case 'circle':
            const radius = Math.sqrt(
                Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2)
            );
            ctx.beginPath();
            ctx.arc(from.x, from.y, radius, 0, Math.PI * 2);
            ctx.stroke();
            if (fillColor && fillColor !== 'transparent') {
                ctx.fill();
            }
            break;
            
        case 'text':
            // Text is handled separately in the hook
            break;
    }
    
    ctx.restore();
};

export const redrawCanvas = (ctx, width, height, elements) => {
    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    // Redraw all elements
    elements.forEach(element => {
        drawElement(ctx, element);
    });
};

// Helper function to create element
export const createElement = (type, from, to, color, size, fillColor) => {
    return {
        type,
        from,
        to,
        color,
        size,
        fillColor,
        timestamp: Date.now()
    };
};