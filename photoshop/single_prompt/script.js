(() => {
  const WIDTH = 960;
  const HEIGHT = 600;
  const canvasContainer = document.getElementById('canvasContainer');
  const layerList = document.getElementById('layerList');
  const toolButtons = document.getElementById('toolButtons');
  const colorPicker = document.getElementById('colorPicker');
  const sizeRange = document.getElementById('sizeRange');
  const sizeValue = document.getElementById('sizeValue');
  const opacityRange = document.getElementById('opacityRange');
  const opacityValue = document.getElementById('opacityValue');
  const fontSizeRange = document.getElementById('fontSizeRange');
  const fontSizeValue = document.getElementById('fontSizeValue');
  const fontFamilySelect = document.getElementById('fontFamilySelect');
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  const clearBtn = document.getElementById('clearBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const uploadInput = document.getElementById('uploadInput');
  const addLayerBtn = document.getElementById('addLayerBtn');
  const mergeLayersBtn = document.getElementById('mergeLayersBtn');

  const previewCanvas = document.createElement('canvas');
  previewCanvas.width = WIDTH;
  previewCanvas.height = HEIGHT;
  previewCanvas.classList.add('preview-layer');
  previewCanvas.style.pointerEvents = 'none';
  canvasContainer.appendChild(previewCanvas);
  const previewCtx = previewCanvas.getContext('2d');

  const layers = [];
  let activeLayerIndex = -1;
  let layerCounter = 0;

  let activeTool = 'brush';
  let brushColor = colorPicker.value;
  let brushSize = parseInt(sizeRange.value, 10);
  let brushOpacity = parseInt(opacityRange.value, 10) / 100;
  let textSize = parseInt(fontSizeRange.value, 10);
  let textFamily = fontFamilySelect.value;

  let isDrawing = false;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;

  const history = [];
  const redoStack = [];

  function createLayer(name) {
    const layerName = name || `레이어 ${++layerCounter}`;
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    canvas.classList.add('drawing-layer');
    canvasContainer.insertBefore(canvas, previewCanvas);

    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    layers.push({ canvas, ctx, name: layerName, visible: true });
    setActiveLayer(layers.length - 1);
    renderLayerList();
    syncCanvasOrder();
  }

  function removeLayer(index) {
    if (layers.length <= 1) {
      alert('최소 한 개의 레이어는 유지되어야 합니다.');
      return;
    }
    const [removed] = layers.splice(index, 1);
    removed.canvas.remove();
    if (activeLayerIndex >= layers.length) {
      activeLayerIndex = layers.length - 1;
    }
    renderLayerList();
    syncCanvasOrder();
    updatePointerTargets();
  }

  function setActiveLayer(index) {
    if (index < 0 || index >= layers.length) {
      return;
    }
    activeLayerIndex = index;
    renderLayerList();
    updatePointerTargets();
  }

  function syncCanvasOrder() {
    layers.forEach(layer => {
      canvasContainer.insertBefore(layer.canvas, previewCanvas);
    });
  }

  function updatePointerTargets() {
    layers.forEach((layer, idx) => {
      layer.canvas.style.pointerEvents = idx === activeLayerIndex && layer.visible ? 'auto' : 'none';
      layer.canvas.style.opacity = layer.visible ? '1' : '0';
    });
  }

  function renderLayerList() {
    const template = document.getElementById('layerItemTemplate');
    layerList.innerHTML = '';
    for (let i = layers.length - 1; i >= 0; i -= 1) {
      const layer = layers[i];
      const clone = template.content.firstElementChild.cloneNode(true);
      const item = clone;
      const nameEl = item.querySelector('.layer-name');
      const visibilityBtn = item.querySelector('.visibility-toggle');
      const upBtn = item.querySelector('.layer-up');
      const downBtn = item.querySelector('.layer-down');
      const deleteBtn = item.querySelector('.layer-delete');

      item.dataset.index = i.toString();
      nameEl.textContent = layer.name;

      if (!layer.visible) {
        visibilityBtn.classList.add('hidden');
        visibilityBtn.textContent = '🚫';
      }

      if (i === activeLayerIndex) {
        item.classList.add('active');
      }

      visibilityBtn.addEventListener('click', evt => {
        evt.stopPropagation();
        layer.visible = !layer.visible;
        visibilityBtn.classList.toggle('hidden', !layer.visible);
        visibilityBtn.textContent = layer.visible ? '👁' : '🚫';
        updatePointerTargets();
      });

      nameEl.addEventListener('focus', () => {
        if (document.queryCommandSupported?.('selectAll')) {
          document.execCommand('selectAll', false, null);
        }
      });

      nameEl.addEventListener('blur', () => {
        layer.name = nameEl.textContent.trim() || layer.name;
        renderLayerList();
      });

      nameEl.addEventListener('keydown', evt => {
        if (evt.key === 'Enter') {
          evt.preventDefault();
          nameEl.blur();
        }
      });

      upBtn.addEventListener('click', evt => {
        evt.stopPropagation();
        moveLayer(i, Math.min(layers.length - 1, i + 1));
      });

      downBtn.addEventListener('click', evt => {
        evt.stopPropagation();
        moveLayer(i, Math.max(0, i - 1));
      });

      deleteBtn.addEventListener('click', evt => {
        evt.stopPropagation();
        removeLayer(i);
      });

      item.addEventListener('click', () => {
        setActiveLayer(i);
      });

      layerList.appendChild(item);
    }
  }

  function moveLayer(from, to) {
    if (from === to) return;
    const [layer] = layers.splice(from, 1);
    layers.splice(to, 0, layer);
    if (activeLayerIndex === from) {
      activeLayerIndex = to;
    } else if (from < activeLayerIndex && to >= activeLayerIndex) {
      activeLayerIndex -= 1;
    } else if (from > activeLayerIndex && to <= activeLayerIndex) {
      activeLayerIndex += 1;
    }
    renderLayerList();
    syncCanvasOrder();
    updatePointerTargets();
  }

  function setActiveTool(tool) {
    activeTool = tool;
    [...toolButtons.querySelectorAll('button')].forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });
  }

  function pushHistory() {
    if (activeLayerIndex < 0) return;
    const layer = layers[activeLayerIndex];
    try {
      const snapshot = layer.ctx.getImageData(0, 0, WIDTH, HEIGHT);
      history.push({ layerIndex: activeLayerIndex, imageData: snapshot });
      if (history.length > 200) {
        history.shift();
      }
      redoStack.length = 0;
    } catch (error) {
      console.error('히스토리 저장 실패', error);
    }
  }

  function undo() {
    if (!history.length) return;
    const previous = history.pop();
    const targetLayer = layers[previous.layerIndex];
    const currentSnapshot = targetLayer.ctx.getImageData(0, 0, WIDTH, HEIGHT);
    redoStack.push({ layerIndex: previous.layerIndex, imageData: currentSnapshot });
    targetLayer.ctx.putImageData(previous.imageData, 0, 0);
    setActiveLayer(previous.layerIndex);
  }

  function redo() {
    if (!redoStack.length) return;
    const next = redoStack.pop();
    const targetLayer = layers[next.layerIndex];
    const currentSnapshot = targetLayer.ctx.getImageData(0, 0, WIDTH, HEIGHT);
    history.push({ layerIndex: next.layerIndex, imageData: currentSnapshot });
    targetLayer.ctx.putImageData(next.imageData, 0, 0);
    setActiveLayer(next.layerIndex);
  }

  function getCoordinates(evt) {
    const rect = canvasContainer.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const scaleY = HEIGHT / rect.height;
    return {
      x: (evt.clientX - rect.left) * scaleX,
      y: (evt.clientY - rect.top) * scaleY,
    };
  }

  function drawBrush(ctx, x0, y0, x1, y1, erase = false) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize;
    ctx.globalAlpha = brushOpacity;
    if (erase) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = brushColor;
    }
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.restore();
  }

  function drawShapePreview(tool, x0, y0, x1, y1) {
    previewCtx.clearRect(0, 0, WIDTH, HEIGHT);
    previewCtx.save();
    previewCtx.lineWidth = brushSize;
    previewCtx.strokeStyle = brushColor;
    previewCtx.globalAlpha = brushOpacity;
    previewCtx.fillStyle = brushColor;
    switch (tool) {
      case 'line':
        previewCtx.beginPath();
        previewCtx.moveTo(x0, y0);
        previewCtx.lineTo(x1, y1);
        previewCtx.stroke();
        break;
      case 'rectangle': {
        const w = x1 - x0;
        const h = y1 - y0;
        previewCtx.strokeRect(x0, y0, w, h);
        previewCtx.globalAlpha = brushOpacity * 0.25;
        previewCtx.fillRect(x0, y0, w, h);
        break;
      }
      case 'circle': {
        const radius = Math.hypot(x1 - x0, y1 - y0);
        previewCtx.beginPath();
        previewCtx.arc(x0, y0, radius, 0, Math.PI * 2);
        previewCtx.stroke();
        previewCtx.globalAlpha = brushOpacity * 0.25;
        previewCtx.fill();
        break;
      }
      default:
        break;
    }
    previewCtx.restore();
  }

  function commitShape(tool, ctx, x0, y0, x1, y1) {
    ctx.save();
    ctx.lineWidth = brushSize;
    ctx.strokeStyle = brushColor;
    ctx.fillStyle = brushColor;
    ctx.globalAlpha = brushOpacity;
    switch (tool) {
      case 'line':
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        break;
      case 'rectangle': {
        const w = x1 - x0;
        const h = y1 - y0;
        ctx.fillRect(x0, y0, w, h);
        break;
      }
      case 'circle': {
        const radius = Math.hypot(x1 - x0, y1 - y0);
        ctx.beginPath();
        ctx.arc(x0, y0, radius, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      default:
        break;
    }
    ctx.restore();
  }

  function hexToRgba(hex, alpha = 1) {
    let normalized = hex.replace('#', '');
    if (normalized.length === 3) {
      normalized = [...normalized].map(ch => ch + ch).join('');
    }
    const bigint = parseInt(normalized, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return { r, g, b, a: Math.round(alpha * 255) };
  }

  function rgbaToHex(r, g, b) {
    const toHex = value => value.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  function floodFill(x, y) {
    const layer = layers[activeLayerIndex];
    const ctx = layer.ctx;
    const imageData = ctx.getImageData(0, 0, WIDTH, HEIGHT);
    const data = imageData.data;
    const targetIndex = (Math.floor(y) * WIDTH + Math.floor(x)) * 4;
    const targetColor = data.slice(targetIndex, targetIndex + 4);
    const fillColor = hexToRgba(brushColor, brushOpacity);

    if (
      targetColor[0] === fillColor.r &&
      targetColor[1] === fillColor.g &&
      targetColor[2] === fillColor.b &&
      targetColor[3] === fillColor.a
    ) {
      return;
    }

    const stack = [{ x: Math.floor(x), y: Math.floor(y) }];
    const visited = new Uint8Array(WIDTH * HEIGHT);

    while (stack.length) {
      const { x: cx, y: cy } = stack.pop();
      if (cx < 0 || cy < 0 || cx >= WIDTH || cy >= HEIGHT) continue;
      const idx = cy * WIDTH + cx;
      if (visited[idx]) continue;
      visited[idx] = 1;
      const offset = idx * 4;
      if (
        data[offset] === targetColor[0] &&
        data[offset + 1] === targetColor[1] &&
        data[offset + 2] === targetColor[2] &&
        data[offset + 3] === targetColor[3]
      ) {
        data[offset] = fillColor.r;
        data[offset + 1] = fillColor.g;
        data[offset + 2] = fillColor.b;
        data[offset + 3] = fillColor.a;
        stack.push({ x: cx + 1, y: cy });
        stack.push({ x: cx - 1, y: cy });
        stack.push({ x: cx, y: cy + 1 });
        stack.push({ x: cx, y: cy - 1 });
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  function pickColor(x, y) {
    for (let i = layers.length - 1; i >= 0; i -= 1) {
      const layer = layers[i];
      if (!layer.visible) continue;
      const pixel = layer.ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
      if (pixel[3] !== 0) {
        const hex = rgbaToHex(pixel[0], pixel[1], pixel[2]);
        brushColor = hex;
        colorPicker.value = hex;
        const opacity = Math.max(10, Math.round((pixel[3] / 255) * 100));
        brushOpacity = opacity / 100;
        opacityRange.value = opacity.toString();
        opacityValue.textContent = opacity.toString();
        break;
      }
    }
  }

  function clearPreview() {
    previewCtx.clearRect(0, 0, WIDTH, HEIGHT);
  }

  function handlePointerDown(evt) {
    if (activeLayerIndex < 0) return;
    evt.preventDefault();
    const coords = getCoordinates(evt);
    const layer = layers[activeLayerIndex];
    const ctx = layer.ctx;
    startX = coords.x;
    startY = coords.y;
    lastX = coords.x;
    lastY = coords.y;

    if (activeTool === 'fill') {
      pushHistory();
      floodFill(coords.x, coords.y);
      return;
    }

    if (activeTool === 'text') {
      pushHistory();
      const text = prompt('입력할 텍스트를 적어주세요');
      if (text) {
        ctx.save();
        ctx.globalAlpha = brushOpacity;
        ctx.fillStyle = brushColor;
        ctx.font = `${textSize}px ${textFamily}`;
        ctx.textBaseline = 'top';
        ctx.fillText(text, coords.x, coords.y);
        ctx.restore();
      }
      return;
    }

    if (activeTool === 'eyedropper') {
      pickColor(coords.x, coords.y);
      return;
    }

    pushHistory();

    if (activeTool === 'brush' || activeTool === 'eraser') {
      isDrawing = true;
      drawBrush(ctx, coords.x, coords.y, coords.x, coords.y, activeTool === 'eraser');
    } else {
      isDrawing = true;
      clearPreview();
    }
    canvasContainer.setPointerCapture(evt.pointerId);
  }

  function handlePointerMove(evt) {
    if (!isDrawing || activeLayerIndex < 0) return;
    evt.preventDefault();
    const coords = getCoordinates(evt);
    const layer = layers[activeLayerIndex];
    const ctx = layer.ctx;

    if (activeTool === 'brush' || activeTool === 'eraser') {
      drawBrush(ctx, lastX, lastY, coords.x, coords.y, activeTool === 'eraser');
      lastX = coords.x;
      lastY = coords.y;
    } else {
      drawShapePreview(activeTool, startX, startY, coords.x, coords.y);
      lastX = coords.x;
      lastY = coords.y;
    }
  }

  function handlePointerUp(evt) {
    if (!isDrawing) return;
    const coords = getCoordinates(evt);
    const layer = layers[activeLayerIndex];
    const ctx = layer.ctx;

    if (activeTool === 'line' || activeTool === 'rectangle' || activeTool === 'circle') {
      commitShape(activeTool, ctx, startX, startY, coords.x, coords.y);
      clearPreview();
    }
    isDrawing = false;
    if (canvasContainer.hasPointerCapture?.(evt.pointerId)) {
      canvasContainer.releasePointerCapture(evt.pointerId);
    }
  }

  function handlePointerCancel(evt) {
    if (!isDrawing) return;
    isDrawing = false;
    clearPreview();
    if (evt && canvasContainer.hasPointerCapture?.(evt.pointerId)) {
      canvasContainer.releasePointerCapture(evt.pointerId);
    }
  }

  function mergeLayers() {
    if (layers.length <= 1) {
      alert('두 개 이상의 레이어가 있어야 병합할 수 있습니다.');
      return;
    }
    const mergedCanvas = document.createElement('canvas');
    mergedCanvas.width = WIDTH;
    mergedCanvas.height = HEIGHT;
    const mergedCtx = mergedCanvas.getContext('2d');
    layers.forEach(layer => {
      if (layer.visible) {
        mergedCtx.drawImage(layer.canvas, 0, 0);
      }
    });

    while (layers.length) {
      const layer = layers.pop();
      layer.canvas.remove();
    }
    layerCounter = 0;
    createLayer('병합된 레이어');
    layers[0].ctx.drawImage(mergedCanvas, 0, 0);
    history.length = 0;
    redoStack.length = 0;
  }

  function exportImage() {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = WIDTH;
    exportCanvas.height = HEIGHT;
    const exportCtx = exportCanvas.getContext('2d');
    layers.forEach(layer => {
      if (layer.visible) {
        exportCtx.drawImage(layer.canvas, 0, 0);
      }
    });
    const dataUrl = exportCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `web-photoshop-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function importImage(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(WIDTH / img.width, HEIGHT / img.height, 1);
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        const offsetX = (WIDTH - drawWidth) / 2;
        const offsetY = (HEIGHT - drawHeight) / 2;
        createLayer(file.name.replace(/\.[^.]+$/, '') || '불러온 이미지');
        const layer = layers[activeLayerIndex];
        layer.ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  toolButtons.addEventListener('click', evt => {
    const button = evt.target.closest('button[data-tool]');
    if (!button) return;
    setActiveTool(button.dataset.tool);
  });

  colorPicker.addEventListener('input', evt => {
    brushColor = evt.target.value;
  });

  sizeRange.addEventListener('input', evt => {
    brushSize = parseInt(evt.target.value, 10);
    sizeValue.textContent = brushSize.toString();
  });

  opacityRange.addEventListener('input', evt => {
    const value = parseInt(evt.target.value, 10);
    brushOpacity = value / 100;
    opacityValue.textContent = value.toString();
  });

  fontSizeRange.addEventListener('input', evt => {
    textSize = parseInt(evt.target.value, 10);
    fontSizeValue.textContent = textSize.toString();
  });

  fontFamilySelect.addEventListener('change', evt => {
    textFamily = evt.target.value;
  });

  undoBtn.addEventListener('click', undo);
  redoBtn.addEventListener('click', redo);

  clearBtn.addEventListener('click', () => {
    if (activeLayerIndex < 0) return;
    pushHistory();
    layers[activeLayerIndex].ctx.clearRect(0, 0, WIDTH, HEIGHT);
  });

  downloadBtn.addEventListener('click', exportImage);

  uploadInput.addEventListener('change', evt => {
    const [file] = evt.target.files;
    if (file) {
      importImage(file);
      evt.target.value = '';
    }
  });

  addLayerBtn.addEventListener('click', () => {
    createLayer();
  });

  mergeLayersBtn.addEventListener('click', mergeLayers);

  canvasContainer.addEventListener('pointerdown', handlePointerDown);
  canvasContainer.addEventListener('pointermove', handlePointerMove);
  canvasContainer.addEventListener('pointerup', handlePointerUp);
  canvasContainer.addEventListener('pointerleave', handlePointerCancel);
  canvasContainer.addEventListener('pointercancel', handlePointerCancel);

  window.addEventListener('keydown', evt => {
    const isMac = navigator.platform.toUpperCase().includes('MAC');
    const ctrlOrCmd = isMac ? evt.metaKey : evt.ctrlKey;
    if (ctrlOrCmd && evt.key.toLowerCase() === 'z') {
      evt.preventDefault();
      if (evt.shiftKey) {
        redo();
      } else {
        undo();
      }
    }
    if (ctrlOrCmd && evt.key.toLowerCase() === 'y') {
      evt.preventDefault();
      redo();
    }
    if (evt.key === 'Delete') {
      if (activeLayerIndex >= 0) {
        pushHistory();
        layers[activeLayerIndex].ctx.clearRect(0, 0, WIDTH, HEIGHT);
      }
    }
  });

  createLayer('배경');
})();
