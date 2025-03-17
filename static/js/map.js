  const container = document.getElementById('container');
  const floorSelect = document.getElementById('floor-select');

  function setupStageSize() {
    const container = document.getElementById('container');
    stage.width(container.clientWidth);
    stage.height(container.clientHeight);

    // Перерисовка при изменении размера окна
    window.addEventListener('resize', () => {
        stage.width(container.clientWidth);
        stage.height(container.clientHeight);
        stage.batchDraw();
    });
}

  const stage = new Konva.Stage({
      container: 'container',
      width: innerWidth,
      height: innerHeight,
      draggable: true
  });

  setupStageSize();

  // Функция сброса масштаба и позиции
  function resetStageTransform() {
      stage.scale({ x: 1, y: 1 });
      stage.position({ x: 0, y: 0 });
      stage.batchDraw();
  }

  // Параметры ограничений
  const LIMIT_WIDTH = 1920;
  const LIMIT_HEIGHT = 2522;
  const MIN_SCALE = 0.5;
  const MAX_SCALE = 3;

  // Переменные для плавного перемещения
  let isDragging = false;
  let lastPos = { x: 0, y: 0 };

  // Функция ограничения перемещения
 function constrainPosition(pos) {
    const scale = stage.scaleX();
    const stageWidth = stage.width();
    const stageHeight = stage.height();
    const contentWidth = LIMIT_WIDTH * scale;
    const contentHeight = LIMIT_HEIGHT * scale;

    // Центрирование по горизонтали, если контент меньше stage
    if (contentWidth < stageWidth) {
        pos.x = (stageWidth - contentWidth) / 2;
    } else {
        // Стандартные ограничения при большом контенте
        pos.x = Math.max(Math.min(pos.x, 0), -(contentWidth - stageWidth));
    }

    // Аналогично по вертикали
    if (contentHeight < stageHeight) {
        pos.y = (stageHeight - contentHeight) / 2;
    } else {
        pos.y = Math.max(Math.min(pos.y, 0), -(contentHeight - stageHeight));
    }

    return pos;
}

  // Обработчик начала перетаскивания
  stage.on('dragstart', function(e) {
      isDragging = true;
      lastPos = stage.position();
  });

  // Обработчик перемещения
  stage.on('dragmove', function(e) {
      if (isDragging) {
          const currentPos = stage.position();
          const constrainedPos = constrainPosition(currentPos);

          // Применяем ограниченную позицию
          stage.position(constrainedPos);
          stage.batchDraw();
      }
  });

  // Обработчик окончания перетаскивания
  stage.on('dragend', function(e) {
      isDragging = false;
  });

  // Обработка колесика мыши для зума
stage.on('wheel', (e) => {
    e.evt.preventDefault();

    // Текущие параметры
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    // Вычисление нового масштаба
    const scaleBy = 1.1;
    const newScale = e.evt.deltaY > 0
        ? oldScale / scaleBy
        : oldScale * scaleBy;

    // Ограничение масштаба
    const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));

    // Вычисление позиции с учетом курсора
    const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
    };

    // Применение нового масштаба
    stage.scale({ x: clampedScale, y: clampedScale });

    // Вычисление новой позиции с точным центрированием
    const newPos = {
        x: pointer.x - mousePointTo.x * clampedScale,
        y: pointer.y - mousePointTo.y * clampedScale
    };

    // Ограничение новой позиции
    const constrainedPos = constrainPosition(newPos);
    stage.position(constrainedPos);

    stage.batchDraw();
});

// Добавляем обработку мультитач-событий
let initialDistance = 0;
let initialScale = 1;

stage.on('touchstart', function(e) {
  const touch0 = e.evt.touches[0];
  const touch1 = e.evt.touches[1];

  // Если два пальца
  if (touch1) {
      // Отключаем стандартное перетаскивание
      stage.draggable(false);

      // Вычисляем начальное расстояние между пальцами
      initialDistance = Math.hypot(
          touch1.pageX - touch0.pageX,
          touch1.pageY - touch0.pageY
      );

      // Запоминаем начальный масштаб
      initialScale = stage.scaleX();
  }
});

stage.on('touchmove', function(e) {
  const touch0 = e.evt.touches[0];
  const touch1 = e.evt.touches[1];

  // Работаем только с двумя пальцами
  if (touch1) {
      // Вычисляем текущее расстояние между пальцами
      const currentDistance = Math.hypot(
          touch1.pageX - touch0.pageX,
          touch1.pageY - touch0.pageY
      );

      // Вычисляем коэффициент масштабирования
      const scale = currentDistance / initialDistance;

      // Новый масштаб
      const newScale = Math.max(
          MIN_SCALE,
          Math.min(MAX_SCALE, initialScale * scale)
      );

      // Центр зума - середина между пальцами
      const pointerPosition = {
          x: (touch0.pageX + touch1.pageX) / 2,
          y: (touch0.pageY + touch1.pageY) / 2
      };

      // Временно устанавливаем позицию указателя
      stage.setPointersPositions(e.evt);

      // Вычисляем позицию с учетом зума
      const mousePointTo = {
          x: (pointerPosition.x - stage.x()) / stage.scaleX(),
          y: (pointerPosition.y - stage.y()) / stage.scaleX(),
      };

      // Применяем масштаб
      stage.scale({ x: newScale, y: newScale });

      // Вычисляем новую позицию
      const newPos = {
          x: pointerPosition.x - mousePointTo.x * newScale,
          y: pointerPosition.y - mousePointTo.y * newScale
      };

      // Ограничиваем позицию
      const constrainedPos = constrainPosition(newPos);
      stage.position(constrainedPos);

      stage.batchDraw();
  }
});

stage.on('touchend', function(e) {
  // Возвращаем возможность перетаскивания
  stage.draggable(true);
});

// Улучшаем обработку одиночного касания для перетаскивания
let startPos = { x: 0, y: 0 };

stage.on('touchstart', function(e) {
  // Если одно касание
  if (e.evt.touches.length === 1) {
      const touch = e.evt.touches[0];
      startPos = {
          x: touch.pageX,
          y: touch.pageY
      };
  }
});

stage.on('touchmove', function(e) {
  // Если одно касание и не мультитач
  if (e.evt.touches.length === 1) {
      const touch = e.evt.touches[0];
      const dx = touch.pageX - startPos.x;
      const dy = touch.pageY - startPos.y;

      // Обновляем позицию
      const currentPos = stage.position();
      const newPos = {
          x: currentPos.x + dx,
          y: currentPos.y + dy
      };

      // Ограничиваем позицию
      const constrainedPos = constrainPosition(newPos);
      stage.position(constrainedPos);
      stage.batchDraw();

      // Обновляем начальную позицию
      startPos = {
          x: touch.pageX,
          y: touch.pageY
      };
  }
});

// Предотвращаем стандартное поведение прокрутки
document.addEventListener('touchmove', function(e) {
  // Отключаем стандартную прокрутку для элементов с зумом
  if (e.target.closest('#container')) {
      e.preventDefault();
  }
}, { passive: false });

  const layer = new Konva.Layer();
  stage.add(layer);

  let mapData = null;

  function renderElements(elements, parentGroup = null) {
      elements.forEach(element => {
          let konvaElement;
          switch(element.type) {
              case 'rect':
                  konvaElement = new Konva.Rect({
                      x: element.x,
                      y: element.y,
                      width: element.width,
                      height: element.height,
                      fill: element.fill || 'white',
                      stroke: 'black',
                      strokeWidth: 1
                  });
                  layer.add(konvaElement);

                  if (element.id) {
                      const text = new Konva.Text({
                          x: element.x + element.width / 2 - 10,
                          y: element.y + element.height / 2,
                          text: element.id,
                          fontSize: 10,
                          fill: 'black',
                      });
                      layer.add(text);
                  }
                  break;

              case 'path':
                  const konvaPath = new Konva.Path({
                      data: element.d,
                      fill: element.fill,
                      stroke: element.stroke,
                      strokeWidth: element.stroke_width
                  });
                  layer.add(konvaPath);

                  if (element.id && !element.id.includes("walls")) {
                      const pathRect = konvaPath.getClientRect();
                      const text = new Konva.Text({
                          x: pathRect.x + pathRect.width / 2,
                          y: pathRect.y + pathRect.height / 2,
                          text: element.id,
                          fontSize: 10,
                          fill: 'black',
                          offsetX: element.id.length * 3,
                          offsetY: 6
                      });
                      layer.add(text);
                  }
                  break;

              case 'road':
                  const line = new Konva.Line({
                      points: [element.start.x, element.start.y, element.end.x, element.end.y],
                      stroke: 'grey',
                      strokeWidth: 2,
                  });
                  layer.add(line);
                  break;
          }
      });
  }

  function renderFloor(floorNumber) {
    // Сбрасываем трансформации перед отрисовкой нового этажа
    resetStageTransform();

    layer.destroyChildren();

    const floorData = mapData.floors.find(floor => floor.id === `floor${floorNumber}`);

    if (!floorData) {
        console.error(`Floor ${floorNumber} not found`);
        return;
    }

    // Отрисовка комнат, путей и дорог
    renderElements(floorData.rooms);
    renderElements(floorData.paths);
    renderElements(floorData.roads);

    // Отрисовка подгрупп
    floorData.subgroups.forEach(subgroup => {
        renderElements(subgroup.elements);
    });

    layer.draw();

    // Центрирование карты
    const stageWidth = stage.width();
    const stageHeight = stage.height();
    const layerBox = layer.getClientRect();

    const scaleX = stageWidth / layerBox.width;
    const scaleY = stageHeight / layerBox.height;
    const scale = Math.min(scaleX, scaleY) * 1.2; // 120% от максимального масштаба

    stage.scale({ x: scale, y: scale });

    const centerX = (stageWidth - layerBox.width * scale) / 2;
    const centerY = (stageHeight - layerBox.height * scale) / 2;

    stage.position({
        x: centerX - layerBox.x * scale,
        y: centerY - layerBox.y * scale
    });

    stage.batchDraw();
}


  fetch('/map_data')
      .then(response => response.json())
      .then(data => {
          mapData = data;
          renderFloor(1);  // Первоначальная отрисовка 0 этажа
      });

  floorSelect.addEventListener('change', (e) => {
      const selectedFloor = parseInt(e.target.value);
      renderFloor(selectedFloor);
  });