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
      const stageWidth = LIMIT_WIDTH * scale;
      const stageHeight = LIMIT_HEIGHT * scale;

      // Ограничения по горизонтали
      pos.x = Math.max(Math.min(pos.x, 0), -(stageWidth - stage.width()));

      // Ограничения по вертикали
      pos.y = Math.max(Math.min(pos.y, 0), -(stageHeight - stage.height()));

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

      // Вычисление новго масштаба
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

      // Вычисление новой позиции
      const newPos = {
          x: pointer.x - mousePointTo.x * clampedScale,
          y: pointer.y - mousePointTo.y * clampedScale
      };

      // Ограничение новой позиции
      const constrainedPos = constrainPosition(newPos);
      stage.position(constrainedPos);

      stage.batchDraw();
  });

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
          renderFloor(0);  // Первоначальная отрисовка 0 этажа
      });

  floorSelect.addEventListener('change', (e) => {
      const selectedFloor = parseInt(e.target.value);
      renderFloor(selectedFloor);
  });