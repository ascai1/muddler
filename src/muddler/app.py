import io
import logging
import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from muddler.core import (
    parse_file, permute,
    convert_binary_to_degrees, convert_binary_to_intervals,
)


app = Flask(__name__)

app.config["DEBUG"] = False
app.config['APPLICATION_ROOT'] = '/muddler'


ALLOWED_ORIGIN = os.environ.get("MUDDLER_ORIGIN", "http://localhost:5000")

CORS(app, resources={r"/muddle": {"origins": ALLOWED_ORIGIN}})


limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["60 per minute", "5 per second"],
    headers_enabled=True,   # sends X-RateLimit-* headers so clients can adapt
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)


MAX_CONTENT_BYTES = 4_096       # raw input string length
MAX_EDO = 128                   # largest EDO we'll process
MAX_SCALE_ROWS = 6              # maximum nesting depth

SCRIPT_URL = "https://github.com/ascai1/muddler"
LIMIT_NOTE = f"For larger inputs, use the full Python script at {SCRIPT_URL}"


def _validate_content(content: str) -> str | None:
    if len(content) > MAX_CONTENT_BYTES:
        return f"Input too large (max {MAX_CONTENT_BYTES} bytes). {LIMIT_NOTE}"
    lines = [l for l in content.splitlines() if l.strip() and not l.startswith("#")]
    if len(lines) < 2:
        return "Input must have a header line and at least one scale."
    if len(lines) - 1 > MAX_SCALE_ROWS:
        return f"Too many scale rows (max {MAX_SCALE_ROWS}). {LIMIT_NOTE}"
    header = lines[0].split()
    try:
        edo = int("".join(c for c in header[0] if c.isdigit()))
    except (ValueError, IndexError):
        return "Could not parse EDO size from header."
    if edo > MAX_EDO:
        return f"EDO too large (max {MAX_EDO}). {LIMIT_NOTE}"
    return None


@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({"error": "Too many requests. Please slow down."}), 429


@app.errorhandler(500)
def internal_error(e):
    logger.error("Unhandled error: %s", e)
    return jsonify({"error": "Internal server error."}), 500


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
@limiter.limit("30 per minute")
def muddle():
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "Request body must be JSON."}), 400

    content = body.get("content")
    if not content:
        return jsonify({"error": "JSON body must include a 'content' string field."}), 400

    initial_index = body.get("initial_index", 1)
    if initial_index not in (0, 1):
        return jsonify({"error": "'initial_index' must be 0 or 1."}), 400

    validation_error = _validate_content(content)
    if validation_error:
        return jsonify({"error": validation_error}), 400

    try:
        scale_input = parse_file(io.StringIO(content), initial_index=initial_index)
    except Exception as exc:
        logger.warning("parse_file failed: %s", exc)
        return jsonify({"error": f"Failed to parse input: {exc}"}), 400

    try:
        muddle_groups = permute(scale_input)
    except Exception as exc:
        logger.error("permute failed: %s", exc)
        return jsonify({"error": "Failed to generate muddles."}), 500

    return jsonify(serialize_muddle_groups(muddle_groups, initial_index=initial_index))


@app.route('/')
def index():
    return send_from_directory('static', 'index.html')


if __name__ == "__main__":
    app.run(debug=True)
