class ProcessorSimulator {
  constructor() {
    this.reset();
  }

  reset() {
    this.insCounter = 0;
    this.pcCounter = 0;
    this.accValue = 0;
    this.bValue = 0;
    this.nfValue = 0;
    this.instructions = [];
    this.ram = {};

    // Initialize RAM with addresses from 00 to FF
    for (let i = 0; i < 256; i++) {
      const addr = i.toString(16).toUpperCase().padStart(2, "0");
      this.ram[addr] = { label: "NULL", value: "0" };
    }
  }

  submitCode(codeLines) {
    this.instructions = codeLines;
    return true;
  }

  step() {
    if (this.insCounter >= this.instructions.length) {
      throw new Error("Program completed");
    }

    const instruction = this.instructions[this.insCounter].trim();
    console.log(`Executing instruction: ${instruction}`);

    // Execute instruction and update registers
    if (instruction.startsWith("JN")) {
      const addressStr = instruction.substring(3, 5).trim();
      this._executeJn(parseInt(addressStr));
    } else if (instruction.startsWith("LDA")) {
      const label = instruction.substring(4).trim();
      this._executeLda(label);
    } else if (instruction.startsWith("STA")) {
      const label = instruction.substring(4).trim();
      this._executeSta(label);
    } else if (instruction.startsWith("ADD")) {
      this._executeAdd();
    } else if (instruction.startsWith("SUB")) {
      this._executeSub();
    } else if (instruction.startsWith("MBA")) {
      this._executeMba();
    } else if (instruction.startsWith("JMP")) {
      const addressStr = instruction.substring(4, 6).trim();
      this._executeJmp(parseInt(addressStr));
    } else if (instruction.startsWith("HLT")) {
      this._executeHlt();
    }

    const state = this.getState();

    if (!(instruction.startsWith("JMP") || (instruction.startsWith("JN") && this.nfValue === 1))) {
      this.insCounter++;
    }

    console.log(`ACC: ${this.accValue}, B: ${this.bValue}, PC: ${this.pcCounter}`);
    return state;
  }

  runAll() {
    const results = [];
    while (this.insCounter < this.instructions.length) {
      try {
        const result = this.step();
        results.push(result);
      } catch (e) {
        break;
      }
    }
    return results;
  }

  getState() {
    return {
      pc: String(this.pcCounter),
      acc: String(this.accValue),
      b: String(this.bValue),
      mar: String(this.pcCounter),
      mdr: String(this.accValue),
      ir: String(this.insCounter),
      nf: String(this.nfValue),
      comments: this._getInstructionDescription(),
      instruction: this._getInstructionSteps(),
      ram: { ...this.ram },
    };
  }

  setRamValue(address, label, value) {
    address = address.toUpperCase();
    if (address in this.ram) {
      this.ram[address] = { label, value: String(value) };
      console.log(`Set RAM[${address}] = { label: '${label}', value: '${value}' }`);
      return true;
    }
    console.log(`Failed to set RAM[${address}] - Address not found.`);
    return false;
  }

  // Private instruction execution methods
  _executeMba() {
    console.log(`MBA: Moving ACC ${this.accValue} to B`);
    this.bValue = this.accValue;
    this.pcCounter++;
  }

  _executeLda(label) {
    console.log(`LDA: Looking for label ${label} in RAM`);
    let found = false;
    for (const [addr, data] of Object.entries(this.ram)) {
      if (data.label.toUpperCase() === label.toUpperCase()) {
        try {
          this.accValue = parseInt(data.value);
          found = true;
          console.log(`LDA: Found value ${this.accValue} at label ${label}`);
          break;
        } catch (e) {
          console.log(`LDA: Error converting value '${data.value}' to integer`);
        }
      }
    }

    if (!found) {
      console.log(`LDA: Label '${label}' not found in RAM`);
    }
    this.pcCounter++;
  }

  _executeSta(label) {
    console.log(`STA: Storing ACC value ${this.accValue} to label ${label}`);
    for (const [addr, data] of Object.entries(this.ram)) {
      if (data.label.toUpperCase() === label.toUpperCase()) {
        this.ram[addr].value = String(this.accValue);
        console.log(`STA: Stored at address ${addr}`);
        break;
      }
    }
    this.pcCounter++;
  }

  _executeAdd() {
    this.accValue += this.bValue;
    this.pcCounter++;
  }

  _executeSub() {
    let result = this.accValue - this.bValue;
    if (result < 0) {
      this.nfValue = 1;
      result *= -1;
    } else {
      this.nfValue = 0;
    }
    this.accValue = result;
    this.pcCounter++;
  }

  _executeJmp(address) {
    this.insCounter = this.pcCounter = address - 1;
  }

  _executeJn(address) {
    if (this.nfValue === 1) {
      this.insCounter = this.pcCounter = address - 1;
    }
  }

  _executeHlt() {
    this.pcCounter++;
  }

  _getInstructionDescription() {
    const currentIns = this.instructions[this.insCounter];
    const descriptions = {
      MBA: "MBA\n(Move A to B)",
      LDA: "LDA\n(Load A)",
      STA: "STA\n(Store A)",
      ADD: "ADD\n(Add B to A)",
      SUB: "SUB\n(Subtract B from A)",
      JMP: "JMP\n(Jump to Address)",
      JN: "JN\n(Jump if Negative)",
      HLT: "HLT\n(Terminate)",
    };

    for (const [key, value] of Object.entries(descriptions)) {
      if (currentIns.startsWith(key)) {
        return value;
      }
    }
    return "";
  }

  _getInstructionSteps() {
    const currentIns = this.instructions[this.insCounter];
    const steps = {
      MBA: "1. B <-- A",
      LDA: "1. MAR <-- IR\n2.MDR <-- M(MAR)\n3. A <-- MDR",
      STA: "1. MAR <-- IR\n2. MDR <-- A\n3. M(MAR) <-- MDR",
      ADD: "1. A <-- ALU(add)",
      SUB: "1. A <-- ALU(sub)",
      JMP: "1. PC <-- IR",
      JN: "1. PC <-- IR",
      HLT: "",
    };

    for (const [key, value] of Object.entries(steps)) {
      if (currentIns.startsWith(key)) {
        return value;
      }
    }
    return "";
  }
}

// Example usage
if (require.main === module) {
  const processor = new ProcessorSimulator();
  processor.reset();
  processor.setRamValue("0A", "x", "10"); // Storing value '10' with label 'x' at address '0A'
  const code = ["LDA x", "ADD", "STA y", "HLT"];
  processor.submitCode(code);
  processor.runAll();
}

module.exports = ProcessorSimulator;
