import io
from flask import Flask, request, jsonify, send_from_directory

from muddler.core import (
    parse_file, permute,
    convert_binary_to_degrees, convert_binary_to_intervals,
)

app = Flask(__name__)


def serialize_muddle_groups(muddle_groups, initial_index=1):
    result = []
    for group_index, (key, muddle_group) in enumerate(muddle_groups.items(), start=1):
        modes = []
        for order, muddles in sorted(muddle_group.items()):
            representative = muddles[0]
            degrees = [d + initial_index for d in representative.degrees]
            intervals = list(representative.intervals)
            context = []
            for muddle in muddles:
                chain = []
                for mode in muddle.modes:
                    chain.append({
                        "mode_intervals": list(
                            convert_binary_to_intervals(mode.mode, mode.edo)
                        ),
                        "mode_degrees": [
                            d + initial_index
                            for d in convert_binary_to_degrees(mode.mode)
                        ],
                        "root_degree": mode.root_degree + initial_index,
                        "root_mos_degree": mode.root_mos_degree + initial_index,
                        "source_scale_intervals": list(
                            convert_binary_to_intervals(mode.scale.scale, mode.edo)
                        ),
                        "source_scale_degrees": [
                            d + initial_index
                            for d in convert_binary_to_degrees(mode.scale.scale)
                        ],
                    })
                context.append(chain)

            modes.append({
                "degrees": degrees,
                "intervals": intervals,
                "context": context,
            })

        result.append({
            "group": group_index,
            "interval_cycle": list(key),
            "modes": modes,
        })
    return result


@app.route("/muddle", methods=["POST"])
def muddle():
    """
    Accepts a JSON body with:
      - "content" (required): string containing the raw muddler input text
      - "initial_index" (optional): 0 or 1 (default 1)

    Returns a JSON list of muddle groups in insertion order.
    """
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "Request body must be JSON."}), 400

    content = body.get("content")
    if not content:
        return jsonify({"error": "JSON body must include a 'content' string field."}), 400

    initial_index = body.get("initial_index", 1)
    if initial_index not in (0, 1):
        return jsonify({"error": "'initial_index' must be 0 or 1."}), 400

    try:
        scale_input = parse_file(io.StringIO(content), initial_index=initial_index)
    except Exception as exc:
        return jsonify({"error": f"Failed to parse input: {exc}"}), 400

    try:
        muddle_groups = permute(scale_input)
    except Exception as exc:
        return jsonify({"error": f"Failed to generate muddles: {exc}"}), 500

    return jsonify(serialize_muddle_groups(muddle_groups, initial_index=initial_index))


@app.route('/')
def index():
    return send_from_directory('static', 'index.html')


if __name__ == "__main__":
    app.run(debug=True)
