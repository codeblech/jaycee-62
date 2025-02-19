from flask import Flask, render_template, request, jsonify
from processor import ProcessorSimulator
import google.generativeai as genai
import os
from dotenv import load_dotenv
from functools import lru_cache

load_dotenv()

app = Flask(__name__)
simulator = ProcessorSimulator()


# Configure Gemini API
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-pro")


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


# Add cache for AI analysis
@lru_cache(maxsize=100)  # Cache up to 100 different code analyses
def get_ai_analysis(code: str, history_str: str):
    prompt = f"""You are an educational assistant helping students understand assembly code execution.
Please provide your analysis in proper markdown format.

Code submitted:
{code}

Execution history:
{history_str}

Please provide a detailed analysis including:

## Program Overview
- Purpose and main objectives
- Input/output expectations

## Code Analysis
- Breakdown of each instruction
- Data flow between registers
- Memory access patterns
- Control flow explanation

## Execution Trace
- Step-by-step explanation of the execution history
- Register state changes and their significance
- Memory modifications

## Performance Analysis
- Number of instructions executed
- Memory access patterns
- Potential optimizations

## Common Pitfalls
- Potential errors or issues
- Edge cases to consider
- Common misconceptions

## Best Practices
- Suggestions for code improvement
- Alternative approaches
- Assembly programming tips

Please use code blocks, tables, and bullet points where appropriate to make the explanation clear and structured."""
    response = model.generate_content(prompt)
    return response.text


@app.route("/api/ai-assist", methods=["POST"])
def ai_assist():
    try:
        code = request.json.get("code", "")
        execution_history = request.json.get("history", [])

        # Convert history to string for caching (lists aren't hashable)
        history_str = str(execution_history)

        # Get cached or new analysis
        explanation = get_ai_analysis(code, history_str)
        return jsonify({"explanation": explanation})
    except Exception as e:
        return jsonify({"error": str(e)}), 400


if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=True, port=5000)
