# app.py (Flask backend)
from flask import Flask, jsonify, send_from_directory, request
import xml.etree.ElementTree as ET
import json
import re

app = Flask(__name__, static_folder="static")

# Функция для извлечения данных из SVG
def extract_svg_data(svg_filepath):
    tree = ET.parse(svg_filepath)
    root = tree.getroot()
    data = {'floors': []}  # Словарь для хранения данных по этажам

    for floor_element in root.findall('.//{http://www.w3.org/2000/svg}g[@id]'):
        floor_id = floor_element.get('id')
        floor_data = {
            "id": floor_id,
            "rooms": [],
            "roads": [],
            "stairs": [],
            "places": [],
            "photoPoints": []
        }

        transform_regex = re.compile(r"translate\(([^,]+),\s*([^)]+)\)")  # Для translate
        for element in floor_element:
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

                fill_color = None
                if style:
                    style_parts = style.split(";")
                    for part in style_parts:
                        if part.startswith("fill:"):
                            fill_color = part.split(":")[1].strip()
                            break

                floor_data["rooms"].append({
                    "type": "rect",
                    "id": id,
                    "x": x,
                    "y": y,
                    "width": width,
                    "height": height,
                    "fill": fill_color,
                    # ... другие атрибуты ...
                })
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

                floor_data['roads'].append({
                    "type": "road",
                    "start": {"x": x1, "y": y1},
                    "end": {"x": x2, "y": y2}
                })
        data['floors'].append(floor_data)

    return data


# Загружаем данные карты из SVG файла при запуске приложения (можно изменить на динамическую загрузку)
with open("map_data.json", "w") as f:  # Сохраняем данные в JSON файл для использования во фронтенде
    json.dump(extract_svg_data("static/floorplans/floor0.svg"), f)
# Замените floorplan.svg на ваш SVG файл



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
    app.run(debug=True)