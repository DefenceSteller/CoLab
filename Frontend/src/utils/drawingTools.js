// Canvas drawing utilities

export const drawElement = (ctx, element) => {
    const { type, from, to, color, size, fillColor } = element;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (type) {
        case 'pencil':
        case 'eraser':
            ctx.lineWidth = size;
            ctx.strokeStyle = color;
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.stroke();
            break;

        case 'line':
            ctx.lineWidth = size;
            ctx.strokeStyle = color;
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.stroke();
            break;

        case 'rectangle': {
            const w = to.x - from.x;
            const h = to.y - from.y;
            ctx.lineWidth = size;
            ctx.strokeStyle = color;
            ctx.beginPath();
            ctx.rect(from.x, from.y, w, h);
            if (fillColor && fillColor !== 'transparent') {
                ctx.fillStyle = fillColor;
                ctx.fill();
            }
            ctx.stroke();
            break;
        }

        case 'circle': {
            // Circle/ellipse filling the box the user dragged
            const cx = (from.x + to.x) / 2;
            const cy = (from.y + to.y) / 2;
            const rx = Math.abs(to.x - from.x) / 2;
            const ry = Math.abs(to.y - from.y) / 2;
            ctx.lineWidth = size;
            ctx.strokeStyle = color;
            ctx.beginPath();
            ctx.ellipse(cx, cy, Math.max(rx, 0.5), Math.max(ry, 0.5), 0, 0, Math.PI * 2);
            if (fillColor && fillColor !== 'transparent') {
                ctx.fillStyle = fillColor;
                ctx.fill();
            }
            ctx.stroke();
            break;
        }

        case 'text': {
            const fontSize = element.fontSize || 16;
            ctx.font = `600 ${fontSize}px "Space Grotesk", Arial, sans-serif`;
            ctx.fillStyle = element.color || '#101014';
            ctx.textBaseline = 'top';
            ctx.fillText(element.text ?? '', element.x, element.y);
            break;
        }
    }

    ctx.restore();
};

export const redrawCanvas = (ctx, width, height, elements) => {
    // Clear to transparent so the white canvas surface shows through
    ctx.clearRect(0, 0, width, height);

    elements.forEach((element) => {
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
        timestamp: Date.now(),
    };
};
