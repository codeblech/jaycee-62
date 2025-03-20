document.addEventListener("DOMContentLoaded", function () {
  // Add this near the top of the DOMContentLoaded handler
  let lastSavedCode = "";
  const codeEditor = document.getElementById("codeEditor");
  const unsavedIndicator = document.getElementById("unsavedIndicator");
  const executionHistory = [];

  codeEditor.addEventListener("input", function () {
    if (this.value !== lastSavedCode) {
      unsavedIndicator.classList.remove("hidden");
    } else {
      unsavedIndicator.classList.add("hidden");
    }
  });

  // Load sample codes
  fetch("/static/sample_codes.json")
    .then((response) => response.json())
    .then((sampleCodes) => {
      const select = document.getElementById("sampleCodeSelect");
      sampleCodes.forEach((sample, index) => {
        const option = document.createElement("option");
        option.value = index;
        option.textContent = sample.programName;
        select.appendChild(option);
      });

      // Add change event listener
      select.addEventListener("change", async function () {
        if (this.value === "") return;

        const sample = sampleCodes[this.value];
        const newCode = sample.program.join("\n");

        // Check if there are unsaved changes before loading new sample
        if (codeEditor.value !== lastSavedCode) {
          if (!confirm("You have unsaved changes. Load sample program anyway?")) {
            this.value = ""; // Reset select to empty if user cancels
            return;
          }
        }

        // Set code in editor and update saved state
        codeEditor.value = newCode;
        lastSavedCode = codeEditor.value;
        unsavedIndicator.classList.remove("hidden");

        try {
          // Reset RAM first
          await fetch("/api/reset", { method: "POST" });

          // Set up RAM
          for (const ramSetup of sample.ramSetup) {
            const response = await fetch("/api/set-ram", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                address: ramSetup.address,
                label: ramSetup.label || "",
                value: ramSetup.value || "",
              }),
            });

            if (!response.ok) {
              throw new Error(`Failed to set RAM at address ${ramSetup.address}`);
            }
          }

          // Update the RAM table display
          const rows = ramTable.getElementsByTagName("tr");
          for (const row of rows) {
            const addr = row.cells[0].textContent;
            const ramSetup = sample.ramSetup.find((setup) => setup.address === addr);
            if (ramSetup) {
              row.cells[1].textContent = ramSetup.label || "NULL";
              row.cells[2].textContent = ramSetup.value || "NULL";
            } else {
              row.cells[1].textContent = "NULL";
              row.cells[2].textContent = "NULL";
            }
          }
        } catch (error) {
          console.error("Error setting up RAM:", error);
          alert("Failed to set up RAM values");
        }
      });
    })
    .catch((error) => console.error("Error loading sample codes:", error));

  // Modify RAM table initialization
  const ramTable = document.getElementById("ramTable").getElementsByTagName("tbody")[0];
  for (let i = 0; i < 256; i++) {
    const addr = i.toString(16).toUpperCase().padStart(2, "0");
    const row = ramTable.insertRow();
    row.insertCell(0).textContent = addr;
    row.cells[0].classList.add("px-4", "py-1");

    // Make label cell editable
    const labelCell = row.insertCell(1);
    labelCell.textContent = "NULL";
    labelCell.setAttribute("contenteditable", "true");
    labelCell.classList.add("cursor-pointer", "hover:bg-gray-600", "px-4", "py-1", "outline-none");

    // Make value cell editable
    const valueCell = row.insertCell(2);
    valueCell.textContent = "NULL";
    valueCell.setAttribute("contenteditable", "true");
    valueCell.classList.add("cursor-pointer", "hover:bg-gray-600", "px-4", "py-1", "outline-none");

    // Add event listeners for both cells
    [labelCell, valueCell].forEach((cell) => {
      // Store original value when starting to edit
      cell.addEventListener("focus", function () {
        this.dataset.originalValue = this.textContent;
      });

      cell.addEventListener("blur", async function () {
        let newValue = this.textContent.trim();
        if (newValue === "") {
          this.textContent = "NULL";
          newValue = "NULL";
        }

        const row = this.parentElement;
        const address = row.cells[0].textContent;
        const label = row.cells[1].textContent;
        const value = row.cells[2].textContent;
        let isValid = true;

        // Validate value (hex number between 00 and FF)
        if (this === valueCell && newValue !== "NULL") {
          const valueRegex = /^[0-9A-Fa-f]{1,2}$/;
          if (!valueRegex.test(newValue)) {
            alert("Value must be a hexadecimal number between 00 and FF");
            this.textContent = this.dataset.originalValue;
            isValid = false;
          } else {
            // Convert to decimal to check range
            const decimalValue = parseInt(newValue, 16);
            if (decimalValue < 0 || decimalValue > 255) {
              alert("Value must be between 00 and FF");
              this.textContent = this.dataset.originalValue;
              isValid = false;
            } else {
              // Pad with leading zero if necessary and convert to uppercase
              this.textContent = newValue.toUpperCase().padStart(2, "0");
            }
          }
        }

        // Validate label (alphanumeric and underscore only)
        if (this === labelCell && newValue !== "NULL") {
          const labelRegex = /^[a-zA-Z0-9_]+$/;
          if (!labelRegex.test(newValue)) {
            alert("Label must contain only letters, numbers, and underscores");
            this.textContent = this.dataset.originalValue;
            isValid = false;
          }
        }

        if (newValue === "") {
          this.textContent = "NULL";
        }

        if (isValid && newValue !== this.dataset.originalValue) {
          try {
            const response = await fetch("/api/set-ram", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                address,
                label: label === "NULL" ? "" : label,
                value: value === "NULL" ? "" : value,
              }),
            });

            if (!response.ok) {
              throw new Error("Failed to update RAM value");
            }
          } catch (error) {
            alert(error.message);
            this.textContent = this.dataset.originalValue;
          }
        }
      });

      // Handle keyboard events
      cell.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
          this.textContent = this.dataset.originalValue;
          this.blur();
        } else if (e.key === "Enter") {
          e.preventDefault();
          this.blur();
        }
      });
    });
  }

  // Event Listeners
  document.getElementById("submitCode").addEventListener("click", submitCode);
  document.getElementById("step").addEventListener("click", step);
  document.getElementById("run").addEventListener("click", runAll);
  document.getElementById("reset").addEventListener("click", reset);
  document.getElementById("aiAssist").addEventListener("click", async function () {
    const code = document.getElementById("codeEditor").value;
    document.getElementById("aiLoading").classList.remove("hidden");

    try {
      const response = await fetch("/api/ai-assist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: code,
          history: executionHistory,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      // Render markdown to HTML
      document.getElementById("aiExplanation").innerHTML = marked.parse(data.explanation);
      document.getElementById("aiModal").classList.remove("hidden");
    } catch (error) {
      alert("Error getting AI assistance: " + error.message);
    } finally {
      document.getElementById("aiLoading").classList.add("hidden");
    }
  });

  // Functions
  async function submitCode() {
    const code = document.getElementById("codeEditor").value;
    const response = await fetch("/api/submit-code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code }),
    });
    const data = await response.json();
    lastSavedCode = code; // Update saved code
    unsavedIndicator.classList.add("hidden"); // Hide indicator
    updateUI({});

    // Update program instructions in visualization modal
    updateProgramInstructions(code);
  }

  function updateProgramInstructions(code) {
    const programInstructions = document.getElementById("programInstructions");
    programInstructions.innerHTML = ""; // Clear existing content

    if (!code.trim()) {
      programInstructions.innerHTML = `
                <div class="text-gray-400 text-center pt-4">
                    Submit a program to see its instructions here
                </div>
            `;
      return;
    }

    // Parse the code and create instruction elements
    const lines = code.split("\n");
    let currentAddress = 0;

    lines.forEach((line) => {
      line = line.trim();
      if (!line || line.startsWith(";")) return;

      const parts = line.split(/\s+/);
      let instruction, operand;

      if (parts[0].endsWith(":")) {
        instruction = parts[1];
        operand = parts[2];
      } else {
        instruction = parts[0];
        operand = parts[1];
      }

      if (!instruction) return;

      // Create instruction element
      const instructionDiv = document.createElement("div");
      instructionDiv.className = "mb-6";

      // Add instruction header
      const header = document.createElement("h4");
      header.className = "text-white text-lg font-medium mb-2";
      header.textContent = `${instruction.toUpperCase()} ${operand || ""}`;
      instructionDiv.appendChild(header);

      // Create table for steps
      const table = document.createElement("table");
      table.className = "w-full text-gray-300 border-collapse";

      // Add table header
      const thead = document.createElement("thead");
      thead.innerHTML = `
        <tr class="text-left border-b border-gray-600">
          <th class="py-2 w-16">Ring Pulse</th>
          <th class="py-2">Register Transfer</th>
          <th class="py-2">Description</th>
        </tr>
      `;
      table.appendChild(thead);

      // Add table body
      const tbody = document.createElement("tbody");

      // Add fetch cycle steps and instruction-specific steps
      const fetchSteps = [
        { transfer: "MAR ← PC", description: "Get next instruction address" },
        { transfer: "MDR ← RAM(MAR)", description: "Read instruction from memory" },
        { transfer: "IR ← MDR", description: "Load instruction into IR" },
      ];

      // Create combined steps array with exactly 6 steps
      const allSteps = [...fetchSteps];
      const instructionSteps = getInstructionSteps(instruction.toUpperCase());
      allSteps.push(...instructionSteps);

      // Fill remaining steps with dashes if needed (except for HLT)
      if (instruction.toUpperCase() !== "HLT" && allSteps.length < 6) {
        const remainingSteps = 6 - allSteps.length;
        for (let i = 0; i < remainingSteps; i++) {
          allSteps.push({ transfer: "-", description: "-" });
        }
      }

      // Add all steps to the table
      allSteps.forEach((step, index) => {
        const tr = document.createElement("tr");
        tr.className = "cursor-pointer hover:bg-gray-700";

        if ("text" in step) {
          // Handle instruction-specific steps
          const [transfer, description] = step.text.split(" | ");
          tr.innerHTML = `
            <td class="py-1">${index}</td>
            <td class="py-1 font-mono">${transfer}</td>
            <td class="py-1">${description}</td>
          `;
          tr.onclick = () => highlightComponents(step.components, step.bus);
        } else {
          // Handle fetch steps or dash steps
          tr.innerHTML = `
            <td class="py-1">${index}</td>
            <td class="py-1 font-mono">${step.transfer}</td>
            <td class="py-1">${step.description}</td>
          `;
          if (step.transfer !== "-") {
            tr.onclick = () =>
              highlightComponents(getComponentsForTransfer(step.transfer), getBusForTransfer(step.transfer));
          }
        }
        tbody.appendChild(tr);
      });

      table.appendChild(tbody);
      instructionDiv.appendChild(table);
      programInstructions.appendChild(instructionDiv);
    });
  }

  function getInstructionSteps(instruction) {
    const steps = {
      LDA: [
        { text: "MAR ← IR | Get operand address", components: ["ir", "mar"], bus: ["ir-to-main", "mar-to-main", "bus-5", "bus-6", "bus-7", "bus-8", "bus-9"] },
        {
          text: "MDR ← RAM(MAR) | Read operand from memory",
          components: ["mar", "mdr"],
          bus: ["ram-to-mdr-horizontal", "ram-to-mdr-vertical-up", "ram-to-mdr-vertical-down"],
        },
        { text: "ACC ← MDR | Load operand into ACC", components: ["mdr", "acc"], bus: ["mdr-to-main", "acc-to-main", "bus-2", "bus-3","bus-4", "bus-5", "bus-6", "bus-7", "bus-8", "bus-9", "bus-10", "bus-11"] },
      ],
      STA: [
        { text: "MAR ← IR | Get target address", components: ["ir", "mar"], bus: ["ir-to-main", "mar-to-main", "bus-5", "bus-6", "bus-7", "bus-8", "bus-9"] },
        {
          text: "MDR ← ACC | Prepare ACC value for storage",
          components: ["acc", "mdr"],
          bus: ["acc-to-main", "mdr-to-main", "bus-2", "bus-3","bus-4", "bus-5", "bus-6", "bus-7", "bus-8", "bus-9", "bus-10", "bus-11"],
        },
        {
          text: "RAM(MAR) ← MDR | Store ACC value in memory",
          components: ["mdr", "mar"],
          bus: ["ram-to-mdr-horizontal", "ram-to-mdr-vertical-up", "ram-to-mdr-vertical-down"],
        },
      ],
      ADD: [
        {
          text: "ALU ← ACC + B | Add B to ACC",
          components: ["acc", "b"],
          bus: ["acc-to-main", "b-to-main", "acc-to-alu", "bus-2", "bus-3","bus-4", "bus-5", "bus-6", "bus-7"],
        },
        { text: "ACC ← ALU | Store result in ACC", components: ["acc"], bus: ["acc-to-alu"] },
        { text: "- | -", components: [], bus: [] },
      ],
      SUB: [
        {
          text: "ALU ← ACC - B | Subtract B from ACC",
          components: ["acc", "b"],
          bus: ["acc-to-main", "b-to-main", "acc-to-alu", "bus-2", "bus-3","bus-4", "bus-5", "bus-6", "bus-7"],
        },
        { text: "ACC ← ALU | Store result in ACC", components: ["acc"], bus: ["acc-to-alu"] },
        { text: "- | -", components: [], bus: [] },
      ],
      MBA: [
        { text: "B ← ACC | Copy ACC to B register", components: ["acc", "b"], bus: ["acc-to-main", "b-to-main", "bus-2", "bus-3","bus-4", "bus-5", "bus-6", "bus-7"] },
        { text: "- | -", components: [], bus: [] },
        { text: "- | -", components: [], bus: [] },
      ],
      JMP: [
        { text: "PC ← IR | Jump to address in IR", components: ["ir", "pc"], bus: ["ir-to-main", "pc-to-main", "bus-3","bus-4", "bus-5", "bus-6", "bus-7", "bus-8", "bus-9"] },
        { text: "- | -", components: [], bus: [] },
        { text: "- | -", components: [], bus: [] },
      ],
      JN: [
        {
          text: "PC ← IR if NF set | Jump if negative flag is set",
          components: ["nf", "ir", "pc"],
          bus: ["ir-to-main", "pc-to-main", "bus-3","bus-4", "bus-5", "bus-6", "bus-7", "bus-8", "bus-9"],
        },
        { text: "- | -", components: [], bus: [] },
        { text: "- | -", components: [], bus: [] },
      ],
      HLT: [{ text: "Stop clock | Halt execution", components: ["ir"], bus: [] }],
    };
    return steps[instruction] || [];
  }

  function highlightComponents(components, busSegments) {
    // Reset all components and bus segments
    const allComponents = ["pc", "mar", "mdr", "ir", "acc", "b", "nf"];
    const allBusSegments = [
      "bus-1",
      "bus-2",
      "bus-3",
      "bus-4",
      "bus-5",
      "bus-6",
      "bus-7",
      "bus-8",
      "bus-9",
      "bus-10",
      "bus-11",
      "mar-to-main",
      "ram-to-mdr-horizontal",
      "ram-to-mdr-vertical-up",
      "ram-to-mdr-vertical-down",
      "mdr-to-main",
      "ir-to-main",
      "acc-to-main",
      "b-to-main",
      "pc-to-main",
      "acc-to-alu",
    ];

    // Reset colors
    allComponents.forEach((id) => {
      const element = document.querySelector(`#${id}`);
      if (element) {
        element.style.fill = "#4A1E3F"; // Original color
      }
    });

    allBusSegments.forEach((id) => {
      const element = document.querySelector(`#${id}`);
      if (element) {
        element.style.fill = "#D9D9D9"; // Original color
      }
    });

    // Highlight active components and bus segments
    components.forEach((id) => {
      const element = document.querySelector(`#${id}`);
      if (element) {
        element.style.fill = "#6B2E5A"; // Highlighted component color
      }
    });

    busSegments.forEach((id) => {
      const element = document.querySelector(`#${id}`);
      if (element) {
        element.style.fill = "#4A90E2"; // Highlighted bus color
      }
    });
  }

  async function step() {
    const response = await fetch("/api/step", {
      method: "POST",
    });
    const data = await response.json();
    if (!response.ok) {
      alert(data.error);
      return;
    }

    // Record step in history
    executionHistory.push({
      pc: data.pc,
      acc: data.acc,
      b: data.b,
      mar: data.mar,
      mdr: data.mdr,
      ir: data.ir,
      nf: data.nf,
      instruction: data.instruction,
      comments: data.comments,
    });

    updateUI(data);
  }

  async function runAll() {
    const response = await fetch("/api/run", {
      method: "POST",
    });
    const data = await response.json();
    if (!response.ok) {
      alert(data.error);
      return;
    }
    if (data.results.length > 0) {
      updateUI(data.results[data.results.length - 1]);
    }
  }

  async function reset() {
    await fetch("/api/reset", {
      method: "POST",
    });
    lastSavedCode = codeEditor.value; // Update saved code
    unsavedIndicator.classList.add("hidden"); // Hide indicator
    updateUI({
      pc: "",
      acc: "",
      b: "",
      mar: "",
      mdr: "",
      ir: "",
      nf: "",
      comments: "",
      instruction: "",
    });
    // Reset RAM table
    const rows = ramTable.getElementsByTagName("tr");
    for (let row of rows) {
      row.cells[1].textContent = "NULL";
      row.cells[2].textContent = "NULL";
    }
  }

  function updateUI(data) {
    // Helper function to update register with glow effect
    const updateRegister = (id, newValue) => {
      const element = document.getElementById(id);
      if (!element) return; // Skip if element doesn't exist
      const oldValue = element.textContent;
      element.textContent = newValue || "";

      // Add glow effect if value changed
      if (oldValue !== newValue && newValue) {
        const registerDiv = element.closest(".register");
        if (registerDiv) {
          registerDiv.classList.add("register-glow");

          // Remove glow effect after animation
          setTimeout(() => {
            registerDiv.classList.remove("register-glow");
          }, 1000);
        }
      }
    };

    // Update registers with glow effect
    updateRegister("pc", data.pc);
    updateRegister("acc", data.acc);
    updateRegister("b", data.b);
    updateRegister("mar", data.mar);
    updateRegister("mdr", data.mdr);
    updateRegister("ir", data.ir);
    updateRegister("nf", data.nf);

    // Update RAM if provided
    if (data.ram) {
      const rows = ramTable.getElementsByTagName("tr");
      for (let row of rows) {
        const addr = row.cells[0].textContent;
        if (data.ram[addr]) {
          row.cells[1].textContent = data.ram[addr].label;
          row.cells[2].textContent = data.ram[addr].value;
        }
      }
    }
  }

  // Help modal functionality
  const helpButton = document.getElementById("helpButton");
  const helpModal = document.getElementById("helpModal");
  const closeHelp = document.getElementById("closeHelp");

  helpButton.addEventListener("click", () => {
    helpModal.classList.remove("hidden");
  });

  closeHelp.addEventListener("click", () => {
    helpModal.classList.add("hidden");
  });

  // Close modal when clicking outside
  helpModal.addEventListener("click", (e) => {
    if (e.target === helpModal) {
      helpModal.classList.add("hidden");
    }
  });

  // Close modal with Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !helpModal.classList.contains("hidden")) {
      helpModal.classList.add("hidden");
    }
  });

  // Add modal close handlers
  document.getElementById("closeAi").addEventListener("click", () => {
    document.getElementById("aiModal").classList.add("hidden");
  });

  document.getElementById("aiModal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("aiModal")) {
      document.getElementById("aiModal").classList.add("hidden");
    }
  });

  // Remove visualization modal code and keep only the helper functions
  function getComponentsForTransfer(transfer) {
    const parts = transfer.split("←").map((p) => p.trim());
    const components = [];

    // Map text representations to component IDs
    const componentMap = {
      PC: "pc",
      MAR: "mar",
      MDR: "mdr",
      IR: "ir",
      ACC: "acc",
      B: "b",
      "RAM(MAR)": "mar",
    };

    parts.forEach((part) => {
      Object.entries(componentMap).forEach(([key, value]) => {
        if (part.includes(key)) {
          components.push(value);
        }
      });
    });

    return components;
  }

  function getBusForTransfer(transfer) {
    const parts = transfer.split("←").map((p) => p.trim());

    // Handle MDR ← RAM(MAR) transfers
    if (transfer.includes("RAM(MAR)")) {
      return ["ram-to-mdr-horizontal", "ram-to-mdr-vertical-up", "ram-to-mdr-vertical-down"];
    }

    // Handle MAR ← PC transfer
    if (parts[0] === "MAR" && parts[1] === "PC") {
      return ["pc-to-main", "mar-to-main", "bus-3", "bus-4", "bus-5"];
    }

    // Handle IR ← MDR transfer
    if (parts[0] === "IR" && parts[1] === "MDR") {
      return ["mdr-to-main", "ir-to-main", "bus-9", "bus-10", "bus-11"];
    }

    return ["mar-to-main"]; // Default bus line
  }
});
