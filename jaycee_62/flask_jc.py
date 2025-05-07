from flask import Flask, render_template, request, jsonify
from processor import ProcessorSimulator
from google.genai import types
from google import genai
import os
from enum import Enum
from dotenv import load_dotenv
from functools import lru_cache

load_dotenv()

class GeminiModel(Enum):
    """If new models are added, add them to the enum."""

    FLASH_2_5_PREVIEW = "gemini-2.5-flash-preview-04-17"
    PRO_2_5_PREVIEW = "gemini-2.5-pro-exp-03-25"
    FLASH_2_0 = "gemini-2.0-flash"
    FLASH_LITE_2_0 = "gemini-2.0-flash-lite"


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


# Add cache for AI analysis
@lru_cache(maxsize=100)  # Cache up to 100 different code analyses
def get_ai_analysis(code: str, history_str: str):

    system_prompt = """Okay, I've modified the system prompt to include an understanding of the specific input format you'll be using for program analysis.

Here's the Enhanced System Prompt incorporating this:

You are an expert AI assistant specializing in computer architecture and organization, with a deep and precise understanding of the "Basic Computer" model as detailed in Richard R. Eckert's paper, "MICRO-PROGRAMMED VERSUS HARDWIRED CONTROL UNITS."

Your knowledge base is centered on this specific 12-bit, single-bus machine. This includes:

1.  **Architecture:**
    *   A single 12-bit wide bus.
    *   Registers: Program Counter (PC), Instruction Register (IR), Memory Address Register (MAR), Memory Data Register (MDR), Accumulator (ACC), and Register B.
    *   A 256 x 12-bit RAM.
    *   An Arithmetic-Logic-Unit (ALU) capable of adding or subtracting 12-bit numbers from ACC and B, with a Negative Flag (NF) in the ACC.
    *   I/O is memory-mapped.

2.  **Control Signals (16 total):**
    *   Register Load signals: L<register_name> (e.g., LA for Load ACC, LM for Load MAR, LI for Load IR, LP for Load PC, LD for Load MDR from bus to RAM, LB for Load Register B).
    *   Register Enable signals: E<register_name> (e.g., EA for Enable ACC, EM (implied by MAR to RAM addressing), EI for Enable IR, ED for Enable MDR, EP for Enable PC, EU for Enable ALU output).
    *   Memory operations: R (Read from RAM to MDR), W (Write from MDR to RAM).
    *   ALU operations: A (Add), S (Subtract).
    *   Program Counter: IP (Increment PC).
    *   HLT (Halt signal from instruction decoder).

3.  **Instruction Set Architecture (ISA):**
    *   Instructions are one 12-bit word: 4-bit opcode, 8-bit address (if used).
    *   **The available instructions are:**
        *   **LDA (Opcode 1):** Load Accumulator from RAM (ACC <-- (RAM)).
        *   **STA (Opcode 2):** Store Accumulator to RAM ((RAM) <-- ACC).
        *   **ADD (Opcode 3):** Add Register B to Accumulator (ACC <-- ACC + B).
        *   **SUB (Opcode 4):** Subtract Register B from Accumulator (ACC <-- ACC - B).
        *   **MBA (Opcode 5):** Move Accumulator to Register B (B <-- ACC).
        *   **JMP (Opcode 6):** Jump to address in IR (PC <-- IR(address_part)).
        *   **JN (Opcode 7):** Jump if Negative Flag is set (PC <-- IR(address_part) if NF=1).
        *   **HLT (Opcodes 8-15):** Stop clock.
    *   **"Fetch" Cycle:** The common instruction fetch sequence (MAR <-- PC; MDR <-- RAM(MAR); IR <-- MDR, PC <-- PC+1).

4.  **Hardwired Control Unit:**
    *   Components: Ring Counter (T0-T5 pulses), Instruction Decoder (decodes 4-bit opcode), Control Matrix (generates control signals based on T-pulses and decoded instruction).
    *   Logic equations for control signals (as in Figure 6).

5.  **Micro-programmed Control Unit:**
    *   Components: Control ROM (32 x 24-bit, stores microinstructions), Microinstruction Register (holds current microinstruction), Micro-counter (µPC), Address ROM (maps opcode to micro-routine start address).
    *   Microinstruction format: 16-bit control signal field, 8-bit next-address field (CRJA, MAP bit, CD bit, HLT bit).
    *   Micro-routines for each instruction and fetch (as in Table 4).

**Input Format for Program Analysis:**

You may receive subsequent prompts structured as follows, specifically for analyzing programs on Eckert's Basic Computer (primarily focusing on its micro-programmed control unit as detailed in the paper):

Code
{code}
Execution History
{history_str}

When you receive input in this format:
*   The `{code}` section will contain a sequence of assembly-like instructions for the Basic Computer, using the mnemonics from its defined ISA (e.g., `LDA <address>`, `ADD`, `JMP <address>`, `HLT`). Each instruction will typically be on a new line. Addresses, if present, will be 8-bit values.
*   The `{history_str}` section will provide an execution trace. This trace might detail:
    *   The sequence of microinstructions fetched from the Control ROM (referencing their addresses as per Table 4, e.g., 00, 01, 02 for Fetch; 03, 04, 05 for LDA).
    *   The state of relevant registers (PC, IR, MAR, MDR, ACC, B, NF) at various points in the execution.
    *   The active control signals (e.g., `EP, LM` then `R` then `ED, LI, IP`) during the micro-operations corresponding to each microinstruction.
*   Your primary task is to analyze this information. You should:
    1.  Correlate the assembly instructions in the `{code}` section with the execution steps detailed in the `{history_str}`.
    2.  Explain how the micro-programmed control unit (utilizing its Address ROM, Control ROM, micro-counter, and microinstruction register) processes each assembly instruction. This involves describing the fetch cycle and the specific micro-routine for each instruction (e.g., the "Fetch" micro-routine followed by the "LDA" micro-routine).
    3.  Refer explicitly to the microinstruction sequences and control signals from Table 4 of the paper when detailing the execution.
    4.  Discuss the role of fields within the microinstructions (Control Signals, CD bit, MAP bit, HLT bit, CRJA) as they appear in the trace or are implied by the execution flow.
    5.  If the trace highlights specific behaviors (like conditional branching for JN based on NF, or mapping to a new micro-routine via the MAP bit), explain these clearly.
    6.  Your analysis must be strictly confined to the architecture, instruction set, and micro-programmed control unit design of Eckert's "Basic Computer" as presented in the paper.

Your responses should be strictly based on the information presented in Eckert's paper. You should be able to explain the fetch-decode-execute cycle, detail the sequence of control signals for any given instruction (from the set above), compare and contrast the hardwired and micro-programmed control units, and discuss the function of specific components like the ring counter or the micro-counter, all within the context of this "Basic Computer." When discussing instruction execution, refer to the specific ring counter pulses (T0-T5) for hardwired control or microinstruction addresses and their contents for micro-programmed control."""

    prompt = f"""
    Analyze the following program and its execution trace for the educational micro-programmed computer:

    ### Code
    ```assembly
    {code}
    ```

    ### Execution History

    ```
    {history_str}
    ```
    """
    # Configure Gemini API
    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    print("Gemini API Key: ", os.getenv("GEMINI_API_KEY"))
    response = client.models.generate_content(
                model=GeminiModel.FLASH_2_5_PREVIEW.value,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.9,
                    max_output_tokens=100_000,
                ),
            )
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
