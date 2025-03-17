from flask import Flask, jsonify, send_from_directory, request, send_file
import xml.etree.ElementTree as ET
import json
import re
import os

app = Flask(__name__, static_folder="static")


def parse_element(element, transform_regex):
    elements = []


    # Обработка прямоугольников
    if element.tag.endswith("rect"):
        attributes = element.attrib
        x = float(attributes.get("x", 0))
        y = float(attributes.get("y", 0))
        width = float(attributes.get("width", 0))
        height = float(attributes.get("height", 0))
        id = attributes.get("id")
        style = attributes.get("style")

        transform_match = transform_regex.match(attributes.get("transform", ""))
        if transform_match:
            x += float(transform_match.group(1))
            y += float(transform_match.group(2))

        fill_color = attributes.get("fill")

        elements.append({
            "type": "rect",
            "id": id,
            "x": x,
            "y": y,
            "width": width,
            "height": height,
            "fill": fill_color,
        })

    # Обработка линий
    elif element.tag.endswith('line'):
        attributes = element.attrib
        x1 = float(attributes.get('x1', 0))
        y1 = float(attributes.get('y1', 0))
        x2 = float(attributes.get('x2', 0))
        y2 = float(attributes.get('y2', 0))
        transform_match = transform_regex.match(attributes.get("transform", ""))
        if transform_match:
            x1 += float(transform_match.group(1))
            y1 += float(transform_match.group(2))
            x2 += float(transform_match.group(1))
            y2 += float(transform_match.group(2))

        elements.append({
            "type": "road",
            "start": {"x": x1, "y": y1},
            "end": {"x": x2, "y": y2}
        })

    # Обработка путей
    elif element.tag.endswith("path"):
        attributes = element.attrib
        id = attributes.get("id")
        d = attributes.get("d", "")
        fill = attributes.get("fill", "#FFFFFF")
        stroke = attributes.get("stroke", "black")
        stroke_width = float(attributes.get("stroke-width", 1))

        elements.append({
            "type": "path",
            "id": id,
            "d": d,
            "fill": fill,
            "stroke": stroke,
            "stroke_width": stroke_width
        })

    # Рекурсивная обработка вложенных групп
    if element.tag.endswith("}g"):
        for sub_element in element:
            elements.extend(parse_element(sub_element, transform_regex))

    return elements


def extract_svg_data(svg_filepath):
    tree = ET.parse(svg_filepath)
    root = tree.getroot()
    data = {'floors': []}

    transform_regex = re.compile(r"translate\(([^,]+),\s*([^)]+)\)")

    for floor_element in root.findall('.//{http://www.w3.org/2000/svg}g[@id]'):
        floor_id = floor_element.get('id')

        # Проверяем, что это группа этажа
        if floor_id and floor_id.startswith('floor'):
            floor_data = {
                "id": floor_id,
                "rooms": [],
                "roads": [],
                "paths": [],
                "subgroups": []
            }

            # Парсинг элементов и подгрупп
            for element in floor_element:
                parsed_elements = parse_element(element, transform_regex)

                # Распределение элементов по типам
                for el in parsed_elements:
                    if el['type'] == 'rect':
                        floor_data['rooms'].append(el)
                    elif el['type'] == 'road':
                        floor_data['roads'].append(el)
                    elif el['type'] == 'path':
                        floor_data['paths'].append(el)

                # Если элемент - группа с id, добавляем как подгруппу
                if element.tag.endswith("}g") and element.get('id'):
                    subgroup_data = {
                        "id": element.get('id'),
                        "elements": parsed_elements
                    }
                    floor_data['subgroups'].append(subgroup_data)

            data['floors'].append(floor_data)

    return data


# Загружаем данные карты из SVG файлов всех этажей при запуске приложения
def load_all_floor_maps():
    floors_data = []
    for floor_num in range(5):  # 0-4 этажи
        svg_path = f"static/floorplans/floor{floor_num}.svg"
        if os.path.exists(svg_path):
            floor_data = extract_svg_data(svg_path)
            floors_data.extend(floor_data['floors'])

    with open("map_data.json", "w") as f:
        json.dump({"floors": floors_data}, f)


load_all_floor_maps()


@app.route("/map_data")
def get_map_data():
    with open("map_data.json", "r") as f:
        map_data_ = json.load(f)
    return jsonify(map_data_)


@app.route("/")
def index():
    return send_from_directory("templates", "index.html")


@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)


if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000, debug=True)