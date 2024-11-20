from flask import Flask, render_template, request, jsonify
from processor import ProcessorSimulator
import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
simulator = ProcessorSimulator()


# Configure Gemini API
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
model = genai.GenerativeModel('gemini-pro')


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


@app.route("/api/ai-assist", methods=["POST"])
def ai_assist():
    try:
        code = request.json.get("code", "")
        execution_history = request.json.get("history", [])

        prompt = f"""You are an educational assistant helping students understand assembly code execution.

Code submitted:
{code}

Execution history:
{execution_history}

Please explain:
1. What is the purpose of this program?
2. How does it work step by step?
3. If there are any errors, what might be causing them?
4. What are the expected outcomes?

Use the register states shown in the execution history to support your explanation."""

        response = model.generate_content(prompt)
        return jsonify({"explanation": response.text})
    except Exception as e:
        return jsonify({"error": str(e)}), 400


if __name__ == "__main__":
    app.run(debug=True)
