from flask import Flask, render_template, request, jsonify
from processor import ProcessorSimulator

app = Flask(__name__)
simulator = ProcessorSimulator()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/submit-code", methods=["POST"])
def submit_code():
    code = request.json.get("code", "")
    simulator.submit_code(code.split("\n"))
    return jsonify({"message": "Code submitted successfully"})


@app.route("/api/step", methods=["POST"])
def step():
    try:
        result = simulator.step()
        return jsonify(
            {
                "pc": result["pc"],
                "acc": result["acc"],
                "b": result["b"],
                "mar": result["mar"],
                "mdr": result["mdr"],
                "ir": result["ir"],
                "nf": result["nf"],
                "comments": result["comments"],
                "instruction": result["instruction"],
                "ram": result["ram"],
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/run", methods=["POST"])
def run():
    try:
        results = simulator.run_all()
        return jsonify({"results": results})
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/reset", methods=["POST"])
def reset():
    simulator.reset()
    return jsonify({"message": "Simulator reset successfully"})


@app.route("/api/set-ram", methods=["POST"])
def set_ram():
    data = request.json
    address = data.get("address")
    label = data.get("label")
    value = data.get("value")
    simulator.set_ram_value(address, label, value)
    return jsonify({"message": "RAM value set successfully"})


if __name__ == "__main__":
    app.run(debug=True)


